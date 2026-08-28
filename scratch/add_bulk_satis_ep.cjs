const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '../api/index.js');
let indexJs = fs.readFileSync(indexPath, 'utf8');

const targetStr = "app.post('/api/invoices/import-from-logo',";

const bulkImportSatisEndpoint = `app.post('/api/invoices/bulk-import-satis', authMiddleware, async (req, res) => {
  const { invoices } = req.body;
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return res.status(400).json({ success: false, message: 'Aktarılacak belge listesi boş.' });
  }

  try {
    const companyId = req.user.companyId;

    // Get existing invoices to prevent duplicate insertion
    const exRs = await client.execute({
      sql: 'SELECT fatura_no, gib_uuid FROM satis_faturalari WHERE company_id = ?',
      args: [companyId]
    });
    const existingNos = new Set();
    const existingUuids = new Set();
    for (const r of exRs.rows) {
      if (r.fatura_no) existingNos.add(String(r.fatura_no).trim().toLowerCase());
      if (r.gib_uuid) existingUuids.add(String(r.gib_uuid).trim().toLowerCase());
    }

    // Get existing cariler for auto-linking
    const carilerRs = await client.execute({
      sql: 'SELECT id, unvan, vkn_tckn FROM cariler WHERE company_id = ?',
      args: [companyId]
    });
    const carilerMap = new Map();
    for (const c of carilerRs.rows) {
      if (c.vkn_tckn) carilerMap.set(String(c.vkn_tckn).trim(), c.id);
      if (c.unvan) carilerMap.set(String(c.unvan).trim().toLowerCase(), c.id);
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const inv of invoices) {
      const faturaNo = String(inv.faturaNo || inv.invoiceNumber || '').trim();
      const uuid = String(inv.uuid || inv.gibUuid || '').trim();
      const vkn = String(inv.senderVkn || inv.tcVkn || inv.vknTckn || '').trim();
      const unvan = String(inv.senderName || inv.ad || 'Bilinmeyen Alıcı').trim();

      if (!faturaNo && !uuid) {
        skippedCount++;
        continue;
      }

      // Check duplicates
      if (faturaNo && existingNos.has(faturaNo.toLowerCase())) {
        skippedCount++;
        continue;
      }
      if (uuid && existingUuids.has(uuid.toLowerCase())) {
        skippedCount++;
        continue;
      }

      // Cari ID linking
      let cariId = inv.cariId || null;
      if (!cariId && vkn && carilerMap.has(vkn)) {
        cariId = carilerMap.get(vkn);
      } else if (!cariId && unvan && carilerMap.has(unvan.toLowerCase())) {
        cariId = carilerMap.get(unvan.toLowerCase());
      }

      const id = uuidv4();
      const islemTarihi = inv.issueDate || inv.faturaTarihi || new Date().toISOString().split('T')[0];
      const payableAmount = parseFloat(inv.payableAmount || inv.toplamTutar || inv.alinanUcret) || 0;
      const matrah = parseFloat(inv.matrah) || (payableAmount - (parseFloat(inv.kdvTutari) || 0));
      const kdvTutari = parseFloat(inv.kdvTutari || inv.taxTotal) || 0;
      const kdvOrani = parseFloat(inv.kdvOrani) || (matrah > 0 && kdvTutari > 0 ? Math.round((kdvTutari / matrah) * 100) : 20);
      const stopajTutari = parseFloat(inv.stopajTutari) || 0;
      const stopajOrani = parseFloat(inv.stopajOrani) || 0;
      const tevkifatTutari = parseFloat(inv.tevkifatTutari) || 0;
      const tevkifatOrani = parseFloat(inv.tevkifatOrani) || 0;
      const aciklama = inv.faturaAciklama || inv.aciklama || 'Excel / CSV Satış Belgesi';

      await client.execute({
        sql: \`INSERT INTO satis_faturalari 
          (id, fatura_no, fatura_tarihi, ad, tc_vkn, 
           alinan_ucret, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
           stopaj_orani, stopaj_tutari, muhasebe_kodu, pdf_dosya, pdf_dosya_adi, 
           odeme_tarihi, odeme_durumu, cari_id, vade_tarihi, aciklama, olusturma_tarihi, company_id, gib_uuid) 
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\`,
        args: [
          id, faturaNo || 'BELGE-' + Date.now(), islemTarihi, unvan, vkn,
          payableAmount, kdvOrani, kdvTutari, matrah, tevkifatOrani, tevkifatTutari,
          stopajOrani, stopajTutari, inv.muhasebeKodu || null, null, null,
          null, 'odenmedi', cariId, null, aciklama, new Date().toISOString(), companyId, uuid || null
        ]
      });

      if (cariId) {
        const cariHareketId = 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
        await client.execute({
          sql: 'INSERT INTO cari_hareketler (id,cari_id,tarih,islem_turu,tutar,aciklama,bagli_fatura_id,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?)',
          args: [
            cariHareketId, cariId, islemTarihi, 'satis_faturasi', payableAmount,
            aciklama.substring(0, 255), id, new Date().toISOString().split('T')[0], companyId
          ]
        });
      }

      if (faturaNo) existingNos.add(faturaNo.toLowerCase());
      if (uuid) existingUuids.add(uuid.toLowerCase());
      insertedCount++;
    }

    res.json({
      success: true,
      message: \`\${insertedCount} adet satış belgesi başarıyla içeri aktarıldı.\${skippedCount > 0 ? \` (\${skippedCount} adet mükerrer/geçersiz kayıt atlandı)\` : ''}\`,
      count: insertedCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error('Bulk import satis hatası:', error);
    res.status(500).json({ success: false, message: 'İçeri aktarma sırasında hata oluştu: ' + error.message });
  }
});\n\n`;

indexJs = indexJs.replace(targetStr, bulkImportSatisEndpoint + targetStr);
fs.writeFileSync(indexPath, indexJs, 'utf8');
console.log('Added bulk-import-satis endpoint successfully!');
