import { client } from '../db.js';
import { saveBase64File } from './fileStorage.js';

let isMigrationRunning = false;

/**
 * Veritabanında Base64 olarak saklanan tüm fatura ve dekontları sunucu diskine (/uploads)
 * taşır ve veritabanını hafifletir. İdempotenttir (tekrar tekrar çalışabilir).
 */
export async function runBase64DiskMigration(options = { logProgress: true }) {
  if (isMigrationRunning) {
    if (options.logProgress) console.log('[Base64Migration] Zaten arka planda bir taşıma çalışıyor.');
    return { status: 'already_running' };
  }

  isMigrationRunning = true;
  const startTime = Date.now();

  try {
    if (options.logProgress) console.log('[Base64Migration] Başlatılıyor...');

    // 1. ALIS FATURALARI - PDF & GÖRSELLER
    const alisRs = await client.execute(`
      SELECT id, fatura_no, muhasebe_kodu, pdf_dosya, pdf_dosya_adi 
      FROM alis_faturalari 
      WHERE (pdf_dosya LIKE 'data:%' OR (length(pdf_dosya) > 500 AND pdf_dosya NOT LIKE '/uploads/%' AND pdf_dosya NOT LIKE 'http%'))
    `);

    let alisCount = 0;
    if (alisRs.rows && alisRs.rows.length > 0) {
      if (options.logProgress) console.log(`[Base64Migration] Taşınacak Alış Faturası / Fiş sayısı: ${alisRs.rows.length}`);

      for (const row of alisRs.rows) {
        try {
          const isExpense = (row.muhasebe_kodu && String(row.muhasebe_kodu).trim().startsWith('7')) ||
                            /whatsapp|image|jpeg|jpg|png|fis/i.test(row.pdf_dosya_adi || '') ||
                            (typeof row.pdf_dosya === 'string' && row.pdf_dosya.startsWith('data:image/'));
          const folder = isExpense ? 'fisler' : 'faturalar';
          const originalName = row.pdf_dosya_adi || (isExpense ? `fis_${row.fatura_no || row.id}.jpg` : `fatura_${row.fatura_no || row.id}.pdf`);

          const diskPath = saveBase64File(row.pdf_dosya, originalName, folder);
          if (diskPath && diskPath.startsWith('/uploads/')) {
            await client.execute({
              sql: 'UPDATE alis_faturalari SET pdf_dosya = ? WHERE id = ?',
              args: [diskPath, row.id]
            });
            alisCount++;
            if (options.logProgress && (alisCount % 100 === 0 || alisCount === alisRs.rows.length)) {
              console.log(`[Base64Migration] Alış Faturaları: ${alisCount} / ${alisRs.rows.length} taşındı...`);
            }
          }
        } catch (itemErr) {
          console.error(`[Base64Migration] Alış faturası #${row.id} taşıma hatası:`, itemErr.message);
        }
      }
    }

    // 2. SATIS FATURALARI - PDF
    const satisRs = await client.execute(`
      SELECT id, fatura_no, pdf_dosya, pdf_dosya_adi 
      FROM satis_faturalari 
      WHERE (pdf_dosya LIKE 'data:%' OR (length(pdf_dosya) > 500 AND pdf_dosya NOT LIKE '/uploads/%' AND pdf_dosya NOT LIKE 'http%'))
    `);

    let satisCount = 0;
    if (satisRs.rows && satisRs.rows.length > 0) {
      if (options.logProgress) console.log(`[Base64Migration] Taşınacak Satış Faturası sayısı: ${satisRs.rows.length}`);

      for (const row of satisRs.rows) {
        try {
          const originalName = row.pdf_dosya_adi || `satis_${row.fatura_no || row.id}.pdf`;
          const diskPath = saveBase64File(row.pdf_dosya, originalName, 'faturalar');
          if (diskPath && diskPath.startsWith('/uploads/')) {
            await client.execute({
              sql: 'UPDATE satis_faturalari SET pdf_dosya = ? WHERE id = ?',
              args: [diskPath, row.id]
            });
            satisCount++;
            if (options.logProgress && (satisCount % 50 === 0 || satisCount === satisRs.rows.length)) {
              console.log(`[Base64Migration] Satış Faturaları: ${satisCount} / ${satisRs.rows.length} taşındı...`);
            }
          }
        } catch (itemErr) {
          console.error(`[Base64Migration] Satış faturası #${row.id} taşıma hatası:`, itemErr.message);
        }
      }
    }

    // 3. DEKONTLAR (Alış ve Satış)
    const dekontAlisRs = await client.execute(`
      SELECT id, odeme_dekontu, odeme_dekontu_adi 
      FROM alis_faturalari 
      WHERE (odeme_dekontu LIKE 'data:%' OR (length(odeme_dekontu) > 500 AND odeme_dekontu NOT LIKE '/uploads/%' AND odeme_dekontu NOT LIKE 'http%'))
    `);
    let dekontCount = 0;
    if (dekontAlisRs.rows && dekontAlisRs.rows.length > 0) {
      for (const row of dekontAlisRs.rows) {
        try {
          const diskPath = saveBase64File(row.odeme_dekontu, row.odeme_dekontu_adi || 'dekont.pdf', 'dekontlar');
          if (diskPath && diskPath.startsWith('/uploads/')) {
            await client.execute({
              sql: 'UPDATE alis_faturalari SET odeme_dekontu = ? WHERE id = ?',
              args: [diskPath, row.id]
            });
            dekontCount++;
          }
        } catch (e) {
          console.error(`[Base64Migration] Dekont #${row.id} taşıma hatası:`, e.message);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    if (options.logProgress) {
      console.log(`[Base64Migration] TAMAMLANDI (${duration}s): ${alisCount} alış, ${satisCount} satış, ${dekontCount} dekont taşındı.`);
    }

    return {
      success: true,
      duration: `${duration}s`,
      alisCount,
      satisCount,
      dekontCount
    };
  } catch (error) {
    console.error('[Base64Migration] Genel hata:', error);
    return { success: false, error: error.message };
  } finally {
    isMigrationRunning = false;
  }
}
