app.post('/api/invoices/import-satis', authMiddleware, async (req, res) => {
  const invoice = req.body;
  if (!invoice || !invoice.faturaNo) {
    return res.status(400).json({ success: false, message: 'Geçersiz belge verisi.' });
  }
  
  try {
    const { faturaNo, senderName, senderVkn, issueDate, payableAmount, currencyCode, uuid, matrah, kdvOrani, kdvTutari, oivTutari, faturaAciklama } = invoice;
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
          if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP
             const zip = new AdmZip(buffer);
             const zipEntries = zip.getEntries();
             const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
             if (pdfEntry) {
               pdfDosyaBase64 = `data:application/pdf;base64,${pdfEntry.getData().toString('base64')}`;
               pdfDosyaAdi = `${uuid}.pdf`;
             }
          } else {
             pdfDosyaBase64 = `data:application/pdf;base64,${base64Data}`;
             pdfDosyaAdi = `${uuid}.pdf`;
          }
        }
      }
      
      // eLogo yoksa veya çekemediyse Uyumsoft dene
      if (!pdfDosyaBase64 && settings.uyumsoft_username && settings.uyumsoft_password) {
        const { UyumsoftClient } = require('./services/uyumsoftClient.js');
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
          if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP
             const zip = new AdmZip(buffer);
             const zipEntries = zip.getEntries();
             const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
             if (pdfEntry) {
               pdfDosyaBase64 = `data:application/pdf;base64,${pdfEntry.getData().toString('base64')}`;
               pdfDosyaAdi = `${uuid}.pdf`;
             }
          } else {
             pdfDosyaBase64 = `data:application/pdf;base64,${base64Data}`;
             pdfDosyaAdi = `${uuid}.pdf`;
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
        (id, fatura_no, fatura_tarihi, ad, tc_vkn, mal_hizmet_adi, 
         alinan_ucret, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
         stopaj_orani, stopaj_tutari, muhasebe_kodu, pdf_dosya, pdf_dosya_adi, 
         odeme_tarihi, odeme_durumu, cari_id, vade_tarihi, aciklama, olusturma_tarihi, company_id, gib_uuid) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id, faturaNo, islemTarihi, senderName || 'Bilinmiyor', senderVkn || '', faturaAciklama || 'Entegratör Satış Faturası',
        payableAmount, kdvOrani || 0, kdvTutari || 0, matrah || 0, 0, 0,
        0, 0, '', pdfDosyaBase64, pdfDosyaAdi,
        null, 'odenmedi', null, null, faturaAciklama || '', new Date().toISOString(), req.user.companyId, uuid
      ]
    });

    res.json({ success: true, message: 'Belge satış listesine başarıyla eklendi.', id });
  } catch (error) {
    console.error('Import from Logo/Uyumsoft (satis) hatası:', error);
    res.status(500).json({ success: false, message: 'Belge kaydedilirken hata oluştu: ' + error.message });
  }
});
