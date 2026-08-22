app.get('/api/uyumsoft/esmm-pdf/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    if (!uuid) return res.status(400).send('UUID eksik');
    
    const token = req.query.token;
    if (!token) return res.status(401).send('Yetkisiz');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'personnel_module_secret_88');
    
    const keys = ['uyumsoft_username', 'uyumsoft_password', 'uyumsoft_is_test'];
    const placeholders = keys.map(() => '?').join(',');
    const rsSettings = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [decoded.companyId, ...keys]
    });
    const settings = { uyumsoft_is_test: 'false' };
    for (const row of rsSettings.rows) settings[row.setting_key] = row.setting_value;
    
    if (!settings.uyumsoft_username || !settings.uyumsoft_password) {
      return res.status(400).send('Logo ayarları eksik.');
    }
    
    const elogo = new UyumsoftClient(settings.uyumsoft_username, settings.uyumsoft_password, settings.uyumsoft_is_test === 'true');
    const docDataRes = await elogo.getVoucherPdf(uuid);
    
    if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) {
       return res.status(404).send('PDF bulunamadı veya sunucu reddetti.');
    }
    
    const base64Data = docDataRes.data.document.binaryData.Value;
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
       const zip = new AdmZip(buffer);
       const zipEntries = zip.getEntries();
       const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
       
       if (pdfEntry) {
         return res.json({ success: true, base64: pdfEntry.getData().toString('base64'), filename: `${uuid}.pdf` });
       }
    }
    
    return res.json({ success: true, base64: buffer.toString('base64'), filename: `${uuid}.pdf` });
  } catch (error) {
    console.error('ESMM PDF indirme hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + error.message });
  }
});
