app.get('/api/uyumsoft/giden-faturalar', authMiddleware, async (req, res) => {
  try {
    let { baslangic, bitis } = req.query; let beginDate = baslangic; let endDate = bitis;
    
    if (!beginDate || !endDate) {
      endDate = new Date().toISOString();
      const beginDateObj = new Date();
      beginDateObj.setDate(beginDateObj.getDate() - 30); // Son 30 gün
      beginDate = beginDateObj.toISOString();
    }

    const keys = ['uyumsoft_username', 'uyumsoft_password', 'uyumsoft_is_test'];
    const db = getDb();
    const rows = await db.all(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`, keys);
    
    const settings = { uyumsoft_is_test: 'false' };
    rows.forEach(r => { settings[r.key] = r.value; });

    if (!settings.uyumsoft_username || !settings.uyumsoft_password) {
      return res.status(400).json({ success: false, message: 'Uyumsoft bilgileri eksik' });
    }

    const uyumsoft = new UyumsoftClient(settings.uyumsoft_username, settings.uyumsoft_password, settings.uyumsoft_is_test === 'true');
    const response = await uyumsoft.getDocumentList('EINVOICE', beginDate, endDate, 1 /* OUTBOX */);

    if (!response.success) {
      return res.status(500).json({ success: false, message: response.message });
    }
    
    const docListRaw = response.data?.docList?.Document || [];
    const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
    
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true });
    
    const fetchInvoiceDetails = async (doc) => {
      try {
        if (doc.isPrePopulated) return doc;

        const uuid = doc.documentUuid || doc.uuid;
        if (!uuid) return { ...doc, senderName: 'Geçersiz UUID', faturaNo: doc.documentId || '-' };
        
        const docDataRes = await uyumsoft.getDocumentData(uuid);
        if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) {
           return { ...doc, senderName: 'XML Alınamadı', faturaNo: doc.documentId || '-' };
        }
        
        const base64Data = docDataRes.data.document.binaryData.Value;
        const buffer = Buffer.from(base64Data, 'base64');
        let xmlString = buffer.toString('utf8');
        if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
           const zip = new AdmZip(buffer);
           const zipEntries = zip.getEntries();
           if (zipEntries.length > 0) xmlString = zipEntries[0].getData().toString('utf8');
        }
        
        if (!xmlString) return { ...doc, senderName: 'XML Boş', faturaNo: doc.documentId || '-' };
        
        const parsed = ublParser.parse(xmlString);
        const inv = parsed.Invoice;
        if (!inv) return { ...doc, senderName: 'Geçersiz XML', faturaNo: doc.documentId || '-' };
        
        const getText = (node) => (typeof node === 'object' && node !== null) ? (node['#text'] || '') : (node || '');
        
        const customerParty = inv['AccountingCustomerParty']?.['Party'];
        let senderName = 'Bilinmiyor';
        let senderVkn = '-';
        
        if (customerParty) {
          const partyName = Array.isArray(customerParty['PartyName']) ? customerParty['PartyName'][0] : customerParty['PartyName'];
          senderName = getText(partyName?.['Name']) || getText(customerParty['PartyLegalEntity']?.['RegistrationName']) || getText(customerParty['Person']?.['FirstName']) + ' ' + getText(customerParty['Person']?.['FamilyName']);
          
          const idNode = customerParty['PartyIdentification'];
          const idArray = Array.isArray(idNode) ? idNode : (idNode ? [idNode] : []);
          for (const ident of idArray) {
             const id = ident['ID'];
             if (!id) continue;
             const isVkn = id['@_schemeID'] === 'VKN' || id['@_schemeID'] === 'TCKN';
             const val = isVkn ? id['#text'] : (id['#text'] || id);
             if (val) {
               senderVkn = String(val).replace('.0', '');
               break;
             }
          }
        }
        
        const issueDate = getText(inv['IssueDate']);
        const payableAmount = parseFloat(getText(inv['LegalMonetaryTotal']?.['PayableAmount']) || 0);
        const currencyCode = inv['DocumentCurrencyCode'] ? getText(inv['DocumentCurrencyCode']) : 'TRY';
        const faturaNo = getText(inv['ID']);
        const matrah = parseFloat(getText(inv['LegalMonetaryTotal']?.['TaxExclusiveAmount']) || 0);
        
        const taxTotal = inv['TaxTotal'];
        const taxArray = Array.isArray(taxTotal) ? taxTotal : (taxTotal ? [taxTotal] : []);
        let kdvTutari = 0;
        let kdvOrani = 0;
        
        for (const t of taxArray) {
          const subTaxes = t['TaxSubtotal'];
          const subTaxArray = Array.isArray(subTaxes) ? subTaxes : (subTaxes ? [subTaxes] : []);
          for (const st of subTaxArray) {
             const code = getText(st['TaxCategory']?.['TaxScheme']?.['TaxTypeCode']);
             if (code === '0015' || !code) {
               kdvTutari += parseFloat(getText(st['TaxAmount']) || 0);
               kdvOrani = parseFloat(getText(st['TaxCategory']?.['Percent']) || 0);
             }
          }
        }
        
        return {
          ...doc,
          faturaNo,
          uuid,
          senderName,
          senderVkn,
          issueDate,
          payableAmount,
          currencyCode,
          matrah,
          kdvOrani,
          kdvTutari,
          oivTutari: 0,
          faturaAciklama: 'Uyumsoft Giden Fatura'
        };
      } catch (err) {
        return { ...doc, senderName: 'Hata', faturaNo: doc.documentId || '-' };
      }
    };

    const formattedDocs = await Promise.all(documents.map(d => fetchInvoiceDetails(d)));
    res.json({ success: true, veriler: formattedDocs, rawLogoResponse: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Giden faturalar alınamadı: ' + error.message });
  }
});

app.get('/api/uyumsoft/giden-esmm', authMiddleware, async (req, res) => {
  try {
    let { baslangic, bitis } = req.query; let beginDate = baslangic; let endDate = bitis;
    
    if (!beginDate || !endDate) {
      endDate = new Date().toISOString();
      const beginDateObj = new Date();
      beginDateObj.setDate(beginDateObj.getDate() - 30); // Son 30 gün
      beginDate = beginDateObj.toISOString();
    }

    const keys = ['uyumsoft_username', 'uyumsoft_password', 'uyumsoft_is_test'];
    const db = getDb();
    const rows = await db.all(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`, keys);
    
    const settings = { uyumsoft_is_test: 'false' };
    rows.forEach(r => { settings[r.key] = r.value; });

    if (!settings.uyumsoft_username || !settings.uyumsoft_password) {
      return res.status(400).json({ success: false, message: 'Uyumsoft bilgileri eksik' });
    }

    const uyumsoft = new UyumsoftClient(settings.uyumsoft_username, settings.uyumsoft_password, settings.uyumsoft_is_test === 'true');
    const response = await uyumsoft.getVoucherList(beginDate, endDate, 1 /* OUTBOX */);

    if (!response.success) {
      return res.status(500).json({ success: false, message: response.message });
    }
    
    const docListRaw = response.data?.docList?.Document || [];
    const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
    
    // Uyumsoft getVoucherList already sets isPrePopulated=true and populates the fields
    res.json({ success: true, veriler: documents, rawLogoResponse: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Giden makbuzlar alınamadı: ' + error.message });
  }
});
