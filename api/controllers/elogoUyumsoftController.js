import axios from 'axios';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { ElogoClient } from '../services/elogoClient.js';
import { UyumsoftClient } from '../services/uyumsoftClient.js';
import { UblBuilder } from '../services/ublBuilder.js';
import { autoInvoiceFetcher } from '../services/autoInvoiceFetcher.js';
import { stockSyncService } from '../services/stockSyncService.js';
import { evrenClient } from '../services/evrenClient.js';
import { saveBase64File, saveBufferFile, saveTextFile, getTextFileIfExists } from '../services/fileStorage.js';
import { xmlParser, n } from '../utils/shared.js';

export async function getIntegratorSettings(req, res) {
  try {
    const keys = [
      'active_integrator',
      'elogo_username', 'elogo_password', 'elogo_is_test',
      'uyumsoft_username', 'uyumsoft_password', 'uyumsoft_is_test'
    ];
    const placeholders = keys.map(() => '?').join(',');
    const rs = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [req.user.companyId, ...keys]
    });
    const settings = { elogo_is_test: 'false', uyumsoft_is_test: 'false', active_integrator: 'elogo' };
    for (const row of rs.rows) {
      settings[row.setting_key] = row.setting_value;
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Entegratör ayarları okuma hatası:', error);
    res.status(500).json({ success: false, message: 'Ayarlar okunamadı.' });
  }
}

export async function saveIntegratorSettings(req, res) {
  try {
    const { 
      active_integrator,
      elogo_username, elogo_password, elogo_is_test,
      uyumsoft_username, uyumsoft_password, uyumsoft_is_test
    } = req.body;
    
    const settings = { 
      active_integrator: active_integrator || 'elogo',
      elogo_username, 
      elogo_password, 
      elogo_is_test: elogo_is_test ? 'true' : 'false',
      uyumsoft_username,
      uyumsoft_password,
      uyumsoft_is_test: uyumsoft_is_test ? 'true' : 'false'
    };
    
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) continue;
      await client.execute({
        sql: `INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?)
              ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
        args: [req.user.companyId, key, value]
      });
    }
    res.json({ success: true, message: 'Entegratör ayarları kaydedildi.' });
  } catch (error) {
    console.error('Entegratör ayarları kaydetme hatası:', error);
    res.status(500).json({ success: false, message: 'Ayarlar kaydedilemedi: ' + error.message });
  }
}

export async function getAutoSyncSettings(req, res) {
  try {
    const settings = await autoInvoiceFetcher.getCompanySettings(req.user.companyId);
    const logs = await autoInvoiceFetcher.getLogs(req.user.companyId, 25);
    res.json({ success: true, settings, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function saveAutoSyncSettings(req, res) {
  try {
    const updates = req.body;
    await autoInvoiceFetcher.saveCompanySettings(req.user.companyId, updates);
    res.json({ success: true, message: 'Otomatik tarama ayarları başarıyla kaydedildi.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function runAutoSyncNow(req, res) {
  try {
    const result = await autoInvoiceFetcher.scanCompany(req.user.companyId, 'manual');
    const logs = await autoInvoiceFetcher.getLogs(req.user.companyId, 25);
    res.json({ ...result, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function getAutoSyncLogs(req, res) {
  try {
    const logs = await autoInvoiceFetcher.getLogs(req.user.companyId, 50);
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function sendElogoInvoice(req, res) {
  try {
    const faturaId = req.params.id;
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

    // Fetch Invoice
    const rsFatura = await client.execute({
      sql: 'SELECT * FROM satis_faturalari WHERE id = ? AND company_id = ?',
      args: [faturaId, companyId]
    });
    if (rsFatura.rows.length === 0) return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
    const faturaData = rsFatura.rows[0];

    // Fetch Customer
    const rsCari = await client.execute({
      sql: 'SELECT * FROM cariler WHERE id = ? AND company_id = ?',
      args: [faturaData.cari_id, companyId]
    });
    const customer = rsCari.rows[0] || {};

    // Fetch Company details (Supplier)
    const rsCompany = await client.execute({
      sql: 'SELECT * FROM companies WHERE id = ?',
      args: [companyId]
    });
    const supplier = rsCompany.rows[0] || {};

    // Fetch Items (satis_fatura_kalemleri tablosu yoksa faturaData'dan türet)
    const rsItems = await client.execute({
      sql: 'SELECT * FROM satis_fatura_kalemleri WHERE fatura_id = ?',
      args: [faturaId]
    }).catch(() => ({ rows: [] }));
    
    const faturaObj = {
      fatura_no: faturaData.fatura_no || `FAT${Date.now()}`,
      fatura_tarihi: faturaData.fatura_tarihi || faturaData.tarih || new Date().toISOString(),
      fatura_senaryo: 'TICARIFATURA',
      para_birimi: 'TRY',
      toplam_tutar: Number(faturaData.matrah || faturaData.toplam_tutar || faturaData.alinan_ucret || 0),
      toplam_kdv_tutar: Number(faturaData.kdv_tutari || faturaData.toplam_kdv || 0),
      genel_toplam: Number(faturaData.alinan_ucret || faturaData.genel_toplam || 0)
    };
    
    const customerObj = {
      firma_adi: customer.unvan || `${faturaData.ad || ''} ${faturaData.soyad || ''}`.trim(),
      vkn: customer.vkn_tckn || faturaData.tc_vkn,
      vergi_dairesi: customer.vergi_dairesi,
      adres: customer.adres || faturaData.adres,
      il: customer.il,
      ilce: customer.ilce
    };
    
    const supplierObj = {
      firma_adi: supplier.name,
      vkn: supplier.tax_no || '11111111111',
      vergi_dairesi: 'Merkez',
      adres: supplier.address
    };
    
    const items = rsItems.rows.length > 0 ? rsItems.rows.map(row => ({
      urun_adi: row.aciklama,
      miktar: Number(row.miktar || 0),
      birim_fiyat: Number(row.birim_fiyat || 0),
      kdv_orani: Number(row.kdv_orani || 0)
    })) : [{
      urun_adi: faturaData.aciklama || 'Satış Hizmet/Ürün Bedeli',
      miktar: 1,
      birim_fiyat: Number(faturaData.matrah || faturaData.alinan_ucret || 0),
      kdv_orani: Number(faturaData.kdv_orani || 20)
    }];

    const ublXml = UblBuilder.buildInvoiceXml(faturaObj, supplierObj, customerObj, items);
    
    // Zip XML
    const zip = new AdmZip();
    const xmlFilename = `${faturaObj.fatura_no}.xml`;
    zip.addFile(xmlFilename, Buffer.from(ublXml, 'utf8'));
    const zipBuffer = zip.toBuffer();
    const zipBase64 = zipBuffer.toString('base64');
    
    // eLogo Client
    const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
    const sendRes = await elogo.sendDocument('EINVOICE', zipBase64, `${faturaObj.fatura_no}.zip`);
    
    if (sendRes.success) {
      await client.execute({
        sql: 'UPDATE satis_faturalari SET gib_uuid = ? WHERE id = ?',
        args: [sendRes.refId, faturaId]
      });
      return res.json({ success: true, message: 'Fatura eLogo üzerinden başarıyla gönderildi.', refId: sendRes.refId });
    } else {
      return res.status(500).json({ success: false, message: sendRes.message });
    }

  } catch (error) {
    console.error('eLogo fatura gönderim hatası:', error);
    res.status(500).json({ success: false, message: 'Fatura gönderilemedi.' });
  }
}

export async function getElogoGelenFaturalar(req, res) {
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
    const existingMap = new Map();
    try {
      const existingInvoicesRs = await client.execute({
        sql: 'SELECT id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, toplam_tutar, matrah, kdv_orani, kdv_tutari, oiv_tutari, mal_hizmet_adi, aciklama, gib_uuid FROM alis_faturalari WHERE company_id = ?',
        args: [companyId]
      });
      for (const row of existingInvoicesRs.rows) {
        if (row.gib_uuid) existingMap.set(String(row.gib_uuid).toLowerCase().trim(), row);
        if (row.fatura_no) existingMap.set(String(row.fatura_no).toLowerCase().trim(), row);
      }
    } catch (dbErr) {
      console.warn('Existing invoices check warning:', dbErr.message);
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
           console.log(`GetDocumentData failed for UUID ${uuid}. Response:`, JSON.stringify(docDataRes));
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
        let matrah = parseFloat(getText(totals?.['TaxExclusiveAmount'])) || 0;
        
        let kdvTutari = 0;
        let kdvOrani = 0;
        let bestKdvWeight = -1;
        let oivTutari = 0;
        let kdv1 = 0;
        let kdv10 = 0;
        let kdv20 = 0;
        let kdvTaxableAmount = 0;
        let kdvBucketCount = 0;
        let stopajTutari = 0;
        let stopajOrani = 0;
        let tevkifatTutari = 0;
        let tevkifatOrani = 0;
        const taxTotal = inv['TaxTotal'];
        const taxTotalArray = Array.isArray(taxTotal) ? taxTotal : (taxTotal ? [taxTotal] : []);
        
        for (const tt of taxTotalArray) {
          const subtotals = tt['TaxSubtotal'];
          if (!subtotals) continue;
          const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
          for (const sub of subArr) {
            const taxCat = sub['TaxCategory'];
            const taxScheme = taxCat?.['TaxScheme']?.['TaxTypeCode']?.['#text'] || taxCat?.['TaxScheme']?.['TaxTypeCode'];
            const taxCode = String(getText(taxScheme) || '').trim();
            const percent = parseFloat(getText(sub['Percent'])) || parseFloat(getText(taxCat?.['Percent'])) || 0;
            const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
            const taxable = parseFloat(getText(sub['TaxableAmount'])) || 0;
            
            if (taxCode === '0015' || taxCode === '15' || !taxCode) {
              kdvTutari += amount;
              if (percent > 0) {
                const weight = taxable > 0 ? taxable : amount;
                if (weight > bestKdvWeight) {
                  bestKdvWeight = weight;
                  kdvOrani = percent;
                }
                kdvTaxableAmount += taxable;
                kdvBucketCount++;
                if (percent === 1) kdv1 += amount;
                else if (percent === 8 || percent === 10) kdv10 += amount;
                else if (percent === 18 || percent === 20) kdv20 += amount;
              }
            } else {
              oivTutari += amount;
            }
          }
        }

        // Vodafone / Telekom faturalarında KDV'den muaf Telsiz Kullanım Ücreti (TK Kullanım/Ruhsat)
        // TaxExclusiveAmount veya PayableAmount içinde yer alabilir; mahsup dengesi için oivTutari'ye ekle
        if (payableAmount > 0 && kdvTutari > 0 && tevkifatTutari === 0 && stopajTutari === 0) {
          if (kdvBucketCount === 1 && kdvTaxableAmount > 0 && matrah > kdvTaxableAmount + 0.02) {
            matrah = Math.round(kdvTaxableAmount * 100) / 100;
          }
          const fark = Math.round((payableAmount - matrah - kdvTutari - oivTutari) * 100) / 100;
          if (fark > 0.02) {
            oivTutari = Math.round((oivTutari + fark) * 100) / 100;
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
        let faturaAciklama = lineArr.map(l => getText(l?.['Item']?.['Name']) || getText(l?.['Item']?.['Description'])).filter(n => n).join(', ');
        
        if (!faturaAciklama) {
          const notes = inv['Note'];
          const noteArray = Array.isArray(notes) ? notes : (notes ? [notes] : []);
          faturaAciklama = noteArray.map(n => getText(n)).filter(n => n).join(' - ');
        }
        
        if (!faturaAciklama) {
          faturaAciklama = 'eLogo Gelen Fatura';
        }

        const items = lineArr.map(l => {
          const q = parseFloat(getText(l?.['InvoicedQuantity'])) || 1;
          const p = parseFloat(getText(l?.['Price']?.['PriceAmount'])) || (parseFloat(getText(l?.['LineExtensionAmount'])) / q) || 0;
          const itemName = getText(l?.['Item']?.['Name']) || 
                           getText(l?.['Item']?.['Description']) || 
                           getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) ||
                           getText(l?.['Item']?.['BuyersItemIdentification']?.['ID']) ||
                           'Mal/Hizmet';
          return {
            name: itemName,
            urunAdi: itemName,
            qty: q,
            miktar: q,
            price: p,
            birimFiyat: p,
            barcode: getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) || ''
          };
        });

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
          kdv1,
          kdv10,
          kdv20,
          oivTutari,
          stopajOrani,
          stopajTutari,
          tevkifatOrani,
          tevkifatTutari,
          faturaAciklama,
          items
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
}

export async function getElogoGidenFaturalar(req, res) {
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
    
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });
    
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
        let matrah = parseFloat(getText(totals?.['TaxExclusiveAmount'])) || 0;
        
        let kdvTutari = 0;
        let kdvOrani = 0;
        let bestKdvWeight = -1;
        let oivTutari = 0;
        let kdv1 = 0;
        let kdv10 = 0;
        let kdv20 = 0;
        let kdvTaxableAmount = 0;
        let kdvBucketCount = 0;
        let stopajTutari = 0;
        let stopajOrani = 0;
        let tevkifatTutari = 0;
        let tevkifatOrani = 0;
        const taxTotal = inv['TaxTotal'];
        const taxTotalArray = Array.isArray(taxTotal) ? taxTotal : (taxTotal ? [taxTotal] : []);
        
        for (const tt of taxTotalArray) {
          const subtotals = tt['TaxSubtotal'];
          if (!subtotals) continue;
          const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
          for (const sub of subArr) {
            const taxCat = sub['TaxCategory'];
            const taxScheme = taxCat?.['TaxScheme']?.['TaxTypeCode']?.['#text'] || taxCat?.['TaxScheme']?.['TaxTypeCode'];
            const taxCode = String(getText(taxScheme) || '').trim();
            const percent = parseFloat(getText(sub['Percent'])) || parseFloat(getText(taxCat?.['Percent'])) || 0;
            const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
            const taxable = parseFloat(getText(sub['TaxableAmount'])) || 0;
            
            if (taxCode === '0015' || taxCode === '15' || !taxCode) {
              kdvTutari += amount;
              if (percent > 0) {
                const weight = taxable > 0 ? taxable : amount;
                if (weight > bestKdvWeight) {
                  bestKdvWeight = weight;
                  kdvOrani = percent;
                }
                kdvTaxableAmount += taxable;
                kdvBucketCount++;
                if (percent === 1) kdv1 += amount;
                else if (percent === 8 || percent === 10) kdv10 += amount;
                else if (percent === 18 || percent === 20) kdv20 += amount;
              }
            } else {
              oivTutari += amount;
            }
          }
        }

        // Vodafone / Telekom faturalarında KDV'den muaf Telsiz Kullanım Ücreti (TK Kullanım/Ruhsat)
        // TaxExclusiveAmount veya PayableAmount içinde yer alabilir; mahsup dengesi için oivTutari'ye ekle
        if (payableAmount > 0 && kdvTutari > 0 && tevkifatTutari === 0 && stopajTutari === 0) {
          if (kdvBucketCount === 1 && kdvTaxableAmount > 0 && matrah > kdvTaxableAmount + 0.02) {
            matrah = Math.round(kdvTaxableAmount * 100) / 100;
          }
          const fark = Math.round((payableAmount - matrah - kdvTutari - oivTutari) * 100) / 100;
          if (fark > 0.02) {
            oivTutari = Math.round((oivTutari + fark) * 100) / 100;
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
        let faturaAciklama = lineArr.map(l => getText(l?.['Item']?.['Name']) || getText(l?.['Item']?.['Description'])).filter(n => n).join(', ');
        
        if (!faturaAciklama) {
          const notes = inv['Note'];
          const noteArray = Array.isArray(notes) ? notes : (notes ? [notes] : []);
          faturaAciklama = noteArray.map(n => getText(n)).filter(n => n).join(' - ');
        }
        
        if (!faturaAciklama) {
          faturaAciklama = 'eLogo Giden Fatura';
        }

        const items = lineArr.map(l => {
          const q = parseFloat(getText(l?.['InvoicedQuantity'])) || 1;
          const p = parseFloat(getText(l?.['Price']?.['PriceAmount'])) || (parseFloat(getText(l?.['LineExtensionAmount'])) / q) || 0;
          const itemName = getText(l?.['Item']?.['Name']) || 
                           getText(l?.['Item']?.['Description']) || 
                           getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) ||
                           getText(l?.['Item']?.['BuyersItemIdentification']?.['ID']) ||
                           'Mal/Hizmet';
          return {
            name: itemName,
            urunAdi: itemName,
            qty: q,
            miktar: q,
            price: p,
            birimFiyat: p,
            barcode: getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) || ''
          };
        });

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
          stopajOrani,
          stopajTutari,
          tevkifatOrani,
          tevkifatTutari,
          faturaAciklama,
          items
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
}

export async function getUyumsoftGidenFaturalar(req, res) {
  try {
    let { baslangic, bitis } = req.query; let beginDate = baslangic; let endDate = bitis;
    
    if (!beginDate || !endDate) {
      endDate = new Date().toISOString();
      const beginDateObj = new Date();
      beginDateObj.setDate(beginDateObj.getDate() - 30); // Son 30 gün
      beginDate = beginDateObj.toISOString();
    }

    const keys = ['uyumsoft_username', 'uyumsoft_password', 'uyumsoft_is_test'];
    const placeholders = keys.map(() => '?').join(',');
    
    const rs = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [req.user.companyId, ...keys]
    });
    
    const settings = { uyumsoft_is_test: 'false' };
    rs.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });

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
    
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });
    
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
}

export async function getUyumsoftGidenEsmm(req, res) {
  try {
    let { baslangic, bitis } = req.query; let beginDate = baslangic; let endDate = bitis;
    
    if (!beginDate || !endDate) {
      endDate = new Date().toISOString();
      const beginDateObj = new Date();
      beginDateObj.setDate(beginDateObj.getDate() - 30); // Son 30 gün
      beginDate = beginDateObj.toISOString();
    }

    const keys = ['uyumsoft_username', 'uyumsoft_password', 'uyumsoft_is_test'];
    const placeholders = keys.map(() => '?').join(',');
    
    const rs = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [req.user.companyId, ...keys]
    });
    
    const settings = { uyumsoft_is_test: 'false' };
    rs.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });

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
}

export async function getElogoFaturaPdf(req, res) {
  try {
    // We don't have token in header since it's a window.open call. Let's get it from query if needed,
    // but for simplicity we can allow it if the uuid is valid. Ideally, verify token from req.query.token.
    const { uuid } = req.params;
    if (!uuid) return res.status(400).send('UUID eksik');
    
    // Auth check via query token
    const token = req.query.token;
    if (!token) return res.status(401).send('Yetkisiz');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'personnel_module_secret_88');
    
    // Ayarları getir
    const settingsRes = await client.execute({
      sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
      args: [decoded.companyId]
    });
    const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
    
    if (!settings.elogo_username || !settings.elogo_password) {
      return res.status(400).send('Logo ayarları eksik.');
    }
    
    const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
    const docDataRes = await elogo.getDocumentPdf(uuid);
    
    if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) {
       return res.status(404).send('PDF bulunamadı veya Logo reddetti.');
    }
    
    const base64Data = docDataRes.data.document.binaryData.Value;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check if it's a zip (PK)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
       const zip = new AdmZip(buffer);
       const zipEntries = zip.getEntries();
       const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
       
       if (pdfEntry) {
         return res.json({ success: true, base64: pdfEntry.getData().toString('base64'), filename: `${uuid}.pdf` });
       } else {
         return res.status(404).json({ success: false, message: 'ZIP içinde PDF bulunamadı.' });
       }
    }
    
    // If it's already a PDF (starts with %PDF)
    return res.json({ success: true, base64: buffer.toString('base64'), filename: `${uuid}.pdf` });
  } catch (error) {
    console.error('PDF indirme hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + error.message });
  }
}

export async function getUyumsoftEsmmPdf(req, res) {
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
}

export async function getUyumsoftGelenFaturalar(req, res) {
  try {
    const companyId = req.user.companyId;
    
    // Fetch settings
    const keys = ['uyumsoft_username', 'uyumsoft_password', 'uyumsoft_is_test'];
    const placeholders = keys.map(() => '?').join(',');
    const rsSettings = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [companyId, ...keys]
    });
    const settings = { uyumsoft_is_test: 'false' };
    for (const row of rsSettings.rows) settings[row.setting_key] = row.setting_value;
    
    if (!settings.uyumsoft_username || !settings.uyumsoft_password) {
      return res.status(400).json({ success: false, message: 'Logo ayarları eksik. Lütfen önce ayarları yapın.' });
    }

    const elogo = new UyumsoftClient(settings.uyumsoft_username, settings.uyumsoft_password, settings.uyumsoft_is_test === 'true');
    
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

    const response = await elogo.getDocumentList('EINVOICE', beginDate, endDate, 2);
    console.log('Uyumsoft GetDocumentList response:', JSON.stringify(response, null, 2));

    if (!response.success) {
      return res.status(500).json({ success: false, message: response.message });
    }
    
    // response.data contains the list of documents
    const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
    const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
    
    // Sadece başarılı olanları (veya parse edilebilenleri) dönelim
    
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });
    
    // Concurrency limit for requests to avoid Logo rate limiting
    const fetchInvoiceDetails = async (doc) => {
      try {
        if (doc.isPrePopulated) {
          // Uyumsoft Makbuz/Outbox provides info directly in the list, skip XML fetch
          return doc;
        }

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
        let matrah = parseFloat(getText(totals?.['TaxExclusiveAmount'])) || 0;
        
        let kdvTutari = 0;
        let kdvOrani = 0;
        let bestKdvWeight = -1;
        let oivTutari = 0;
        let kdv1 = 0;
        let kdv10 = 0;
        let kdv20 = 0;
        let kdvTaxableAmount = 0;
        let kdvBucketCount = 0;
        let stopajTutari = 0;
        let stopajOrani = 0;
        let tevkifatTutari = 0;
        let tevkifatOrani = 0;
        const taxTotal = inv['TaxTotal'];
        const taxTotalArray = Array.isArray(taxTotal) ? taxTotal : (taxTotal ? [taxTotal] : []);
        
        for (const tt of taxTotalArray) {
          const subtotals = tt['TaxSubtotal'];
          if (!subtotals) continue;
          const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
          for (const sub of subArr) {
            const taxCat = sub['TaxCategory'];
            const taxScheme = taxCat?.['TaxScheme']?.['TaxTypeCode']?.['#text'] || taxCat?.['TaxScheme']?.['TaxTypeCode'];
            const taxCode = String(getText(taxScheme) || '').trim();
            const percent = parseFloat(getText(sub['Percent'])) || parseFloat(getText(taxCat?.['Percent'])) || 0;
            const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
            const taxable = parseFloat(getText(sub['TaxableAmount'])) || 0;
            
            if (taxCode === '0015' || taxCode === '15' || !taxCode) { // 0015 KDV Kodudur
              kdvTutari += amount;
              if (percent > 0) {
                kdvOrani = percent;
                kdvTaxableAmount += taxable;
                kdvBucketCount++;
                if (percent === 1) kdv1 += amount;
                else if (percent === 8 || percent === 10) kdv10 += amount;
                else if (percent === 18 || percent === 20) kdv20 += amount;
              }
            } else {
              // ÖİV (4080), ÖTV (0071), TK (8001, 8002) vb. tüm diğer vergiler
              oivTutari += amount;
            }
          }
        }

        if (payableAmount > 0 && kdvTutari > 0 && tevkifatTutari === 0 && stopajTutari === 0) {
          if (kdvBucketCount === 1 && kdvTaxableAmount > 0 && matrah > kdvTaxableAmount + 0.02) {
            matrah = Math.round(kdvTaxableAmount * 100) / 100;
          }
          const fark = Math.round((payableAmount - matrah - kdvTutari - oivTutari) * 100) / 100;
          if (fark > 0.02) {
            oivTutari = Math.round((oivTutari + fark) * 100) / 100;
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
        let faturaAciklama = lineArr.map(l => getText(l?.['Item']?.['Name']) || getText(l?.['Item']?.['Description'])).filter(n => n).join(', ');
        
        if (!faturaAciklama) {
          const notes = inv['Note'];
          const noteArray = Array.isArray(notes) ? notes : (notes ? [notes] : []);
          faturaAciklama = noteArray.map(n => getText(n)).filter(n => n).join(' - ');
        }
        
        if (!faturaAciklama) {
          faturaAciklama = 'Uyumsoft Gelen Fatura';
        }

        const items = lineArr.map(l => {
          const q = parseFloat(getText(l?.['InvoicedQuantity'])) || 1;
          const p = parseFloat(getText(l?.['Price']?.['PriceAmount'])) || (parseFloat(getText(l?.['LineExtensionAmount'])) / q) || 0;
          const itemName = getText(l?.['Item']?.['Name']) || 
                           getText(l?.['Item']?.['Description']) || 
                           getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) ||
                           getText(l?.['Item']?.['BuyersItemIdentification']?.['ID']) ||
                           'Mal/Hizmet';
          return {
            name: itemName,
            urunAdi: itemName,
            qty: q,
            miktar: q,
            price: p,
            birimFiyat: p,
            barcode: getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) || ''
          };
        });

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
          kdv1,
          kdv10,
          kdv20,
          oivTutari,
          stopajOrani,
          stopajTutari,
          tevkifatOrani,
          tevkifatTutari,
          faturaAciklama,
          items
        };
      } catch (err) {
        console.error('Invoice parse error for UUID', doc.documentUuid, err);
        return { ...doc, senderName: 'Hata', faturaNo: doc.documentId || '-' };
      }
    };

    // Tüm fatura detaylarını paralel olarak çek
    const formattedDocs = await Promise.all(documents.map(d => fetchInvoiceDetails(d)));

    res.json({ success: true, veriler: formattedDocs, rawLogoResponse: response.data });
  } catch (error) {
    console.error('Uyumsoft gelen faturalar hatası:', error);
    res.status(500).json({ success: false, message: 'Gelen faturalar alınamadı: ' + error.message });
  }
}

export async function getUyumsoftFaturaPdf(req, res) {
  try {
    // We don't have token in header since it's a window.open call. Let's get it from query if needed,
    // but for simplicity we can allow it if the uuid is valid. Ideally, verify token from req.query.token.
    const { uuid } = req.params;
    if (!uuid) return res.status(400).send('UUID eksik');
    
    // Auth check via query token
    const token = req.query.token;
    if (!token) return res.status(401).send('Yetkisiz');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'personnel_module_secret_88');
    
    // Ayarları getir
    const settingsRes = await client.execute({
      sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
      args: [decoded.companyId]
    });
    const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
    
    if (!settings.uyumsoft_username || !settings.uyumsoft_password) {
      return res.status(400).send('Logo ayarları eksik.');
    }
    
    const elogo = new UyumsoftClient(settings.uyumsoft_username, settings.uyumsoft_password, settings.uyumsoft_is_test === 'true');
    const docDataRes = await elogo.getDocumentPdf(uuid);
    
    if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) {
       return res.status(404).send('PDF bulunamadı veya Logo reddetti.');
    }
    
    const base64Data = docDataRes.data.document.binaryData.Value;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check if it's a zip (PK)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
       const zip = new AdmZip(buffer);
       const zipEntries = zip.getEntries();
       const pdfEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.pdf'));
       
       if (pdfEntry) {
         return res.json({ success: true, base64: pdfEntry.getData().toString('base64'), filename: `${uuid}.pdf` });
       } else {
         return res.status(404).json({ success: false, message: 'ZIP içinde PDF bulunamadı.' });
       }
    }
    
    // If it's already a PDF (starts with %PDF)
    return res.json({ success: true, base64: buffer.toString('base64'), filename: `${uuid}.pdf` });
  } catch (error) {
    console.error('PDF indirme hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + error.message });
  }
}

export async function cronSyncElogo(req, res) {
  // Optional security check for Vercel Cron Secret
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    // 1. eLogo ayarları girilmiş tüm firmaları bul
    const rsCompanies = await client.execute(`
      SELECT company_id 
      FROM company_settings 
      WHERE setting_key = 'elogo_username' AND setting_value IS NOT NULL AND setting_value != ''
    `);
    
    const companyIds = rsCompanies.rows.map(r => r.company_id);
    console.log(`Cron: ${companyIds.length} firma için eLogo senkronizasyonu başlatılıyor...`);

    const endDate = new Date().toISOString();
    const beginDateObj = new Date();
    beginDateObj.setDate(beginDateObj.getDate() - 2); // Son 2 gün
    const beginDate = beginDateObj.toISOString();

    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });
    
    let totalSynced = 0;

    for (const companyId of companyIds) {
      try {
        // Firma ayarlarını çek
        const keys = ['elogo_username', 'elogo_password', 'elogo_is_test'];
        const placeholders = keys.map(() => '?').join(',');
        const rsSettings = await client.execute({
          sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
          args: [companyId, ...keys]
        });
        const settings = { elogo_is_test: 'false' };
        for (const row of rsSettings.rows) settings[row.setting_key] = row.setting_value;
        
        if (!settings.elogo_username || !settings.elogo_password) continue;

        const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
        const response = await elogo.getDocumentList('EINVOICE', beginDate, endDate, 2);
        
        if (!response.success) continue;
        
        const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
        const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
        
        for (const doc of documents) {
          const uuid = doc.documentUuid || doc.uuid;
          if (!uuid) continue;

          // Veritabanında var mı kontrol et
          const existing = await client.execute({
            sql: 'SELECT id FROM alis_faturalari WHERE company_id = ? AND aciklama LIKE ?',
            args: [companyId, `%${uuid}%`]
          });
          if (existing.rows && existing.rows.length > 0) continue; // Zaten kayıtlı

          // XML ve PDF çek (Detaylı parse)
          const docDataRes = await elogo.getDocumentData(uuid);
          if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) continue;
          
          const base64Data = docDataRes.data.document.binaryData.Value;
          const buffer = Buffer.from(base64Data, 'base64');
          let xmlString = '';
          
          if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
             const zip = new AdmZip(buffer);
             const zipEntries = zip.getEntries();
             if (zipEntries.length > 0) xmlString = zipEntries[0].getData().toString('utf8');
          } else {
             xmlString = buffer.toString('utf8');
          }
          if (!xmlString) continue;
          
          const parsed = ublParser.parse(xmlString);
          const inv = parsed.Invoice;
          if (!inv) continue;
          
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
            faturaAciklama = 'eLogo Gelen Fatura (Oto)';
          }

          const islemTarihi = issueDate ? issueDate.split('T')[0] : new Date().toISOString().split('T')[0];

          // PDF Çek
          let pdfDosyaBase64 = null;
          let pdfDosyaAdi = null;
          try {
            const pdfRes = await elogo.getDocumentPdf(uuid);
            if (pdfRes.success && pdfRes.data?.document?.binaryData?.Value) {
              const pBuffer = Buffer.from(pdfRes.data.document.binaryData.Value, 'base64');
              if (pBuffer[0] === 0x50 && pBuffer[1] === 0x4B) { 
                 const pZip = new AdmZip(pBuffer);
                 const pEntry = pZip.getEntries().find(e => e.entryName.toLowerCase().endsWith('.pdf'));
                 if (pEntry) {
                   pdfDosyaBase64 = `data:application/pdf;base64,${pEntry.getData().toString('base64')}`;
                   pdfDosyaAdi = `${uuid}.pdf`;
                 }
              } else {
                 pdfDosyaBase64 = `data:application/pdf;base64,${pdfRes.data.document.binaryData.Value}`;
                 pdfDosyaAdi = `${uuid}.pdf`;
              }
            }
          } catch(e) { console.error("Cron PDF fetch error:", e); }

          // DB Insert
          const id = uuidv4();
          await client.execute({
            sql: `INSERT INTO alis_faturalari 
              (id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, mal_hizmet_adi, 
               toplam_tutar, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
               stopaj_orani, stopaj_tutari, muhasebe_kodu, karsi_hesap_kodu, pdf_dosya, pdf_dosya_adi, 
               odeme_tarihi, odeme_durumu, odeme_dekontu, odeme_dekontu_adi, cari_id, vade_tarihi, 
               aciklama, olusturma_tarihi, company_id, kdv1, kdv10, kdv20, oiv_tutari) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              id, faturaNo, islemTarihi, senderName, senderVkn, faturaAciklama,
              payableAmount, kdvOrani || 0, kdvTutari || 0, matrah || 0, '0', 0,
              '0', 0, null, null, pdfDosyaBase64, pdfDosyaAdi,
              null, 'odenmedi', null, null, null, null,
              senderName || 'Alış Faturası', new Date().toISOString().split('T')[0], companyId,
              (kdvOrani === 1 ? kdvTutari : 0), (kdvOrani === 10 ? kdvTutari : 0), (kdvOrani === 20 ? kdvTutari : 0), oivTutari || 0
            ]
          });
          totalSynced++;
        }
      } catch (err) {
        console.error(`Cron error for company ${companyId}:`, err);
      }
    }
    
    res.json({ success: true, message: `Cron tamamlandı. ${totalSynced} fatura aktarıldı.` });
  } catch (error) {
    console.error('Cron genel hatası:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

function parseElogoXmlTaxes(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });
  const parsed = parser.parse(xmlText);
  const inv = parsed['Invoice'] || parsed['CreditNote'] || Object.values(parsed)[0] || {};
  const getText = (node) => {
    if (node === undefined || node === null) return '';
    if (typeof node === 'object') return node['#text'] !== undefined ? String(node['#text']) : '';
    return String(node);
  };

  const faturaNo = getText(inv['ID']);
  const totals = inv['LegalMonetaryTotal'] || {};
  const payableAmount = parseFloat(getText(totals['PayableAmount'])) || 0;
  let matrah = parseFloat(getText(totals['TaxExclusiveAmount'])) || 0;

  let senderVkn = '';
  const party = inv['AccountingSupplierParty']?.['Party'] || {};
  const partyIds = party['PartyIdentification'];
  const idArr = Array.isArray(partyIds) ? partyIds : (partyIds ? [partyIds] : []);
  for (const pid of idArr) {
    const scheme = pid?.['ID']?.['@_schemeID'];
    if (scheme === 'VKN' || scheme === 'TCKN') {
      senderVkn = String(getText(pid['ID'])).replace('.0', '').trim();
      break;
    }
  }

  let kdvTutari = 0;
  let kdvOrani = 0;
  let bestWeight = -1;
  let oivTutari = 0;
  let kdv1 = 0;
  let kdv10 = 0;
  let kdv20 = 0;
  let kdvTaxableAmount = 0;
  let kdvBucketCount = 0;

  const taxTotal = inv['TaxTotal'];
  const taxTotalArray = Array.isArray(taxTotal) ? taxTotal : (taxTotal ? [taxTotal] : []);
  for (const tt of taxTotalArray) {
    const subtotals = tt['TaxSubtotal'];
    if (!subtotals) continue;
    const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
    for (const sub of subArr) {
      const taxCat = sub['TaxCategory'];
      const taxScheme = taxCat?.['TaxScheme']?.['TaxTypeCode']?.['#text'] || taxCat?.['TaxScheme']?.['TaxTypeCode'];
      const taxCode = String(getText(taxScheme) || '').trim();
      const percent = parseFloat(getText(sub['Percent'])) || parseFloat(getText(taxCat?.['Percent'])) || 0;
      const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
      const taxable = parseFloat(getText(sub['TaxableAmount'])) || 0;

      if (taxCode === '0015' || taxCode === '15' || !taxCode) {
        kdvTutari += amount;
        if (percent > 0) {
          const weight = taxable > 0 ? taxable : amount;
          if (weight > bestWeight) {
            bestWeight = weight;
            kdvOrani = percent;
          }
          kdvTaxableAmount += taxable;
          kdvBucketCount++;
          if (percent === 1) kdv1 += amount;
          else if (percent === 8 || percent === 10) kdv10 += amount;
          else if (percent === 18 || percent === 20) kdv20 += amount;
        }
      } else {
        oivTutari += amount;
      }
    }
  }

  if (payableAmount > 0 && kdvTutari > 0) {
    if (kdvBucketCount === 1 && kdvTaxableAmount > 0 && matrah > kdvTaxableAmount + 0.02) {
      matrah = Math.round(kdvTaxableAmount * 100) / 100;
    }
    const fark = Math.round((payableAmount - matrah - kdvTutari - oivTutari) * 100) / 100;
    if (fark > 0.02) {
      oivTutari = Math.round((oivTutari + fark) * 100) / 100;
    }
  }

  return {
    faturaNo,
    senderVkn,
    matrah: Math.round(matrah * 100) / 100,
    kdvOrani: kdvOrani || 20,
    kdvTutari: Math.round(kdvTutari * 100) / 100,
    kdv1: Math.round(kdv1 * 100) / 100,
    kdv10: Math.round(kdv10 * 100) / 100,
    kdv20: Math.round(kdv20 * 100) / 100,
    oivTutari: Math.round(oivTutari * 100) / 100,
    payableAmount: Math.round(payableAmount * 100) / 100,
  };
}

export async function recheckElogoInvoices(req, res) {
  try {
    const { startDate, endDate } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Başlangıç ve bitiş tarihi gereklidir.' });
    }

    const settingsRes = await client.execute({
      sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
      args: [req.user.companyId]
    });
    const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
    if (!settings.elogo_username || !settings.elogo_password) {
      return res.status(400).json({ success: false, message: 'Bu şirket için e-Logo kullanıcı adı/şifre ayarlanmamış.' });
    }

    const dbRes = await client.execute({
      sql: 'SELECT id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, toplam_tutar, matrah, kdv_orani, kdv_tutari, kdv1, kdv10, kdv20, oiv_tutari, gib_uuid, luca_transferred_at FROM alis_faturalari WHERE company_id = ? AND fatura_tarihi >= ? AND fatura_tarihi <= ?',
      args: [req.user.companyId, startDate, endDate]
    });

    const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');

    // e-Logo 30 günden uzun aralıkları reddedebildiği için tarih aralığını 25 günlük parçalara böl
    const docs = [];
    const seenDocKeys = new Set();
    let elogoWarning = null;
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    let cursor = new Date(sDate);

    while (cursor <= eDate) {
      const chunkEnd = new Date(cursor);
      chunkEnd.setDate(chunkEnd.getDate() + 25);
      if (chunkEnd > eDate) chunkEnd.setTime(eDate.getTime());

      const bStr = `${cursor.toISOString().split('T')[0]}T00:00:00`;
      const eStr = `${chunkEnd.toISOString().split('T')[0]}T23:59:59`;
      const docListRes = await elogo.getDocumentList('EINVOICE', bStr, eStr, 2, 1);

      if (!docListRes.success) {
        elogoWarning = docListRes.message || 'e-Logo liste alınamadı';
      } else {
        const resMeta = docListRes.data?.GetDocumentListResult;
        if (resMeta && resMeta.resultCode !== undefined && Number(resMeta.resultCode) !== 1 && resMeta.resultMsg) {
          elogoWarning = resMeta.resultMsg;
        }
        const docListRaw = docListRes.data?.docList?.Document || docListRes.data?.docList?.document || docListRes.data?.GetDocumentListResult?.document || [];
        const chunkArr = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
        for (const d of chunkArr) {
          const key = String(d.documentUuid || d.uuid || d.documentId || '').toLowerCase().trim();
          if (key && !seenDocKeys.has(key)) {
            seenDocKeys.add(key);
            docs.push(d);
          }
        }
      }

      cursor = new Date(chunkEnd);
      cursor.setDate(cursor.getDate() + 1);
    }

    const diffs = [];
    let checkedCount = 0;

    for (const dbInv of dbRes.rows) {
      const dbNo = String(dbInv.fatura_no || '').trim();
      const dbNoLower = dbNo.toLowerCase();
      const dbUuidLower = String(dbInv.gib_uuid || '').trim().toLowerCase();
      const dbVkn = String(dbInv.tedarikci_vkn || '').trim();
      if (!dbNo && !dbUuidLower) continue;

      const matchedDoc = docs.find(d => {
        const dId = String(d.documentId || '').trim().toLowerCase();
        const dUuid = String(d.documentUuid || d.uuid || '').trim().toLowerCase();
        return (dbUuidLower && dUuid === dbUuidLower) || (dbNoLower && (dId === dbNoLower || dUuid === dbNoLower));
      });

      const docUuid = dbInv.gib_uuid || matchedDoc?.documentUuid || matchedDoc?.uuid;
      if (!docUuid) continue;

      try {
        const docDataRes = await elogo.getDocumentData(docUuid);
        if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) continue;
        const buffer = Buffer.from(docDataRes.data.document.binaryData.Value, 'base64');
        let xmlText = '';
        if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
          const zip = new AdmZip(buffer);
          const zipEntries = zip.getEntries();
          const xmlEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.xml')) || zipEntries[0];
          if (xmlEntry) xmlText = xmlEntry.getData().toString('utf8');
        } else {
          xmlText = buffer.toString('utf8');
        }
        if (!xmlText) continue;

        const parsed = parseElogoXmlTaxes(xmlText);
        if (parsed.senderVkn && dbVkn && parsed.senderVkn !== dbVkn) continue;

        checkedCount++;
        const oldMatrah = Number(dbInv.matrah) || 0;
        const oldKdvOrani = Number(dbInv.kdv_orani) || 0;
        const oldKdvTutari = Number(dbInv.kdv_tutari) || 0;
        let oldKdv1 = Number(dbInv.kdv1) || 0;
        let oldKdv10 = Number(dbInv.kdv10) || 0;
        let oldKdv20 = Number(dbInv.kdv20) || 0;
        const oldOiv = Number(dbInv.oiv_tutari) || 0;

        // Eski kayıtlarda kdv1/10/20 kırılımı boşsa, tekil kdv_orani + kdv_tutari üzerinden doldur
        if (oldKdv1 === 0 && oldKdv10 === 0 && oldKdv20 === 0 && oldKdvTutari > 0) {
          if (oldKdvOrani === 1) oldKdv1 = oldKdvTutari;
          else if (oldKdvOrani === 8 || oldKdvOrani === 10) oldKdv10 = oldKdvTutari;
          else if (oldKdvOrani === 18 || oldKdvOrani === 20) oldKdv20 = oldKdvTutari;
        }

        const hasDiff =
          Math.abs(oldMatrah - parsed.matrah) > 0.05 ||
          oldKdvOrani !== parsed.kdvOrani ||
          Math.abs(oldKdvTutari - parsed.kdvTutari) > 0.05 ||
          Math.abs(oldKdv1 - parsed.kdv1) > 0.05 ||
          Math.abs(oldKdv10 - parsed.kdv10) > 0.05 ||
          Math.abs(oldKdv20 - parsed.kdv20) > 0.05 ||
          Math.abs(oldOiv - parsed.oivTutari) > 0.05;

        if (hasDiff) {
          diffs.push({
            id: dbInv.id,
            faturaNo: dbNo,
            faturaTarihi: dbInv.fatura_tarihi,
            tedarikciAdi: dbInv.tedarikci_adi,
            tedarikciVkn: dbVkn,
            toplamTutar: Number(dbInv.toplam_tutar) || parsed.payableAmount,
            lucaTransferredAt: dbInv.luca_transferred_at || null,
            eski: {
              matrah: oldMatrah,
              kdvOrani: oldKdvOrani,
              kdvTutari: oldKdvTutari,
              kdv1: oldKdv1,
              kdv10: oldKdv10,
              kdv20: oldKdv20,
              oivTutari: oldOiv,
            },
            yeni: {
              matrah: parsed.matrah,
              kdvOrani: parsed.kdvOrani,
              kdvTutari: parsed.kdvTutari,
              kdv1: parsed.kdv1,
              kdv10: parsed.kdv10,
              kdv20: parsed.kdv20,
              oivTutari: parsed.oivTutari,
            }
          });
        }
      } catch (innerErr) {
        console.warn('Recheck parse warning:', dbNo, innerErr.message);
      }
    }

    res.json({
      success: true,
      dbCount: dbRes.rows.length,
      elogoDocCount: docs.length,
      elogoWarning,
      checkedCount,
      diffCount: diffs.length,
      diffs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function applyRecheckAlisFaturalari(req, res) {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Güncellenecek fatura bulunamadı.' });
    }

    let updatedCount = 0;
    for (const u of updates) {
      if (!u.id) continue;
      await client.execute({
        sql: `UPDATE alis_faturalari
              SET matrah = ?, kdv_orani = ?, kdv_tutari = ?, kdv1 = ?, kdv10 = ?, kdv20 = ?, oiv_tutari = ?
              WHERE id = ? AND company_id = ?`,
        args: [
          Number(u.matrah) || 0,
          Number(u.kdvOrani) || 0,
          Number(u.kdvTutari) || 0,
          Number(u.kdv1) || 0,
          Number(u.kdv10) || 0,
          Number(u.kdv20) || 0,
          Number(u.oivTutari) || 0,
          u.id,
          req.user.companyId
        ]
      });
      updatedCount++;
    }

    res.json({ success: true, updatedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
