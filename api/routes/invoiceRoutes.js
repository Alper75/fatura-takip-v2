import express from 'express';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { authMiddleware } from '../auth.js';
import { stockSyncService } from '../services/stockSyncService.js';
import { saveBase64File, saveBufferFile, saveTextFile, getTextFileIfExists } from '../services/fileStorage.js';
import { upload, uploadsDir, xmlParser, n } from '../utils/shared.js';

const router = express.Router();

router.post('/api/luca/mark-transferred', authMiddleware, async (req, res) => {
  const { items } = req.body; // Array of { id, type: 'ALIS'|'SATIS'|'BANKA', transferredAt: string | null }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Güncellenecek kayıt listesi boş.' });
  }

  try {
    let updatedCount = 0;
    for (const item of items) {
      if (!item || !item.id) continue;
      const tType = String(item.type || '').toUpperCase();
      const table = tType === 'SATIS'
        ? 'satis_faturalari'
        : tType === 'BANKA'
          ? 'cari_hareketler'
          : 'alis_faturalari';
      const val = item.transferredAt || null;

      await client.execute({
        sql: `UPDATE ${table} SET luca_transferred_at = ? WHERE id = ? AND company_id = ?`,
        args: [val, item.id, req.user.companyId]
      });
      updatedCount++;
    }
    res.json({ success: true, updatedCount });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// --- PARÇALI ÖDEME & TAHSİLAT ENDPOINTS ---
// ==========================================

// Faturaya ait tahsilat/ödeme geçmişini getir
router.get('/api/faturalar/:id/odemeler', authMiddleware, async (req, res) => {
  try {
    const faturaId = req.params.id;
    const rs = await client.execute({
      sql: `SELECT id, fatura_id, fatura_tipi, tarih, tutar, banka_id, aciklama, dekont_dosya, dekont_dosya_adi, created_at 
            FROM fatura_tahsilatlar 
            WHERE fatura_id = ? AND company_id = ? 
            ORDER BY tarih DESC, created_at DESC`,
      args: [faturaId, req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Faturaya yeni parçalı veya tam ödeme/tahsilat ekle
router.post('/api/faturalar/:id/odeme-ekle', authMiddleware, async (req, res) => {
  const faturaId = req.params.id;
  const { tutar, tarih, bankaId, aciklama, faturaTipi, dekontDosya, dekontDosyaAdi } = req.body;
  const paymentAmount = parseFloat(tutar);

  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Geçerli bir ödeme tutarı giriniz.' });
  }

  const paymentDate = tarih || new Date().toISOString().split('T')[0];
  const type = faturaTipi === 'alis' ? 'alis' : 'satis';
  const table = type === 'satis' ? 'satis_faturalari' : 'alis_faturalari';
  const paymentId = 'ft_' + Date.now().toString() + Math.random().toString(36).substr(2, 4);

  try {
    const fRs = await client.execute({
      sql: `SELECT * FROM ${table} WHERE id = ? AND company_id = ?`,
      args: [faturaId, req.user.companyId]
    });
    if (fRs.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fatura bulunamadı.' });
    }
    const fatura = fRs.rows[0];
    const totalInvoiceAmount = parseFloat(fatura.alinan_ucret || fatura.toplam_tutar || 0);

    let chId = null;
    const cariId = fatura.cari_id;
    if (cariId) {
      chId = 'ch_' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
      const chTuru = type === 'satis' ? 'tahsilat' : 'odeme';
      const cariDesc = aciklama || `${fatura.fatura_no || ''} nolu faturaya istinaden ${type === 'satis' ? 'kısmi tahsilat' : 'kısmi ödeme'}`;
      await client.execute({
        sql: `INSERT INTO cari_hareketler (id, company_id, cari_id, tarih, islem_turu, tutar, aciklama, bagli_fatura_id, banka_id, olusturma_tarihi)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [chId, req.user.companyId, cariId, paymentDate, chTuru, paymentAmount, cariDesc, faturaId, bankaId || null, new Date().toISOString().split('T')[0]]
      }).catch(err => console.warn('Cari hareket eklenemedi:', err.message));
    }

    await client.execute({
      sql: `INSERT INTO fatura_tahsilatlar (id, company_id, fatura_id, fatura_tipi, tarih, tutar, banka_id, aciklama, dekont_dosya, dekont_dosya_adi, cari_hareket_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [paymentId, req.user.companyId, faturaId, type, paymentDate, paymentAmount, bankaId || null, aciklama || null, dekontDosya || null, dekontDosyaAdi || null, chId]
    });

    const sumRs = await client.execute({
      sql: `SELECT COALESCE(SUM(tutar), 0) as total_odenen FROM fatura_tahsilatlar WHERE fatura_id = ? AND company_id = ?`,
      args: [faturaId, req.user.companyId]
    });
    const totalOdenen = parseFloat(sumRs.rows[0]?.total_odenen || 0);
    const kalanTutar = Math.max(0, Math.round((totalInvoiceAmount - totalOdenen) * 100) / 100);

    let yeniDurum = 'odenmedi';
    if (kalanTutar <= 0.05) {
      yeniDurum = 'odendi';
    } else if (totalOdenen > 0) {
      yeniDurum = 'kismi_odendi';
    }

    await client.execute({
      sql: `UPDATE ${table} SET odenen_tutar = ?, kalan_tutar = ?, odeme_durumu = ?, odeme_tarihi = ? WHERE id = ? AND company_id = ?`,
      args: [totalOdenen, kalanTutar, yeniDurum, paymentDate, faturaId, req.user.companyId]
    });

    res.json({
      success: true,
      message: 'Ödeme başarıyla kaydedildi.',
      odenenTutar: totalOdenen,
      kalanTutar,
      odemeDurumu: yeniDurum,
      paymentId
    });
  } catch (e) {
    console.error('Ödeme ekleme hatası:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Faturaya ait tahsilat kaydını sil
router.delete('/api/faturalar/:faturaId/odemeler/:paymentId', authMiddleware, async (req, res) => {
  const { faturaId, paymentId } = req.params;
  try {
    const pRs = await client.execute({
      sql: `SELECT * FROM fatura_tahsilatlar WHERE id = ? AND fatura_id = ? AND company_id = ?`,
      args: [paymentId, faturaId, req.user.companyId]
    });
    if (pRs.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ödeme kaydı bulunamadı.' });
    }
    const payment = pRs.rows[0];
    const type = payment.fatura_tipi;
    const table = type === 'satis' ? 'satis_faturalari' : 'alis_faturalari';

    if (payment.cari_hareket_id) {
      await client.execute({
        sql: `DELETE FROM cari_hareketler WHERE id = ? AND company_id = ?`,
        args: [payment.cari_hareket_id, req.user.companyId]
      }).catch(() => {});
    }

    await client.execute({
      sql: `DELETE FROM fatura_tahsilatlar WHERE id = ? AND company_id = ?`,
      args: [paymentId, req.user.companyId]
    });

    const fRs = await client.execute({
      sql: `SELECT * FROM ${table} WHERE id = ? AND company_id = ?`,
      args: [faturaId, req.user.companyId]
    });
    const fatura = fRs.rows[0];
    const totalInvoiceAmount = parseFloat(fatura?.alinan_ucret || fatura?.toplam_tutar || 0);

    const sumRs = await client.execute({
      sql: `SELECT COALESCE(SUM(tutar), 0) as total_odenen FROM fatura_tahsilatlar WHERE fatura_id = ? AND company_id = ?`,
      args: [faturaId, req.user.companyId]
    });
    const totalOdenen = parseFloat(sumRs.rows[0]?.total_odenen || 0);
    const kalanTutar = Math.max(0, Math.round((totalInvoiceAmount - totalOdenen) * 100) / 100);

    let yeniDurum = 'odenmedi';
    if (kalanTutar <= 0.05 && totalOdenen > 0) {
      yeniDurum = 'odendi';
    } else if (totalOdenen > 0) {
      yeniDurum = 'kismi_odendi';
    }

    await client.execute({
      sql: `UPDATE ${table} SET odenen_tutar = ?, kalan_tutar = ?, odeme_durumu = ? WHERE id = ? AND company_id = ?`,
      args: [totalOdenen, kalanTutar, yeniDurum, faturaId, req.user.companyId]
    });

    res.json({
      success: true,
      message: 'Ödeme kaydı silindi.',
      odenenTutar: totalOdenen,
      kalanTutar,
      odemeDurumu: yeniDurum
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});



router.post('/api/invoices/import-satis', authMiddleware, async (req, res) => {
  const invoice = req.body;
  if (!invoice || !invoice.faturaNo) {
    return res.status(400).json({ success: false, message: 'Geçersiz belge verisi.' });
  }
  
  try {
    const { faturaNo, senderName, senderVkn, issueDate, payableAmount, currencyCode, uuid, matrah, kdvOrani, kdvTutari, oivTutari, faturaAciklama, stopajOrani, stopajTutari, tevkifatOrani, tevkifatTutari, muhasebeKodu, cariId } = invoice;
    const islemTarihi = issueDate ? issueDate.split('T')[0] : new Date().toISOString().split('T')[0];
    
    // Check if invoice already exists in satis_faturalari
    const existing = await client.execute({
      sql: 'SELECT id FROM satis_faturalari WHERE company_id = ? AND fatura_no = ? AND tc_vkn = ?',
      args: [req.user.companyId, faturaNo, senderVkn]
    });
    
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Bu belge zaten satış listesine kaydedilmiş.' });
    }
    
    // Otomatik olarak PDF'i de eLogo veya Uyumsoft'tan çekip kaydedelim (ikisini de deneyebiliriz)
    let pdfDosyaBase64 = null;
    let pdfDosyaAdi = null;
    try {
      const settingsRes = await client.execute({
        sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
        args: [req.user.companyId]
      });
      const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
      
      // İlk eLogo dene
      if (settings.elogo_username && settings.elogo_password) {
        const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
        const docDataRes = await elogo.getDocumentPdf(uuid);
        if (docDataRes.success && docDataRes.data?.document?.binaryData?.Value) {
          const base64Data = docDataRes.data.document.binaryData.Value;
          const buffer = Buffer.from(base64Data, 'base64');
          pdfDosyaAdi = `${uuid}.pdf`;
          if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP
             const zip = new AdmZip(buffer);
             const zipEntries = zip.getEntries();
             const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
             if (pdfEntry) {
               const savedPath = saveBufferFile(pdfEntry.getData(), pdfDosyaAdi, 'faturalar');
               pdfDosyaBase64 = savedPath || `data:application/pdf;base64,${pdfEntry.getData().toString('base64')}`;
             }
          } else {
             const savedPath = saveBufferFile(buffer, pdfDosyaAdi, 'faturalar');
             pdfDosyaBase64 = savedPath || `data:application/pdf;base64,${base64Data}`;
          }
        }
      }
      
      // eLogo yoksa veya çekemediyse Uyumsoft dene
      if (!pdfDosyaBase64 && settings.uyumsoft_username && settings.uyumsoft_password) {
        const { UyumsoftClient } = await import('../services/uyumsoftClient.js');
        const uyumsoft = new UyumsoftClient(settings.uyumsoft_username, settings.uyumsoft_password, settings.uyumsoft_is_test === 'true');
        // Makbuz mu Fatura mı ayırmak için prefix'e bakabiliriz ama şimdilik fatura olarak deneyelim
        let docDataRes = await uyumsoft.getDocumentPdf(uuid);
        if (!docDataRes.success) {
           // Fatura PDF başarısızsa makbuz PDF dene
           docDataRes = await uyumsoft.getVoucherPdf(uuid);
        }
        
        if (docDataRes.success && docDataRes.data?.document?.binaryData?.Value) {
          const base64Data = docDataRes.data.document.binaryData.Value;
          const buffer = Buffer.from(base64Data, 'base64');
          pdfDosyaAdi = `${uuid}.pdf`;
          if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP
             const zip = new AdmZip(buffer);
             const zipEntries = zip.getEntries();
             const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
             if (pdfEntry) {
               const savedPath = saveBufferFile(pdfEntry.getData(), pdfDosyaAdi, 'faturalar');
               pdfDosyaBase64 = savedPath || `data:application/pdf;base64,${pdfEntry.getData().toString('base64')}`;
             }
          } else {
             const savedPath = saveBufferFile(buffer, pdfDosyaAdi, 'faturalar');
             pdfDosyaBase64 = savedPath || `data:application/pdf;base64,${base64Data}`;
          }
        }
      }
    } catch(e) {
      console.error("PDF otomatik çekme hatası (import-satis):", e);
    }
    
    // Insert into DB (satis_faturalari)
    const id = uuidv4();
    await client.execute({
      sql: `INSERT INTO satis_faturalari 
        (id, fatura_no, fatura_tarihi, ad, tc_vkn, 
         alinan_ucret, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
         stopaj_orani, stopaj_tutari, muhasebe_kodu, pdf_dosya, pdf_dosya_adi, 
         odeme_tarihi, odeme_durumu, cari_id, vade_tarihi, aciklama, olusturma_tarihi, company_id, gib_uuid) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id, faturaNo, islemTarihi, senderName || 'Bilinmiyor', senderVkn || '',
        payableAmount, kdvOrani || 0, kdvTutari || 0, matrah || 0, tevkifatOrani || 0, tevkifatTutari || 0,
        stopajOrani || 0, stopajTutari || 0, muhasebeKodu || null, pdfDosyaBase64, pdfDosyaAdi,
        null, 'odenmedi', cariId || null, null, faturaAciklama || '', new Date().toISOString(), req.user.companyId, uuid
      ]
    });

    if (cariId) {
      const cariHareketId = 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
      await client.execute({
        sql: 'INSERT INTO cari_hareketler (id,cari_id,tarih,islem_turu,tutar,aciklama,bagli_fatura_id,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [
          cariHareketId, cariId, islemTarihi, 'satis_faturasi', payableAmount || 0,
          (faturaAciklama || 'Entegratör Satış Faturası').substring(0, 255), id, new Date().toISOString().split('T')[0], req.user.companyId
        ]
      });
    }

    res.json({ success: true, message: 'Belge satış listesine başarıyla eklendi.', id });
  } catch (error) {
    console.error('Import from Logo/Uyumsoft (satis) hatası:', error);
    res.status(500).json({ success: false, message: 'Belge kaydedilirken hata oluştu: ' + error.message });
  }
});


router.post('/api/invoices/bulk-import-satis', authMiddleware, async (req, res) => {
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
        sql: `INSERT INTO satis_faturalari 
          (id, fatura_no, fatura_tarihi, ad, tc_vkn, 
           alinan_ucret, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
           stopaj_orani, stopaj_tutari, muhasebe_kodu, pdf_dosya, pdf_dosya_adi, 
           odeme_tarihi, odeme_durumu, cari_id, vade_tarihi, aciklama, olusturma_tarihi, company_id, gib_uuid) 
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      message: `${insertedCount} adet satış belgesi başarıyla içeri aktarıldı.${skippedCount > 0 ? ` (${skippedCount} adet mükerrer/geçersiz kayıt atlandı)` : ''}`,
      count: insertedCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error('Bulk import satis hatası:', error);
    res.status(500).json({ success: false, message: 'İçeri aktarma sırasında hata oluştu: ' + error.message });
  }
});

router.post('/api/invoices/import-from-logo', authMiddleware, async (req, res) => {
  const invoice = req.body;
  if (!invoice || !invoice.faturaNo) {
    return res.status(400).json({ success: false, message: 'Geçersiz fatura verisi.' });
  }
  
  try {
    const { faturaNo, senderName, senderVkn, issueDate, payableAmount, currencyCode, uuid, matrah, kdvOrani, kdvTutari, kdv1, kdv10, kdv20, oivTutari, faturaAciklama, muhasebeKodu, cariId } = invoice;
    const islemTarihi = issueDate ? issueDate.split('T')[0] : new Date().toISOString().split('T')[0];
    
    // Check if invoice already exists
    const existing = await client.execute({
      sql: 'SELECT id FROM alis_faturalari WHERE company_id = ? AND fatura_no = ? AND tedarikci_vkn = ?',
      args: [req.user.companyId, faturaNo, senderVkn]
    });
    
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Bu fatura zaten sisteme kaydedilmiş.' });
    }

    let finalMuhasebeKodu = muhasebeKodu || null;
    let finalCariId = cariId || null;

    if (!finalCariId && senderVkn) {
      const matchedCari = await client.execute({
        sql: 'SELECT id FROM cariler WHERE company_id = ? AND vkn_tckn = ? LIMIT 1',
        args: [req.user.companyId, senderVkn]
      });
      if (matchedCari.rows && matchedCari.rows.length > 0) {
        finalCariId = matchedCari.rows[0].id;
      }
    }

    if (!finalMuhasebeKodu && senderVkn) {
      const pastAlis = await client.execute({
        sql: "SELECT muhasebe_kodu FROM alis_faturalari WHERE company_id = ? AND tedarikci_vkn = ? AND muhasebe_kodu IS NOT NULL AND muhasebe_kodu != '' ORDER BY id DESC LIMIT 1",
        args: [req.user.companyId, senderVkn]
      });
      if (pastAlis.rows && pastAlis.rows.length > 0) {
        finalMuhasebeKodu = pastAlis.rows[0].muhasebe_kodu;
      }
    }
    
    // Otomatik olarak PDF'i de eLogo'dan çekip kaydedelim
    let pdfDosyaBase64 = null;
    let pdfDosyaAdi = null;
    try {
      const settingsRes = await client.execute({
        sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
        args: [req.user.companyId]
      });
      const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
      if (settings.elogo_username && settings.elogo_password) {
        const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
        const docDataRes = await elogo.getDocumentPdf(uuid);
        if (docDataRes.success && docDataRes.data?.document?.binaryData?.Value) {
          const base64Data = docDataRes.data.document.binaryData.Value;
          const buffer = Buffer.from(base64Data, 'base64');
          const subFolder = (finalMuhasebeKodu && finalMuhasebeKodu.startsWith('7')) ? 'fisler' : 'faturalar';
          if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP
             const zip = new AdmZip(buffer);
             const zipEntries = zip.getEntries();
             const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
             if (pdfEntry) {
               pdfDosyaBase64 = saveBufferFile(pdfEntry.getData(), `${uuid}.pdf`, subFolder);
               pdfDosyaAdi = `${uuid}.pdf`;
             }
          } else {
             pdfDosyaBase64 = saveBufferFile(buffer, `${uuid}.pdf`, subFolder);
             pdfDosyaAdi = `${uuid}.pdf`;
          }
        }
      }
    } catch(e) {
      console.error("PDF otomatik çekme hatası:", e);
    }
    
    // Insert into DB
    const id = uuidv4();
    const cleanAciklama = senderName || 'Alış Faturası';
    await client.execute({
      sql: `INSERT INTO alis_faturalari 
        (id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, mal_hizmet_adi, 
         toplam_tutar, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
         stopaj_orani, stopaj_tutari, muhasebe_kodu, karsi_hesap_kodu, pdf_dosya, pdf_dosya_adi, 
         odeme_tarihi, odeme_durumu, odeme_dekontu, odeme_dekontu_adi, cari_id, vade_tarihi, 
         aciklama, olusturma_tarihi, company_id, kdv1, kdv10, kdv20, oiv_tutari) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, faturaNo, islemTarihi, senderName, senderVkn, faturaAciklama || cleanAciklama,
        payableAmount, kdvOrani || 0, kdvTutari || 0, matrah || 0, '0', 0,
        '0', 0, finalMuhasebeKodu, null, pdfDosyaBase64, pdfDosyaAdi,
        null, 'odenmedi', null, null, finalCariId, null,
        cleanAciklama, new Date().toISOString().split('T')[0], req.user.companyId,
        Number(kdv1) || (kdvOrani === 1 ? kdvTutari : 0),
        Number(kdv10) || (kdvOrani === 10 || kdvOrani === 8 ? kdvTutari : 0),
        Number(kdv20) || (kdvOrani === 20 || kdvOrani === 18 ? kdvTutari : 0),
        oivTutari || 0
      ]
    });

    if (finalCariId) {
      const cariHareketId = 'ch' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
      await client.execute({
        sql: 'INSERT INTO cari_hareketler (id,cari_id,tarih,islem_turu,tutar,aciklama,bagli_fatura_id,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [
          cariHareketId, finalCariId, islemTarihi, 'alis_faturasi', payableAmount || 0,
          cleanAciklama.substring(0, 255), id, new Date().toISOString().split('T')[0], req.user.companyId
        ]
      });
    }

    // Otomatik Stok Hareketi (GIRIS) - Yalnızca 150/153 gibi ticari mal/hammadde stok hesapları için
    if (stockSyncService.isStockAccount(finalMuhasebeKodu)) {
      const itemsToSync = Array.isArray(req.body.items) && req.body.items.length > 0 
        ? req.body.items 
        : [{ name: faturaAciklama || cleanAciklama, qty: 1, price: payableAmount || 0 }];
      
      await stockSyncService.syncInvoiceStockMovements(req.user.companyId, {
        faturaId: id,
        faturaTipi: 'alis',
        items: itemsToSync,
        faturaNo,
        faturaTarihi: islemTarihi,
        muhasebeKodu: finalMuhasebeKodu
      }).catch(err => console.warn('İçe aktarım stok hareketi hatası:', err.message));
    }
    
    res.json({ success: true, message: 'Fatura başarıyla kaydedildi.', data: { id, faturaNo } });
  } catch (error) {
    console.error('Fatura import hatası:', error);
    res.status(500).json({ success: false, message: 'Veritabanına kaydedilirken hata oluştu: ' + error.message });
  }
});


router.post('/api/invoices/parse-xml', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'XML dosyası gereklidir.' });
  
  try {
    const xmlContent = fs.readFileSync(req.file.path, 'utf-8');
    const jsonObj = xmlParser.parse(xmlContent);
    let parsedData = null;

    // --- CASE 1: Standard UBL-TR Invoice ---
    if (jsonObj.Invoice) {
      const inv = jsonObj.Invoice;
      
      const supplierParty = inv['AccountingSupplierParty']?.['Party'];
      const customerParty = inv['AccountingCustomerParty']?.['Party'];
      
      const getText = (node) => (typeof node === 'object' && node !== null) ? (node['#text'] || '') : (node || '');
      const getVkn = (party) => {
        const idNode = party?.['PartyIdentification'];
        if (!idNode) return '';
        const idArray = Array.isArray(idNode) ? idNode : [idNode];
        for (const ident of idArray) {
           const id = ident['ID'];
           if (!id) continue;
           const isVkn = id['@_schemeID'] === 'VKN' || id['@_schemeID'] === 'TCKN';
           const val = isVkn ? id['#text'] : (id['#text'] || id);
           if (val) return String(val).replace('.0', '');
        }
        return '';
      };
      const getAd = (party) => {
        const partyName = Array.isArray(party?.['PartyName']) ? party?.['PartyName'][0] : party?.['PartyName'];
        return getText(partyName?.['Name']) || getText(party?.['Person']?.['FirstName']) || '';
      };
      const getSoyad = (party) => getText(party?.['Person']?.['FamilyName']) || '';
      const getTaxOffice = (party) => getText(party?.['PartyTaxScheme']?.['TaxScheme']?.['Name']) || '';
      const getAddress = (party) => {
        const addr = party?.['PostalAddress'];
        if (!addr) return '';
        return `${getText(addr['StreetName'])} ${getText(addr['BuildingNumber'])} ${getText(addr['CitySubdivisionName'])} ${getText(addr['CityName'])}`.trim();
      };

      const monTotal = inv['LegalMonetaryTotal'];
      const taxTotal = inv['TaxTotal'];
      const withholdingTaxTotal = inv['WithholdingTaxTotal'];

      let kdv1 = 0, kdv10 = 0, kdv20 = 0, oivTutari = 0;
      let tevkifatTutari = 0, stopajTutari = 0;
      
      const taxTotalArray = Array.isArray(taxTotal) ? taxTotal : (taxTotal ? [taxTotal] : []);
      for (const tt of taxTotalArray) {
        const subtotals = tt['TaxSubtotal'];
        if (!subtotals) continue;
        const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
        for (const sub of subArr) {
          const taxCat = sub['TaxCategory'];
          const taxScheme = taxCat?.['TaxScheme']?.['TaxTypeCode']?.['#text'] || taxCat?.['TaxScheme']?.['TaxTypeCode'];
          const taxCode = getText(taxScheme);
          const percent = parseFloat(getText(sub['Percent'])) || parseFloat(getText(taxCat?.['Percent'])) || 0;
          const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
          
          if (taxCode === '0015' || taxCode === '15' || !taxCode) {
            if (percent === 1) kdv1 += amount;
            else if (percent === 10 || percent === 8) kdv10 += amount;
            else if (percent === 20 || percent === 18) kdv20 += amount;
            else kdv20 += amount;
          } else {
            oivTutari += amount;
          }
        }
      }

      const withhTotalArray = Array.isArray(withholdingTaxTotal) ? withholdingTaxTotal : (withholdingTaxTotal ? [withholdingTaxTotal] : []);
      for (const wt of withhTotalArray) {
        const amount = parseFloat(getText(wt['TaxAmount'])) || 0;
        tevkifatTutari += amount;
      }

      const calculatedKdvTotal = Math.round((kdv1 + kdv10 + kdv20) * 100) / 100;
      const rawTaxTotal = parseFloat(taxTotalArray[0]?.['TaxAmount']?.['#text'] || taxTotalArray[0]?.['TaxAmount'] || 0);

      parsedData = {
        faturaNo: getText(inv['ID']),
        faturaTarihi: getText(inv['IssueDate']),
        supplier: {
          vkn: getVkn(supplierParty),
          ad: getAd(supplierParty),
          soyad: getSoyad(supplierParty),
          vergiDairesi: getTaxOffice(supplierParty),
          adres: getAddress(supplierParty),
        },
        customer: {
          vkn: getVkn(customerParty),
          ad: getAd(customerParty),
          soyad: getSoyad(customerParty),
          vergiDairesi: getTaxOffice(customerParty),
          adres: getAddress(customerParty),
        },
        matrah: parseFloat(monTotal?.['TaxExclusiveAmount']?.['#text'] || monTotal?.['TaxExclusiveAmount'] || 0),
        toplamTutar: parseFloat(monTotal?.['PayableAmount']?.['#text'] || monTotal?.['PayableAmount'] || 0),
        kdvTutari: calculatedKdvTotal > 0 ? calculatedKdvTotal : Math.max(0, rawTaxTotal - oivTutari),
        oivTutari: Math.round(oivTutari * 100) / 100,
        kdv1, kdv10, kdv20, tevkifatTutari, stopajTutari,
        type: 'Invoice'
      };

      const lines = inv['InvoiceLine'];
      if (lines) {
        const lineArr = Array.isArray(lines) ? lines : [lines];
        parsedData.items = lineArr.map(l => ({
          name: getText(l['Item']?.['Name']),
          quantity: parseFloat(l['InvoicedQuantity']?.['#text'] || l['InvoicedQuantity'] || 0),
          price: parseFloat(l['Price']?.['PriceAmount']?.['#text'] || l['Price']?.['PriceAmount'] || 0),
        }));
      }
    } 
    // --- CASE 2: e-SMM (VoucherSource) ---
    else if (jsonObj['VoucherSource']?.['eArsivVeriSerbestMeslekMakbuz']) {
      const smm = jsonObj['VoucherSource']['eArsivVeriSerbestMeslekMakbuz'];
      const alici = smm['aliciBilgileri'];
      
      const getVkn = (a) => {
        const val = a?.['tuzelKisi']?.['vkn'] || a?.['gercekKisi']?.['tckn'] || '';
        return val ? String(val).replace('.0', '') : '';
      };
      const getAd = (a) => a?.['tuzelKisi']?.['unvan'] || a?.['gercekKisi']?.['adiSoyadi'] || (a?.['gercekKisi']?.['ad'] ? `${a['gercekKisi']['ad']} ${a['gercekKisi']['soyad'] || ''}`.trim() : '') || 'Bilinmiyor';
      const getAddress = (a) => {
        const addr = a?.['adres'];
        if (!addr) return '';
        return `${addr['caddeSokak'] || ''} ${addr['binaNo'] || ''} ${addr['kapiNo'] || ''} ${addr['semt'] || ''} ${addr['sehir'] || ''}`.trim();
      };

      const vergiBilgisi = smm['vergiBilgisi']?.['vergi'];
      const vergiler = Array.isArray(vergiBilgisi) ? vergiBilgisi : (vergiBilgisi ? [vergiBilgisi] : []);
      
      const kdvVergisi = vergiler.find(v => v['vergiKodu'] === '0015');
      const stopajVergisi = vergiler.find(v => v['vergiKodu'] === '0003' || v['vergiKodu'] === '0011');
      
      const kdv = kdvVergisi?.['vergiTutari'] || 0;
      const stopaj = stopajVergisi?.['vergiTutari'] || 0;
      
      // Calculate rates from XML (or default)
      const kdvMatrah = parseFloat(kdvVergisi?.['matrah'] || 0);
      const calculatedKdvOrani = (kdvMatrah > 0 && kdv > 0) ? Math.round((parseFloat(kdv) / kdvMatrah) * 100) : 20;
      
      const stopajMatrah = parseFloat(stopajVergisi?.['matrah'] || 0);
      const calculatedStopajOrani = (stopajMatrah > 0 && stopaj > 0) ? Math.round((parseFloat(stopaj) / stopajMatrah) * 100) : 0;

      const tevkifatBilgisi = smm['vergiBilgisi']?.['tevkifat'];
      const tevkifatlar = Array.isArray(tevkifatBilgisi) ? tevkifatBilgisi : (tevkifatBilgisi ? [tevkifatBilgisi] : []);
      const tevkifat = tevkifatlar[0];

      const convertTevkifat = (val) => {
        if (!val) return '0';
        const num = parseFloat(val);
        if (Math.abs(num - 20) < 0.1) return '2/10';
        if (Math.abs(num - 30) < 0.1) return '3/10';
        if (Math.abs(num - 40) < 0.1) return '4/10';
        if (Math.abs(num - 50) < 0.1) return '5/10';
        if (Math.abs(num - 70) < 0.1) return '7/10';
        if (Math.abs(num - 90) < 0.1) return '9/10';
        if (Math.abs(num - 100) < 0.1) return '10/10';
        return val.toString();
      };

      // Matrah is usually the "Gross" (Bürüt) in SMM
      const malHizmet = smm['malHizmetBilgisi']?.['malHizmet'];
      const lines = Array.isArray(malHizmet) ? malHizmet : (malHizmet ? [malHizmet] : []);
      const burutUcret = lines.reduce((sum, item) => sum + parseFloat(item['burutUcret'] || 0), 0);

      const stopajVergiKodu = stopajVergisi?.['vergiKodu'];
      const stopajKodu = stopajVergisi ? (stopajVergiKodu === '0003' ? '022' : stopajVergiKodu) : '';

      parsedData = {
        faturaNo: smm['makbuzNo'],
        faturaTarihi: smm['belgeTarihi'],
        supplier: {
          vkn: '',
          ad: 'Serbest Meslek Erbabı',
          vergiDairesi: '',
          adres: '',
        },
        customer: {
          vkn: getVkn(alici),
          ad: getAd(alici),
          vergiDairesi: alici?.['adres']?.['vDaire'] || '',
          adres: getAddress(alici),
        },
        matrah: burutUcret || kdvMatrah || parseFloat(smm['toplamTutar'] || 0),
        toplamTutar: parseFloat(smm['odenecekTutar'] || 0),
        kdvTutari: parseFloat(kdv),
        kdvOrani: calculatedKdvOrani,
        stopajTutari: parseFloat(stopaj),
        stopajOrani: calculatedStopajOrani.toString(),
        stopajKodu: stopajKodu,
        tevkifatTutari: parseFloat(tevkifat?.['tevkifatTutari'] || 0),
        tevkifatOrani: convertTevkifat(tevkifat?.['tevkifatOrani']),
        tevkifatKodu: tevkifat ? (tevkifat['tevkifatKodu'] || '') : '',
        type: 'e-SMM'
      };

      if (lines.length > 0) {
        parsedData.items = lines.map(l => ({
          name: l['ad'],
          quantity: 1,
          price: parseFloat(l['burutUcret'] || 0),
        }));
      }
    } else {
      throw new Error('Geçersiz XML formatı: Invoice veya e-SMM kök etiketi bulunamadı.');
    }

    res.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('XML Parse Error:', error);
    res.status(500).json({ success: false, message: 'XML ayrıştırma hatası: ' + error.message });
  } finally {
    // Cleanup
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// --- GİB PORTAL LOGIC ---
const USE_TEST_MODE = false;

// --- PERSONNEL MODULE ROUTES ---

// Login

router.get('/api/satis-faturalari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT id, fatura_no, fatura_tarihi, ad, soyad, tc_vkn, adres, alinan_ucret, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, tevkifat_kodu, stopaj_orani, stopaj_tutari, stopaj_kodu, muhasebe_kodu, pdf_dosya, pdf_dosya_adi, odeme_tarihi, odeme_durumu, odeme_dekontu, odeme_dekontu_adi, cari_id, vade_tarihi, aciklama, olusturma_tarihi, urun_id, depo_id, gib_uuid, luca_transferred_at, COALESCE(odenen_tutar, 0) as odenen_tutar, kalan_tutar FROM satis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    
    // Stok hareketlerini ürün adlarıyla birlikte çek
    const stokRs = await client.execute({
      sql: `SELECT sh.id, sh.bagli_fatura_id, sh.urun_id, sh.miktar, sh.birim_fiyat,
                   u.urun_adi, u.stok_kodu
            FROM stok_hareketler sh
            LEFT JOIN stok_urunler u ON u.id = sh.urun_id
            WHERE sh.company_id = ? AND sh.tip = ?`,
      args: [req.user.companyId, 'CIKIS']
    });
    
    const stokHareketler = stokRs.rows;
    
    const mapped = rs.rows.map(r => {
      // Bu faturaya bağlı stok kalemlerini bul
      const bagliStoklar = stokHareketler.filter(sh => sh.bagli_fatura_id === r.id).map(sh => ({
        id: sh.id,
        urunId: sh.urun_id,
        urunAdi: sh.urun_adi || '',
        stokKodu: sh.stok_kodu || '',
        miktar: sh.miktar,
        birimFiyat: sh.birim_fiyat
      }));
      
      const totalAmount = parseFloat(r.alinan_ucret || 0);
      const odenen = parseFloat(r.odenen_tutar || 0);
      const kalan = r.kalan_tutar !== null && r.kalan_tutar !== undefined 
        ? parseFloat(r.kalan_tutar) 
        : (r.odeme_durumu === 'odendi' ? 0 : Math.max(0, totalAmount - odenen));

      let cleanPdf = r.pdf_dosya;
      if (cleanPdf && (cleanPdf.startsWith('data:') || (cleanPdf.length > 500 && !cleanPdf.startsWith('/uploads/') && !cleanPdf.startsWith('http')))) {
        const diskPath = saveBase64File(cleanPdf, r.pdf_dosya_adi || `satis_${r.fatura_no || r.id}.pdf`, 'faturalar');
        if (diskPath && diskPath.startsWith('/uploads/')) {
          cleanPdf = diskPath;
          client.execute({ sql: 'UPDATE satis_faturalari SET pdf_dosya = ? WHERE id = ?', args: [diskPath, r.id] }).catch(() => {});
        }
      }

      let cleanDekont = r.odeme_dekontu;
      if (cleanDekont && (cleanDekont.startsWith('data:') || (cleanDekont.length > 500 && !cleanDekont.startsWith('/uploads/') && !cleanDekont.startsWith('http')))) {
        const diskPath = saveBase64File(cleanDekont, r.odeme_dekontu_adi || 'dekont.pdf', 'dekontlar');
        if (diskPath && diskPath.startsWith('/uploads/')) {
          cleanDekont = diskPath;
          client.execute({ sql: 'UPDATE satis_faturalari SET odeme_dekontu = ? WHERE id = ?', args: [diskPath, r.id] }).catch(() => {});
        }
      }

      return { 
        id: r.id, faturaNo: r.fatura_no, tcVkn: r.tc_vkn, ad: r.ad, soyad: r.soyad, adres: r.adres, 
        kdvOrani: r.kdv_orani, alinanUcret: r.alinan_ucret, matrah: r.matrah, kdvTutari: r.kdv_tutari, 
        tevkifatOrani: r.tevkifat_orani, tevkifatTutari: r.tevkifat_tutari, tevkifatKodu: r.tevkifat_kodu, 
        stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, stopajKodu: r.stopaj_kodu, 
        muhasebeKodu: r.muhasebe_kodu, pdfDosya: cleanPdf, pdfDosyaAdi: r.pdf_dosya_adi, 
        faturaTarihi: r.fatura_tarihi, odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, 
        odemeDekontu: cleanDekont, odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, 
        vadeTarihi: r.vade_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi, 
        urunId: r.urun_id, depoId: r.depo_id,
        gibUuid: r.gib_uuid,
        lucaTransferredAt: r.luca_transferred_at || null,
        odenenTutar: odenen,
        kalanTutar: kalan,
        stokKalemleri: bagliStoklar.length > 0 ? bagliStoklar : undefined
      };
    });
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/satis-faturalari', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    const pdfPath = saveBase64File(f.pdfDosya, f.pdfDosyaAdi || 'satis_faturasi.pdf', 'faturalar');
    const dekontPath = saveBase64File(f.odemeDekontu, f.odemeDekontuAdi || 'dekont.pdf', 'dekontlar');

    await client.execute({
      sql: 'INSERT INTO satis_faturalari (id,fatura_no,tc_vkn,ad,soyad,adres,kdv_orani,alinan_ucret,matrah,kdv_tutari,tevkifat_orani,tevkifat_tutari,tevkifat_kodu,stopaj_orani,stopaj_tutari,stopaj_kodu,muhasebe_kodu,pdf_dosya,pdf_dosya_adi,fatura_tarihi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi,company_id,urun_id,depo_id,gib_uuid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.faturaNo),n(f.tcVkn),n(f.ad),n(f.soyad),n(f.adres),n(f.kdvOrani),n(f.alinanUcret),n(f.matrah),n(f.kdvTutari),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.tevkifatKodu),n(f.stopajOrani),n(f.stopajTutari),n(f.stopajKodu),n(f.muhasebeKodu),pdfPath,n(f.pdfDosyaAdi),n(f.faturaTarihi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),dekontPath,n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi),req.user.companyId,n(f.urunId),n(f.depoId),n(f.gibUuid)]
    });
    
    // Çoklu stok hareketleri oluştur
    const stokKalemleri = f.stokKalemleri || [];
    // Geriye uyumluluk: tek urunId varsa ve stokKalemleri boşsa, onu kullan
    if (stokKalemleri.length === 0 && f.urunId && f.urunId !== 'yok' && f.urunId !== '') {
      stokKalemleri.push({ urunId: f.urunId, miktar: 1, birimFiyat: parseFloat(f.matrah) || parseFloat(f.alinanUcret) || 0 });
    }
    
    if (stokKalemleri.length > 0) {
      await stockSyncService.syncInvoiceStockMovements(req.user.companyId, {
        faturaId: f.id,
        faturaTipi: 'satis',
        items: stokKalemleri,
        faturaNo: f.faturaNo,
        faturaTarihi: f.faturaTarihi,
        depoId: f.depoId
      }).catch(err => console.warn('Satış stok senkronizasyon hatası:', err.message));
    }
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/satis-faturalari/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    const pdfPath = f.pdfDosya !== undefined ? saveBase64File(f.pdfDosya, f.pdfDosyaAdi || 'satis_faturasi.pdf', 'faturalar') : undefined;
    const dekontPath = f.odemeDekontu !== undefined ? saveBase64File(f.odemeDekontu, f.odemeDekontuAdi || 'dekont.pdf', 'dekontlar') : undefined;

    await client.execute({
      sql: `UPDATE satis_faturalari SET 
        fatura_no=COALESCE(?,fatura_no),
        odeme_tarihi=COALESCE(?,odeme_tarihi),
        odeme_durumu=COALESCE(?,odeme_durumu),
        odeme_dekontu=COALESCE(?,odeme_dekontu),
        odeme_dekontu_adi=COALESCE(?,odeme_dekontu_adi),
        pdf_dosya=COALESCE(?,pdf_dosya),
        pdf_dosya_adi=COALESCE(?,pdf_dosya_adi),
        muhasebe_kodu=COALESCE(?,muhasebe_kodu),
        tc_vkn=COALESCE(?,tc_vkn),
        ad=COALESCE(?,ad),
        soyad=COALESCE(?,soyad),
        adres=COALESCE(?,adres),
        aciklama=COALESCE(?,aciklama),
        urun_id=COALESCE(?,urun_id),
        depo_id=COALESCE(?,depo_id),
        gib_uuid=COALESCE(?,gib_uuid),
        kdv_orani=COALESCE(?,kdv_orani),
        alinan_ucret=COALESCE(?,alinan_ucret),
        matrah=COALESCE(?,matrah),
        kdv_tutari=COALESCE(?,kdv_tutari),
        tevkifat_orani=COALESCE(?,tevkifat_orani),
        tevkifat_tutari=COALESCE(?,tevkifat_tutari),
        stopaj_orani=COALESCE(?,stopaj_orani),
        stopaj_tutari=COALESCE(?,stopaj_tutari),
        fatura_tarihi=COALESCE(?,fatura_tarihi),
        vade_tarihi=COALESCE(?,vade_tarihi),
        tevkifat_kodu=COALESCE(?,tevkifat_kodu),
        stopaj_kodu=COALESCE(?,stopaj_kodu) 
      WHERE id=? AND company_id = ?`,
      args: [
        n(f.faturaNo), n(f.odemeTarihi), n(f.odemeDurumu), n(dekontPath), n(f.odemeDekontuAdi),
        n(pdfPath), n(f.pdfDosyaAdi), n(f.muhasebeKodu), n(f.tcVkn), n(f.ad),
        n(f.soyad), n(f.adres), n(f.aciklama), n(f.urunId), n(f.depoId),
        n(f.gibUuid), n(f.kdvOrani), n(f.alinanUcret), n(f.matrah), n(f.kdvTutari),
        n(f.tevkifatOrani), n(f.tevkifatTutari), n(f.stopajOrani), n(f.stopajTutari),
        n(f.faturaTarihi), n(f.vadeTarihi), n(f.tevkifatKodu), n(f.stopajKodu),
        req.params.id, req.user.companyId
      ]
    });

    const stokKalemleri = f.stokKalemleri || [];
    if (stokKalemleri.length === 0 && f.urunId && f.urunId !== 'yok' && f.urunId !== '') {
      stokKalemleri.push({ urunId: f.urunId, miktar: 1, birimFiyat: parseFloat(f.matrah) || parseFloat(f.alinanUcret) || 0 });
    }

    if (stokKalemleri.length > 0) {
      await stockSyncService.syncInvoiceStockMovements(req.user.companyId, {
        faturaId: req.params.id,
        faturaTipi: 'satis',
        items: stokKalemleri,
        faturaNo: f.faturaNo,
        faturaTarihi: f.faturaTarihi,
        depoId: f.depoId
      }).catch(err => console.warn('Satış güncelleme stok senkronizasyon hatası:', err.message));
    } else {
      // Eğer stok kalemi kalmadıysa eski hareketleri sil
      await client.execute({
        sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      });
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/satis-faturalari/:id', authMiddleware, async (req, res) => {
  try {
    await client.batch([
      {
        sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      },
      {
        sql: 'DELETE FROM satis_faturalari WHERE id=? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      }
    ], "write");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- ALIŞ FATURALARI ---
// ============================================================
router.get('/api/alis-faturalari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, mal_hizmet_adi, toplam_tutar, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, stopaj_orani, stopaj_tutari, kdv1, kdv10, kdv20, oiv_tutari, muhasebe_kodu, karsi_hesap_kodu, kdv_hesap_kodu, pdf_dosya, pdf_dosya_adi, odeme_tarihi, odeme_durumu, odeme_dekontu, odeme_dekontu_adi, cari_id, vade_tarihi, aciklama, olusturma_tarihi, urun_id, depo_id, vehicle_plate, gib_uuid, mahsup_satirlari, has_kkeg, luca_transferred_at, COALESCE(odenen_tutar, 0) as odenen_tutar, kalan_tutar FROM alis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    
    // Stok hareketlerini de çek
    // Stok hareketlerini ürün adlarıyla birlikte çek
    const stokRs = await client.execute({
      sql: `SELECT sh.id, sh.bagli_fatura_id, sh.urun_id, sh.miktar, sh.birim_fiyat,
                   u.urun_adi, u.stok_kodu
            FROM stok_hareketler sh
            LEFT JOIN stok_urunler u ON u.id = sh.urun_id
            WHERE sh.company_id = ? AND sh.tip = ?`,
      args: [req.user.companyId, 'GIRIS']
    });
    
    const stokHareketler = stokRs.rows;
    
    const mapped = rs.rows.map(r => {
      // Bu faturaya bağlı stok kalemlerini bul
      const bagliStoklar = stokHareketler.filter(sh => sh.bagli_fatura_id === r.id).map(sh => ({
        id: sh.id,
        urunId: sh.urun_id,
        urunAdi: sh.urun_adi || '',
        stokKodu: sh.stok_kodu || '',
        miktar: sh.miktar,
        birimFiyat: sh.birim_fiyat
      }));
      
      const totalAmount = parseFloat(r.toplam_tutar || 0);
      const odenen = parseFloat(r.odenen_tutar || 0);
      const kalan = r.kalan_tutar !== null && r.kalan_tutar !== undefined 
        ? parseFloat(r.kalan_tutar) 
        : (r.odeme_durumu === 'odendi' ? 0 : Math.max(0, totalAmount - odenen));

      let cleanPdf = r.pdf_dosya;
      if (cleanPdf && (cleanPdf.startsWith('data:') || (cleanPdf.length > 500 && !cleanPdf.startsWith('/uploads/') && !cleanPdf.startsWith('http')))) {
        const isExpense = (r.muhasebe_kodu && String(r.muhasebe_kodu).trim().startsWith('7')) ||
                          /whatsapp|image|jpeg|jpg|png|fis/i.test(r.pdf_dosya_adi || '') ||
                          cleanPdf.startsWith('data:image/');
        const folder = isExpense ? 'fisler' : 'faturalar';
        const diskPath = saveBase64File(cleanPdf, r.pdf_dosya_adi || (isExpense ? `fis_${r.fatura_no || r.id}.jpg` : `fatura_${r.fatura_no || r.id}.pdf`), folder);
        if (diskPath && diskPath.startsWith('/uploads/')) {
          cleanPdf = diskPath;
          client.execute({ sql: 'UPDATE alis_faturalari SET pdf_dosya = ? WHERE id = ?', args: [diskPath, r.id] }).catch(() => {});
        }
      }

      let cleanDekont = r.odeme_dekontu;
      if (cleanDekont && (cleanDekont.startsWith('data:') || (cleanDekont.length > 500 && !cleanDekont.startsWith('/uploads/') && !cleanDekont.startsWith('http')))) {
        const diskPath = saveBase64File(cleanDekont, r.odeme_dekontu_adi || 'dekont.pdf', 'dekontlar');
        if (diskPath && diskPath.startsWith('/uploads/')) {
          cleanDekont = diskPath;
          client.execute({ sql: 'UPDATE alis_faturalari SET odeme_dekontu = ? WHERE id = ?', args: [diskPath, r.id] }).catch(() => {});
        }
      }

      let parsedMahsup = undefined;
      if (r.mahsup_satirlari) {
        try {
          parsedMahsup = typeof r.mahsup_satirlari === 'string' ? JSON.parse(r.mahsup_satirlari) : r.mahsup_satirlari;
        } catch (e) {}
      }

      return { 
        id: r.id, faturaNo: r.fatura_no, faturaTarihi: r.fatura_tarihi, tedarikciAdi: r.tedarikci_adi, 
        tedarikciVkn: r.tedarikci_vkn, malHizmetAdi: r.mal_hizmet_adi, toplamTutar: r.toplam_tutar, 
        kdvOrani: r.kdv_orani, kdvTutari: r.kdv_tutari, matrah: r.matrah, tevkifatOrani: r.tevkifat_orani, 
        tevkifatTutari: r.tevkifat_tutari, stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, 
        kdv1: r.kdv1, kdv10: r.kdv10, kdv20: r.kdv20, oivTutari: r.oiv_tutari,
        muhasebeKodu: r.muhasebe_kodu, karsiHesapKodu: r.karsi_hesap_kodu, kdvHesapKodu: r.kdv_hesap_kodu, pdfDosya: cleanPdf, pdfDosyaAdi: r.pdf_dosya_adi, 
        odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, odemeDekontu: cleanDekont, 
        odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, vadeTarihi: r.vade_tarihi, 
        aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi, urunId: r.urun_id, depoId: r.depo_id,
        vehiclePlate: r.vehicle_plate,
        odenenTutar: odenen,
        kalanTutar: kalan,
        stokKalemleri: bagliStoklar.length > 0 ? bagliStoklar : undefined,
        mahsupSatirlari: parsedMahsup,
        hasKkeg: r.has_kkeg === 1 || r.has_kkeg === true,
        lucaTransferredAt: r.luca_transferred_at || null
      };
    });
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/api/alis-faturalari/:id', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM alis_faturalari WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (rs.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
    }
    const r = rs.rows[0];

    let cleanPdf = r.pdf_dosya;
    if (cleanPdf && (cleanPdf.startsWith('data:') || (cleanPdf.length > 500 && !cleanPdf.startsWith('/uploads/') && !cleanPdf.startsWith('http')))) {
      const isExpense = (r.muhasebe_kodu && String(r.muhasebe_kodu).trim().startsWith('7')) ||
                        /whatsapp|image|jpeg|jpg|png|fis/i.test(r.pdf_dosya_adi || '') ||
                        cleanPdf.startsWith('data:image/');
      const folder = isExpense ? 'fisler' : 'faturalar';
      const diskPath = saveBase64File(cleanPdf, r.pdf_dosya_adi || (isExpense ? `fis_${r.fatura_no || r.id}.jpg` : `fatura_${r.fatura_no || r.id}.pdf`), folder);
      if (diskPath && diskPath.startsWith('/uploads/')) {
        cleanPdf = diskPath;
        client.execute({ sql: 'UPDATE alis_faturalari SET pdf_dosya = ? WHERE id = ?', args: [diskPath, r.id] }).catch(() => {});
      }
    }

    let cleanDekont = r.odeme_dekontu;
    if (cleanDekont && (cleanDekont.startsWith('data:') || (cleanDekont.length > 500 && !cleanDekont.startsWith('/uploads/') && !cleanDekont.startsWith('http')))) {
      const diskPath = saveBase64File(cleanDekont, r.odeme_dekontu_adi || 'dekont.pdf', 'dekontlar');
      if (diskPath && diskPath.startsWith('/uploads/')) {
        cleanDekont = diskPath;
        client.execute({ sql: 'UPDATE alis_faturalari SET odeme_dekontu = ? WHERE id = ?', args: [diskPath, r.id] }).catch(() => {});
      }
    }

    let parsedMahsup = undefined;
    if (r.mahsup_satirlari) {
      try {
        parsedMahsup = typeof r.mahsup_satirlari === 'string' ? JSON.parse(r.mahsup_satirlari) : r.mahsup_satirlari;
      } catch (e) {}
    }

    const totalAmount = parseFloat(r.toplam_tutar || 0);
    const odenen = parseFloat(r.odenen_tutar || 0);
    const kalan = r.kalan_tutar !== null && r.kalan_tutar !== undefined
      ? parseFloat(r.kalan_tutar)
      : (r.odeme_durumu === 'odendi' ? 0 : Math.max(0, totalAmount - odenen));

    const fatura = {
      id: r.id, faturaNo: r.fatura_no, faturaTarihi: r.fatura_tarihi, tedarikciAdi: r.tedarikci_adi, 
      tedarikciVkn: r.tedarikci_vkn, malHizmetAdi: r.mal_hizmet_adi, toplamTutar: r.toplam_tutar, 
      kdvOrani: r.kdv_orani, kdvTutari: r.kdv_tutari, matrah: r.matrah, tevkifatOrani: r.tevkifat_orani, 
      tevkifatTutari: r.tevkifat_tutari, stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, 
      kdv1: r.kdv1, kdv10: r.kdv10, kdv20: r.kdv20, oivTutari: r.oiv_tutari,
      muhasebeKodu: r.muhasebe_kodu, karsiHesapKodu: r.karsi_hesap_kodu, kdvHesapKodu: r.kdv_hesap_kodu, pdfDosya: cleanPdf, pdfDosyaAdi: r.pdf_dosya_adi, 
      odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, odemeDekontu: cleanDekont, 
      odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, vadeTarihi: r.vade_tarihi, 
      aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi, urunId: r.urun_id, depoId: r.depo_id,
      vehiclePlate: r.vehicle_plate,
      gibUuid: r.gib_uuid,
      odenenTutar: odenen,
      kalanTutar: kalan,
      mahsupSatirlari: parsedMahsup,
      hasKkeg: r.has_kkeg === 1 || r.has_kkeg === true
    };
    res.json({ success: true, data: fatura });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/alis-faturalari', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    const isExpense = f.muhasebeKodu && String(f.muhasebeKodu).trim().startsWith('7');
    const folder = isExpense ? 'fisler' : 'faturalar';
    const pdfPath = saveBase64File(f.pdfDosya, f.pdfDosyaAdi || (isExpense ? 'fis.jpg' : 'alis_faturasi.pdf'), folder);
    const dekontPath = saveBase64File(f.odemeDekontu, f.odemeDekontuAdi || 'dekont.pdf', 'dekontlar');
    const mahsupJson = f.mahsupSatirlari ? (typeof f.mahsupSatirlari === 'string' ? f.mahsupSatirlari : JSON.stringify(f.mahsupSatirlari)) : null;
    const hasKkegVal = f.hasKkeg ? 1 : 0;

    await client.execute({
      sql: 'INSERT INTO alis_faturalari (id,fatura_no,fatura_tarihi,tedarikci_adi,tedarikci_vkn,mal_hizmet_adi,toplam_tutar,kdv_orani,kdv_tutari,matrah,tevkifat_orani,tevkifat_tutari,stopaj_orani,stopaj_tutari,muhasebe_kodu,karsi_hesap_kodu,kdv_hesap_kodu,pdf_dosya,pdf_dosya_adi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi,company_id,urun_id,depo_id,vehicle_plate,kdv1,kdv10,kdv20,oiv_tutari,mahsup_satirlari,has_kkeg) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.faturaNo),n(f.faturaTarihi),n(f.tedarikciAdi),n(f.tedarikciVkn),n(f.malHizmetAdi),n(f.toplamTutar),n(f.kdvOrani),n(f.kdvTutari),n(f.matrah),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.stopajOrani),n(f.stopajTutari),n(f.muhasebeKodu),n(f.karsiHesapKodu),n(f.kdvHesapKodu),pdfPath,n(f.pdfDosyaAdi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),dekontPath,n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi),req.user.companyId,n(f.urunId),n(f.depoId),n(f.vehiclePlate),n(f.kdv1),n(f.kdv10),n(f.kdv20),n(f.oivTutari),mahsupJson,hasKkegVal]
    });
    
    // Çoklu stok hareketleri oluştur (GIRIS - alış = stoğa giriş)
    const stokKalemleriAlis = f.stokKalemleri || [];
    if (stokKalemleriAlis.length === 0 && f.urunId && f.urunId !== 'yok' && f.urunId !== '') {
      stokKalemleriAlis.push({ urunId: f.urunId, miktar: 1, birimFiyat: parseFloat(f.matrah) || parseFloat(f.toplamTutar) || 0 });
    }
    
    if (stokKalemleriAlis.length > 0) {
      await stockSyncService.syncInvoiceStockMovements(req.user.companyId, {
        faturaId: f.id,
        faturaTipi: 'alis',
        items: stokKalemleriAlis,
        faturaNo: f.faturaNo,
        faturaTarihi: f.faturaTarihi,
        depoId: f.depoId,
        muhasebeKodu: f.muhasebeKodu
      }).catch(err => console.warn('Alış stok senkronizasyon hatası:', err.message));
    }
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/alis-faturalari/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    const isExpense = f.muhasebeKodu && String(f.muhasebeKodu).trim().startsWith('7');
    const folder = isExpense ? 'fisler' : 'faturalar';
    const pdfPath = f.pdfDosya !== undefined ? saveBase64File(f.pdfDosya, f.pdfDosyaAdi || (isExpense ? 'fis.jpg' : 'alis_faturasi.pdf'), folder) : undefined;
    const dekontPath = f.odemeDekontu !== undefined ? saveBase64File(f.odemeDekontu, f.odemeDekontuAdi || 'dekont.pdf', 'dekontlar') : undefined;
    const mahsupJson = f.mahsupSatirlari !== undefined ? (f.mahsupSatirlari ? (typeof f.mahsupSatirlari === 'string' ? f.mahsupSatirlari : JSON.stringify(f.mahsupSatirlari)) : null) : undefined;
    const hasKkegVal = f.hasKkeg !== undefined ? (f.hasKkeg ? 1 : 0) : undefined;

    await client.execute({
      sql: `UPDATE alis_faturalari SET 
        odeme_tarihi=COALESCE(?,odeme_tarihi),
        odeme_durumu=COALESCE(?,odeme_durumu),
        odeme_dekontu=COALESCE(?,odeme_dekontu),
        odeme_dekontu_adi=COALESCE(?,odeme_dekontu_adi),
        pdf_dosya=COALESCE(?,pdf_dosya),
        pdf_dosya_adi=COALESCE(?,pdf_dosya_adi),
        vehicle_plate=COALESCE(?,vehicle_plate),
        fatura_no=COALESCE(?,fatura_no),
        fatura_tarihi=COALESCE(?,fatura_tarihi),
        tedarikci_adi=COALESCE(?,tedarikci_adi),
        tedarikci_vkn=COALESCE(?,tedarikci_vkn),
        mal_hizmet_adi=COALESCE(?,mal_hizmet_adi),
        toplam_tutar=COALESCE(?,toplam_tutar),
        kdv_orani=COALESCE(?,kdv_orani),
        kdv_tutari=COALESCE(?,kdv_tutari),
        matrah=COALESCE(?,matrah),
        tevkifat_orani=COALESCE(?,tevkifat_orani),
        tevkifat_tutari=COALESCE(?,tevkifat_tutari),
        stopaj_orani=COALESCE(?,stopaj_orani),
        stopaj_tutari=COALESCE(?,stopaj_tutari),
        kdv1=COALESCE(?,kdv1),
        kdv10=COALESCE(?,kdv10),
        kdv20=COALESCE(?,kdv20),
        oiv_tutari=COALESCE(?,oiv_tutari),
        muhasebe_kodu=COALESCE(?,muhasebe_kodu),
        karsi_hesap_kodu=COALESCE(?,karsi_hesap_kodu),
        kdv_hesap_kodu=COALESCE(?,kdv_hesap_kodu),
        aciklama=COALESCE(?,aciklama),
        vade_tarihi=COALESCE(?,vade_tarihi),
        mahsup_satirlari=COALESCE(?,mahsup_satirlari),
        has_kkeg=COALESCE(?,has_kkeg)
      WHERE id=? AND company_id = ?`,
      args: [
        n(f.odemeTarihi), n(f.odemeDurumu), n(dekontPath), n(f.odemeDekontuAdi),
        n(pdfPath), n(f.pdfDosyaAdi), n(f.vehiclePlate), n(f.faturaNo),
        n(f.faturaTarihi), n(f.tedarikciAdi), n(f.tedarikciVkn), n(f.malHizmetAdi),
        n(f.toplamTutar), n(f.kdvOrani), n(f.kdvTutari), n(f.matrah),
        n(f.tevkifatOrani), n(f.tevkifatTutari), n(f.stopajOrani), n(f.stopajTutari),
        n(f.kdv1), n(f.kdv10), n(f.kdv20),
        n(f.oivTutari), n(f.muhasebeKodu), n(f.karsiHesapKodu), n(f.kdvHesapKodu), n(f.aciklama), n(f.vadeTarihi),
        mahsupJson !== undefined ? n(mahsupJson) : null,
        hasKkegVal !== undefined ? n(hasKkegVal) : null,
        req.params.id, req.user.companyId
      ]
    });

    const stokKalemleriAlis = f.stokKalemleri || [];
    if (stokKalemleriAlis.length === 0 && f.urunId && f.urunId !== 'yok' && f.urunId !== '') {
      stokKalemleriAlis.push({ urunId: f.urunId, miktar: 1, birimFiyat: parseFloat(f.matrah) || parseFloat(f.toplamTutar) || 0 });
    }

    if (stokKalemleriAlis.length > 0) {
      await stockSyncService.syncInvoiceStockMovements(req.user.companyId, {
        faturaId: req.params.id,
        faturaTipi: 'alis',
        items: stokKalemleriAlis,
        faturaNo: f.faturaNo,
        faturaTarihi: f.faturaTarihi,
        depoId: f.depoId,
        muhasebeKodu: f.muhasebeKodu
      }).catch(err => console.warn('Alış güncelleme stok senkronizasyon hatası:', err.message));
    } else {
      // Kalem kalmadıysa eski stok hareketlerini sil
      await client.execute({
        sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      });
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Kritik Seviyedeki Stok Ürünlerini Listele

router.delete('/api/alis-faturalari/:id', authMiddleware, async (req, res) => {
  try {
    // 1. Faturayı bul ve diskteki dosyaları temizle
    const rs = await client.execute({
      sql: 'SELECT pdf_dosya, odeme_dekontu FROM alis_faturalari WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (rs.rows.length > 0) {
      const f = rs.rows[0];
      [f.pdf_dosya, f.odeme_dekontu].forEach(filePath => {
        if (filePath && typeof filePath === 'string' && filePath.startsWith('/uploads/')) {
          try {
            const diskFull = path.join(uploadsDir, filePath.replace(/^\/uploads\//, ''));
            if (fs.existsSync(diskFull)) fs.unlinkSync(diskFull);
          } catch (err) {}
        }
      });
    }

    // 2. Stok, Cari ve Alış faturası kayıtlarını her yerden sil
    await client.batch([
      {
        sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      },
      {
        sql: 'DELETE FROM cari_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      },
      {
        sql: 'DELETE FROM alis_faturalari WHERE id=? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      }
    ], "write");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- CEK SENET, BANKA, KESILECEK ---
// ============================================================

export default router;
