import 'dotenv/config';
import { client } from './db.js';
import { saveBase64File } from './services/fileStorage.js';

async function migrate() {
  console.log('=== Base64 -> Sunucu Diski Dosya Taşıma Başlatılıyor ===\n');

  // 1. Alış Faturaları & Fişler
  console.log('1. Alış faturaları ve fişler taranıyor...');
  const alisRs = await client.execute(`
    SELECT id, fatura_no, muhasebe_kodu, pdf_dosya, pdf_dosya_adi 
    FROM alis_faturalari 
    WHERE pdf_dosya LIKE 'data:%'
  `);
  console.log(`Bulunan Alış Faturası / Fiş sayısı: ${alisRs.rows.length}`);

  let alisMigrated = 0;
  for (const row of alisRs.rows) {
    const isExpense = (row.muhasebe_kodu && String(row.muhasebe_kodu).trim().startsWith('7')) ||
                      /whatsapp|image|jpeg|jpg|png|fis/i.test(row.pdf_dosya_adi || '') ||
                      row.pdf_dosya.startsWith('data:image/');
    const folder = isExpense ? 'fisler' : 'faturalar';
    const originalName = row.pdf_dosya_adi || (isExpense ? `fis_${row.fatura_no || row.id}.jpg` : `fatura_${row.fatura_no || row.id}.pdf`);

    const diskPath = saveBase64File(row.pdf_dosya, originalName, folder);
    if (diskPath && diskPath.startsWith('/uploads/')) {
      await client.execute({
        sql: 'UPDATE alis_faturalari SET pdf_dosya = ? WHERE id = ?',
        args: [diskPath, row.id]
      });
      alisMigrated++;
      if (alisMigrated % 50 === 0 || alisMigrated === alisRs.rows.length) {
        console.log(`[Alış] ${alisMigrated} / ${alisRs.rows.length} taşındı...`);
      }
    }
  }

  // 2. Satış Faturaları
  console.log('\n2. Satış faturaları taranıyor...');
  const satisRs = await client.execute(`
    SELECT id, fatura_no, pdf_dosya, pdf_dosya_adi 
    FROM satis_faturalari 
    WHERE pdf_dosya LIKE 'data:%'
  `);
  console.log(`Bulunan Satış Faturası sayısı: ${satisRs.rows.length}`);

  let satisMigrated = 0;
  for (const row of satisRs.rows) {
    const originalName = row.pdf_dosya_adi || `satis_${row.fatura_no || row.id}.pdf`;
    const diskPath = saveBase64File(row.pdf_dosya, originalName, 'faturalar');
    if (diskPath && diskPath.startsWith('/uploads/')) {
      await client.execute({
        sql: 'UPDATE satis_faturalari SET pdf_dosya = ? WHERE id = ?',
        args: [diskPath, row.id]
      });
      satisMigrated++;
      if (satisMigrated % 50 === 0 || satisMigrated === satisRs.rows.length) {
        console.log(`[Satış] ${satisMigrated} / ${satisRs.rows.length} taşındı...`);
      }
    }
  }

  // 3. Dekontlar
  console.log('\n3. Dekontlar taranıyor...');
  const dekontAlisRs = await client.execute(`
    SELECT id, odeme_dekontu, odeme_dekontu_adi 
    FROM alis_faturalari 
    WHERE odeme_dekontu LIKE 'data:%'
  `);
  for (const row of dekontAlisRs.rows) {
    const diskPath = saveBase64File(row.odeme_dekontu, row.odeme_dekontu_adi || 'dekont.pdf', 'dekontlar');
    if (diskPath && diskPath.startsWith('/uploads/')) {
      await client.execute({
        sql: 'UPDATE alis_faturalari SET odeme_dekontu = ? WHERE id = ?',
        args: [diskPath, row.id]
      });
    }
  }

  console.log('\n=== TAŞIMA TAMAMLANDI ===');
  console.log(`Toplam Taşınan Alış Belgesi/Fişi: ${alisMigrated}`);
  console.log(`Toplam Taşınan Satış Faturası: ${satisMigrated}`);
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration hatası:', err);
    process.exit(1);
  });
