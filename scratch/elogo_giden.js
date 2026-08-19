app.get('/api/elogo/giden-faturalar', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    
    // Fetch settings
    const keys = ['elogo_username', 'elogo_password', 'elogo_is_test'];
    const placeholders = keys.map(() => '?').join(',');
    const rsSettings = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [companyId, ...keys]
    });
    const settings = { elogo_is_test: 'false' };
    for (const row of rsSettings.rows) settings[row.setting_key] = row.setting_value;
    
    if (!settings.elogo_username || !settings.elogo_password) {
      return res.status(400).json({ success: false, message: 'Logo ayarları eksik. Lütfen önce ayarları yapın.' });
    }

    const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
    
    let beginDate, endDate;
    if (req.query.baslangic && req.query.bitis) {
      beginDate = req.query.baslangic;
      endDate = req.query.bitis;
    } else {
      endDate = new Date().toISOString();
      const beginDateObj = new Date();
      beginDateObj.setDate(beginDateObj.getDate() - 30); // Last 30 days
      beginDate = beginDateObj.toISOString();
    }

    // opType = 1 for OUTBOX
    const response = await elogo.getDocumentList('EINVOICE', beginDate, endDate, 1);
    console.log('eLogo Giden GetDocumentList response:', JSON.stringify(response, null, 2));

    if (!response.success) {
      return res.status(500).json({ success: false, message: response.message });
    }
    
    const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
    const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
    
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true });
    
    const fetchInvoiceDetails = async (doc) => {
      try {
        const uuid = doc.documentUuid || doc.uuid;
        if (!uuid) return { ...doc, senderName: 'Geçersiz UUID', faturaNo: doc.documentId || '-' };
        
        const docDataRes = await elogo.getDocumentData(uuid);
        if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) {
           console.log(`GetDocumentData failed for UUID ${uuid}. Response:`, JSON.stringify(docDataRes));
           const errMsg = docDataRes.data?.GetDocumentDataResult?.resultMsg || docDataRes.message || 'Hata';
           return { ...doc, senderName: 'XML Alınamadı (' + errMsg + ')', faturaNo: doc.documentId || '-' };
        }
        
        const base64Data = docDataRes.data.document.binaryData.Value;
        const buffer = Buffer.from(base64Data, 'base64');
        let xmlString = '';
        
        if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
           const zip = new AdmZip(buffer);
           const zipEntries = zip.getEntries();
           if (zipEntries.length > 0) {
             xmlString = zipEntries[0].getData().toString('utf8');
           }
        } else {
           xmlString = buffer.toString('utf8');
        }
        
        if (!xmlString) return { ...doc, senderName: 'XML Boş', faturaNo: doc.documentId || '-' };
        
        const parsed = ublParser.parse(xmlString);
        const inv = parsed.Invoice;
        if (!inv) return { ...doc, senderName: 'Geçersiz XML', faturaNo: doc.documentId || '-' };
        
        const getText = (node) => (typeof node === 'object' && node !== null) ? (node['#text'] || '') : (node || '');
        
        // Giden faturada müşteri bilgisi AccountingCustomerParty içindedir.
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
        const faturaNo = getText(inv['ID']) || doc.documentId || '';
        const totals = inv['LegalMonetaryTotal'];
        
        const payableAmount = parseFloat(getText(totals?.['PayableAmount'])) || 0;
        const currencyCode = (typeof totals?.['PayableAmount'] === 'object' ? totals['PayableAmount']['@_currencyID'] : 'TRY') || 'TRY';
        const matrah = parseFloat(getText(totals?.['TaxExclusiveAmount'])) || 0;
        
        let kdvTutari = 0;
        let kdvOrani = 0;
        let oivTutari = 0;
        const taxTotal = inv['TaxTotal'];
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
            
            if (taxCode === '0015' || taxCode === '15' || taxCode === 15 || !taxCode) {
              kdvTutari += amount;
              kdvOrani = percent; 
            } else {
              oivTutari += amount;
            }
          }
        }

        const lines = inv['InvoiceLine'];
        const lineArr = Array.isArray(lines) ? lines : (lines ? [lines] : []);
        let faturaAciklama = lineArr.map(l => getText(l?.['Item']?.['Name'])).filter(n => n).join(', ');
        
        if (!faturaAciklama) {
          const notes = inv['Note'];
          const noteArray = Array.isArray(notes) ? notes : (notes ? [notes] : []);
          faturaAciklama = noteArray.map(n => getText(n)).filter(n => n).join(' - ');
        }
        
        if (!faturaAciklama) {
          faturaAciklama = 'eLogo Giden Fatura';
        }

        return {
          ...doc,
          faturaNo,
          uuid,
          senderName, // Bu aslında alıcı adı ama frontend'de aynı kolon adını kullanıyoruz
          senderVkn,  // Bu aslında alıcı vkn
          issueDate,
          payableAmount,
          currencyCode,
          matrah,
          kdvOrani,
          kdvTutari,
          oivTutari,
          faturaAciklama
        };
      } catch (err) {
        console.error('Invoice parse error for UUID', doc.documentUuid, err);
        return { ...doc, senderName: 'Hata', faturaNo: doc.documentId || '-' };
      }
    };

    const formattedDocs = await Promise.all(documents.map(d => fetchInvoiceDetails(d)));

    res.json({ success: true, veriler: formattedDocs, rawLogoResponse: response.data });
  } catch (error) {
    console.error('eLogo giden faturalar hatası:', error);
    res.status(500).json({ success: false, message: 'Giden faturalar alınamadı: ' + error.message });
  }
});
