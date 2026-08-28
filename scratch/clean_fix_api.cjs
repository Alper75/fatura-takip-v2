const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '../api/index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Find app.get('/api/elogo/gelen-faturalar' ... to app.get('/api/elogo/giden-faturalar'
const startToken = "app.get('/api/elogo/gelen-faturalar', authMiddleware, async (req, res) => {";
const endToken = "app.get('/api/elogo/giden-faturalar', authMiddleware, async (req, res) => {";

const startIdx = content.indexOf(startToken);
const endIdx = content.indexOf(endToken);

if (startIdx !== -1 && endIdx !== -1) {
  const perfectEndpoint = `app.get('/api/elogo/gelen-faturalar', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    
    // Fetch settings
    const keys = ['elogo_username', 'elogo_password', 'elogo_is_test'];
    const placeholders = keys.map(() => '?').join(',');
    const rsSettings = await client.execute({
      sql: \`SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (\${placeholders})\`,
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

    // opType = 2 for INCOMING, dateBy = 1 (Fatura Düzenleme Tarihi)
    const response = await elogo.getDocumentList('EINVOICE', beginDate, endDate, 2, 1);
    console.log('eLogo Gelen GetDocumentList response:', JSON.stringify(response, null, 2));

    if (!response.success) {
      return res.status(500).json({ success: false, message: response.message });
    }
    
    const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
    const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
    
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });
    
    // 1. Veritabanında zaten kayıtlı olan faturaları anında eşle
    const existingInvoicesRs = await client.execute({
      sql: 'SELECT id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, toplam_tutar, matrah, kdv_orani, kdv_tutari, oiv_tutari, mal_hizmet_adi, aciklama, gib_uuid FROM alis_faturalari WHERE company_id = ?',
      args: [companyId]
    });
    const existingMap = new Map();
    for (const row of existingInvoicesRs.rows) {
      if (row.gib_uuid) existingMap.set(String(row.gib_uuid).toLowerCase().trim(), row);
      if (row.fatura_no) existingMap.set(String(row.fatura_no).toLowerCase().trim(), row);
    }

    const fetchInvoiceDetails = async (doc) => {
      try {
        const uuid = doc.documentUuid || doc.uuid;
        const docId = doc.documentId || '';
        
        // Eğer veritabanımızda varsa doğrudan veritabanından al
        const exByUuid = uuid ? existingMap.get(String(uuid).toLowerCase().trim()) : null;
        const exByNo = docId ? existingMap.get(String(docId).toLowerCase().trim()) : null;
        const ex = exByUuid || exByNo;
        if (ex) {
          return {
            ...doc,
            faturaNo: ex.fatura_no || docId,
            uuid: ex.gib_uuid || uuid,
            senderName: ex.tedarikci_adi || 'Kayıtlı Cari',
            senderVkn: ex.tedarikci_vkn || '-',
            issueDate: ex.fatura_tarihi,
            payableAmount: parseFloat(ex.toplam_tutar) || 0,
            currencyCode: 'TRY',
            matrah: parseFloat(ex.matrah) || 0,
            kdvOrani: parseFloat(ex.kdv_orani) || 20,
            kdvTutari: parseFloat(ex.kdv_tutari) || 0,
            oivTutari: parseFloat(ex.oiv_tutari) || 0,
            faturaAciklama: ex.aciklama || ex.mal_hizmet_adi || 'Kayıtlı Alış Faturası',
            isAlreadySaved: true
          };
        }

        if (!uuid) return { ...doc, senderName: 'Geçersiz UUID', faturaNo: doc.documentId || '-' };
        
        const docDataRes = await elogo.getDocumentData(uuid);
        if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) {
           console.log(\`GetDocumentData failed for UUID \${uuid}. Response:\`, JSON.stringify(docDataRes));
           const errMsg = docDataRes.data?.GetDocumentDataResult?.resultMsg || docDataRes.message || 'Hata';
           return { ...doc, senderName: 'XML Alınamadı (' + errMsg + ')', faturaNo: doc.documentId || '-' };
        }
        
        const base64Data = docDataRes.data.document.binaryData.Value;
        const buffer = Buffer.from(base64Data, 'base64');
        let xmlString = '';
        
        // ZIP (PK) or XML (<)
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
        
        const supplierParty = inv['AccountingSupplierParty']?.['Party'];
        let senderName = 'Bilinmiyor';
        let senderVkn = '-';
        
        if (supplierParty) {
          const partyName = Array.isArray(supplierParty['PartyName']) ? supplierParty['PartyName'][0] : supplierParty['PartyName'];
          senderName = getText(partyName?.['Name']) || getText(supplierParty['PartyLegalEntity']?.['RegistrationName']) || getText(supplierParty['Person']?.['FirstName']) + ' ' + getText(supplierParty['Person']?.['FamilyName']);
          
          const idNode = supplierParty['PartyIdentification'];
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

        const withholdingTaxTotal = inv['WithholdingTaxTotal'];
        const withhTotalArray = Array.isArray(withholdingTaxTotal) ? withholdingTaxTotal : (withholdingTaxTotal ? [withholdingTaxTotal] : []);
        for (const wt of withhTotalArray) {
          const subtotals = wt['TaxSubtotal'];
          if (!subtotals) continue;
          const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
          for (const sub of subArr) {
             const taxCat = sub['TaxCategory'];
             const taxScheme = taxCat?.['TaxScheme']?.['TaxTypeCode']?.['#text'] || taxCat?.['TaxScheme']?.['TaxTypeCode'];
             const taxCode = getText(taxScheme);
             const percent = parseFloat(getText(sub['Percent'])) || parseFloat(getText(taxCat?.['Percent'])) || 0;
             const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
             
             if (taxCode === '0003' || String(taxCode).includes('Stopaj')) {
                stopajTutari += amount;
                stopajOrani = percent;
             } else {
                tevkifatTutari += amount;
                tevkifatOrani = percent;
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
          faturaAciklama = 'eLogo Gelen Fatura';
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
          oivTutari,
          faturaAciklama
        };
      } catch (err) {
        console.error('Invoice parse error for UUID', doc.documentUuid, err);
        return { ...doc, senderName: 'Hata', faturaNo: doc.documentId || '-' };
      }
    };

    // Faturaları 15'erli paralel paketler halinde çek
    const pLimit = 15;
    const formattedDocs = [];
    for (let i = 0; i < documents.length; i += pLimit) {
      const chunk = documents.slice(i, i + pLimit);
      const chunkResults = await Promise.all(chunk.map(d => fetchInvoiceDetails(d)));
      formattedDocs.push(...chunkResults);
    }

    res.json({ success: true, veriler: formattedDocs, rawLogoResponse: response.data });
  } catch (error) {
    console.error('eLogo gelen faturalar hatası:', error);
    res.status(500).json({ success: false, message: 'Gelen faturalar alınamadı: ' + error.message });
  }
});\n\n`;

  content = content.substring(0, startIdx) + perfectEndpoint + content.substring(endIdx);
  fs.writeFileSync(indexPath, content, 'utf8');
  console.log('Fixed /api/elogo/gelen-faturalar perfectly!');
}
