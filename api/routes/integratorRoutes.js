import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { authMiddleware } from '../auth.js';
import { ElogoClient } from '../services/elogoClient.js';
import { UyumsoftClient } from '../services/uyumsoftClient.js';
import { UblBuilder } from '../services/ublBuilder.js';
import { autoInvoiceFetcher } from '../services/autoInvoiceFetcher.js';
import { stockSyncService } from '../services/stockSyncService.js';
import { evrenClient } from '../services/evrenClient.js';
import { saveBase64File, saveBufferFile, saveTextFile, getTextFileIfExists } from '../services/fileStorage.js';
import { createFaturaClient } from '../fatura-client.js';
import { gibSessionManager } from '../gibSessionManager.js';
import { dijitalGibClient } from '../services/dijitalGibClient.js';
import { xmlParser, n } from '../utils/shared.js';

const router = express.Router();

router.get('/api/integrator/ayarlar', authMiddleware, async (req, res) => {
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
});

router.post('/api/integrator/ayarlar', authMiddleware, async (req, res) => {
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
});

// ==========================================
// --- TELEGRAM BOT ENDPOINTS ---
// ==========================================

router.get('/api/auto-sync/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await autoInvoiceFetcher.getCompanySettings(req.user.companyId);
    const logs = await autoInvoiceFetcher.getLogs(req.user.companyId, 25);
    res.json({ success: true, settings, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/auto-sync/settings', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    await autoInvoiceFetcher.saveCompanySettings(req.user.companyId, updates);
    res.json({ success: true, message: 'Otomatik tarama ayarları başarıyla kaydedildi.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/api/auto-sync/run-now', authMiddleware, async (req, res) => {
  try {
    const result = await autoInvoiceFetcher.scanCompany(req.user.companyId, 'manual');
    const logs = await autoInvoiceFetcher.getLogs(req.user.companyId, 25);
    res.json({ ...result, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/api/auto-sync/logs', authMiddleware, async (req, res) => {
  try {
    const logs = await autoInvoiceFetcher.getLogs(req.user.companyId, 50);
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// --- RECONCILIATION / OTOMATIK BANKA-FATURA ESLEME ---
// ==========================================

router.post('/api/elogo/fatura-gonder/:id', authMiddleware, async (req, res) => {
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
});

router.get('/api/elogo/gelen-faturalar', authMiddleware, async (req, res) => {
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
                kdvOrani = percent;
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
});

router.get('/api/elogo/giden-faturalar', authMiddleware, async (req, res) => {
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
                kdvOrani = percent;
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
});


router.get('/api/uyumsoft/giden-faturalar', authMiddleware, async (req, res) => {
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
});

router.get('/api/uyumsoft/giden-esmm', authMiddleware, async (req, res) => {
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
});


// PDF İndirme Endpoint'i
router.get('/api/elogo/fatura-pdf/:uuid', async (req, res) => {
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
});

router.get('/api/uyumsoft/esmm-pdf/:uuid', async (req, res) => {
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


// Logo'dan Gelen Faturayı Sisteme Kaydet
router.get('/api/uyumsoft/gelen-faturalar', authMiddleware, async (req, res) => {
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
});

// PDF İndirme Endpoint'i
router.get('/api/uyumsoft/fatura-pdf/:uuid', async (req, res) => {
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
});

// Logo'dan Gelen Faturayı Sisteme Kaydet



function formatGIBTime(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

router.post('/api/gib/create-draft', authMiddleware, async (req, res) => {
  const { credentials, invoice, autoSign } = req.body;
  if (!credentials?.username || !credentials?.password)
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı ve şifre gereklidir.' });
  if (!invoice)
    return res.status(400).json({ success: false, message: 'Fatura verisi eksik.' });

  const vknStr = String(invoice.vknTckn || '').trim().replace(/\s/g, '');
  if (!vknStr || vknStr === '0' || vknStr === 'undefined') {
    return res.status(400).json({ success: false, message: 'VKN/TC Kimlik numarası zorunludur.' });
  }

  let subtotal = 0;
  let vatAmount = 0;
  let tevkifatAmount = 0;
  let stopajAmount = 0;

  let items = [];
  if (invoice.kalemler && invoice.kalemler.length > 0) {
    items = invoice.kalemler.map(k => {
      const qty = parseFloat(k.miktar) || 1;
      let price = parseFloat(k.birimFiyat) || 0;
      const vatRate = parseFloat(k.kdvOrani) || 0;
      
      if (invoice.kdvDahil) {
        price = price / (1 + (vatRate / 100));
      }

      const itemMatrah = qty * price;
      const itemKdv = itemMatrah * (vatRate / 100);
      
      let tevkifatCarpani = 0;
      const tevkifatOrani = parseFloat(k.tevkifatOrani) || 0;
      if (tevkifatOrani > 0 && tevkifatOrani < 10) {
        tevkifatCarpani = tevkifatOrani / 10;
      } else if (tevkifatOrani >= 10 && tevkifatOrani <= 100) {
        tevkifatCarpani = tevkifatOrani / 100;
      }
      const itemTevkifat = itemKdv * tevkifatCarpani;
      
      const stopajRate = parseFloat(invoice.stopajOrani) || 0;
      const itemStopaj = itemMatrah * (stopajRate / 100);

      subtotal += itemMatrah;
      vatAmount += itemKdv;
      tevkifatAmount += itemTevkifat;
      stopajAmount += itemStopaj;

      // Tevkifat kodu boşsa ama tevkifat oranı varsa varsayılan 616 (Diğer Hizmetler) ata
      let itemTevkifatKodu = k.tevkifatKodu || '';
      if (tevkifatCarpani > 0 && !itemTevkifatKodu) {
        itemTevkifatKodu = invoice.tevkifatKodu || '616';
      }

      return {
        name: k.ad || 'Hizmet',
        quantity: qty,
        unitPrice: price,
        price: price,
        VATRate: vatRate,
        VATAmount: itemKdv,
        tevkifatKodu: itemTevkifatKodu,
        tevkifatOrani: tevkifatOrani > 0 && tevkifatOrani < 10 ? tevkifatOrani : (tevkifatOrani >= 10 ? tevkifatOrani / 10 : 0),
        tevkifatAmount: itemTevkifat,
        stopajRate: stopajRate,
        stopajAmount: itemStopaj,
        stopajTipi: invoice.stopajTipi || '',
        unitType: k.birim || 'C62'
      };
    });
  } else {
    const matrah = invoice.kdvDahil ? invoice.tutar / (1 + (invoice.kdvOrani || 20) / 100) : invoice.tutar;
    const itemKdv = matrah * ((invoice.kdvOrani || 20) / 100);
    
    let tevkifatCarpani = 0;
    let tevkifatOrani = parseFloat(invoice.tevkifatOrani) || 0;
    if (tevkifatOrani > 0 && tevkifatOrani < 10) {
      tevkifatCarpani = tevkifatOrani / 10;
    } else if (tevkifatOrani >= 10 && tevkifatOrani <= 100) {
      tevkifatCarpani = tevkifatOrani / 100;
    }
    const itemTevkifat = itemKdv * tevkifatCarpani;
    
    const stopajRate = parseFloat(invoice.stopajOrani) || 0;
    const itemStopaj = matrah * (stopajRate / 100);

    subtotal = matrah;
    vatAmount = itemKdv;
    tevkifatAmount = itemTevkifat;
    stopajAmount = itemStopaj;

    const tevkifatKodu = (tevkifatCarpani > 0) ? (invoice.tevkifatKodu || '616') : '';

    items = [{
      name: invoice.aciklama || 'Hizmet / Mal Bedeli',
      quantity: 1,
      unitPrice: matrah,
      price: matrah,
      VATRate: invoice.kdvOrani || 20,
      VATAmount: itemKdv,
      tevkifatKodu: tevkifatKodu,
      tevkifatOrani: tevkifatOrani > 0 && tevkifatOrani < 10 ? tevkifatOrani : (tevkifatOrani >= 10 ? tevkifatOrani / 10 : 0),
      tevkifatAmount: itemTevkifat,
      stopajRate: stopajRate,
      stopajAmount: itemStopaj,
      stopajTipi: invoice.stopajTipi || '',
      unitType: 'C62'
    }];
  }

  const grandTotalInclVAT = subtotal + vatAmount;
  const paymentTotal = subtotal + vatAmount - stopajAmount - tevkifatAmount;

  const now = new Date();
  let formattedGibDate = '';
  if (invoice.faturaTarihi) {
    const raw = String(invoice.faturaTarihi).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const p = raw.split('T')[0].split('-');
      formattedGibDate = `${p[2]}/${p[1]}/${p[0]}`;
    } else if (/^\d{2}[./-]\d{2}[./-]\d{4}/.test(raw)) {
      const p = raw.split(/[./-]/);
      formattedGibDate = `${p[0]}/${p[1]}/${p[2]}`;
    } else {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        formattedGibDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
  }
  if (!formattedGibDate) {
    formattedGibDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  
  // Tevkifat tutarı varsa veya fatura tipi TEVKIFAT ise fatura tipini kesinlikle TEVKIFAT yap
  const isTevkifat = tevkifatAmount > 0 || invoice.faturaTipi === 'TEVKIFAT';
  const effectiveInvoiceType = isTevkifat ? 'TEVKIFAT' : (invoice.faturaTipi || 'SATIS');

  // VKN/TCKN Ayrımı: 10 haneli VKN için sadece Unvan, 11 haneli TCKN için Ad/Soyad
  const isCorporate = vknStr.length === 10 && vknStr !== '11111111111';
  const fullRecipientTitle = `${invoice.ad || ''} ${invoice.soyad || ''}`.trim();

  const invoiceDetails = {
    uuid: invoice.gibUuid || invoice.uuid || '',
    date: formattedGibDate,
    time: formatGIBTime(now),
    taxIDOrTRID: vknStr,
    title: isCorporate ? fullRecipientTitle : (vknStr === '11111111111' ? (fullRecipientTitle || 'NİHAİ TÜKETİCİ') : ''),
    name: isCorporate ? '' : (invoice.ad || ''),
    surname: isCorporate ? '' : (invoice.soyad || ''),
    invoiceType: effectiveInvoiceType,
    stopajTipi: invoice.stopajTipi || 'V0003',
    hangiTip: "5000/30000",
    fullAddress: invoice.adres || 'Adres Bulunmuyor',
    district: invoice.ilce || '',
    city: invoice.il || '',
    country: invoice.ulke || 'Türkiye',
    taxOffice: invoice.vergiDairesi || '',
    items: items,
    subtotal: subtotal,
    grandTotal: subtotal,
    totalVAT: vatAmount,
    totalStopaj: stopajAmount,
    totalTevkifat: tevkifatAmount,
    gelirVergisiOrani: parseFloat(invoice.stopajOrani) || 0,
    gelirVergisiTevkifatiTutari: stopajAmount.toFixed(2),
    grandTotalInclVAT: grandTotalInclVAT,
    paymentTotal: paymentTotal,
    note: invoice.aciklama || ''
  };

  const isTest = process.env.GIB_TEST_MODE === 'true';
  const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
  
  let lastError = null;
  // GİB anlık yoğunluklarına ve geçici düşmelerine karşı 2 kez otomatik deneme (Self-Healing Retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const token = await gibSessionManager.getSessionToken(client, credentials.username, credentials.password, isTest ? 'TEST' : 'PROD');
      const createdInvoice = await client.createDraftInvoice(token, invoiceDetails);
      const invoiceUUID = createdInvoice.uuid || '';

      const dataStr = String(createdInvoice.data || '');
      const isGibSuccess = dataStr.includes('başarı') || dataStr.includes('basari') || dataStr.includes('oluşturulmuştur') || Boolean(invoiceUUID);
      if (!isGibSuccess) {
        return res.status(400).json({
          success: false,
          message: dataStr || 'GİB faturası oluşturulamadı.'
        });
      }

      let signResult = null;
      let invoiceNo = null;
      if (autoSign === true && invoiceUUID) {
        const details = await client.findInvoice(token, createdInvoice);
        if (details !== undefined) {
          signResult = await client.signDraftInvoice(token, details);
          invoiceNo = details.belgeNumarasi || (signResult && signResult.belgeNumarasi) || null;
          if (!invoiceNo) {
            try {
              const signedDetails = await client.findInvoice(token, createdInvoice);
              if (signedDetails && signedDetails.belgeNumarasi) {
                invoiceNo = signedDetails.belgeNumarasi;
              }
            } catch (e) {}
          }
        }
      }

      let msg = autoSign ? 'Fatura başarıyla oluşturuldu ve imzalandı.' : 'Fatura taslak olarak GİB portalına gönderildi.';
      if (!invoiceUUID) {
        msg = `Fatura taslak olarak GİB portalına iletildi. (GİB: ${createdInvoice.data || 'Başarılı'})`;
      }

      return res.json({
        success: true,
        message: msg,
        data: { invoiceUUID, invoiceNo, signed: autoSign === true, signResult, debug: createdInvoice }
      });
    } catch (error) {
      lastError = error;
      const errMsg = String(error.message || '').toLowerCase();
      console.warn(`[GIB Create Draft] Deneme ${attempt}/2 başarısız:`, error.message);

      // Token veya oturum sorunu varsa önbelleği temizle ki 2. denemede taze token alsın
      const isAuthError = errMsg.includes('token') || errMsg.includes('oturum') || errMsg.includes('yetki') || errMsg.includes('giriş');
      if (isAuthError) {
        gibSessionManager.invalidate(credentials.username, isTest ? 'TEST' : 'PROD');
      }

      // Geçici GİB / ağ hatası ise 1.8 sn bekle ve tekrar dene
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1800));
        continue;
      }
    }
  }

  console.error('[GIB] Hata Oluştu (Tüm denemeler tükendi):', lastError);
  return res.status(500).json({
    success: false,
    message: 'GİB fatura hatası: ' + (lastError?.message || 'Bilinmeyen hata'),
  });
});

router.post('/api/gib/recipient-info', authMiddleware, async (req, res) => {
  const { credentials, vknTckn } = req.body;
  if (!credentials?.username || !credentials?.password)
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı ve şifre gereklidir.' });
  if (!vknTckn)
    return res.status(400).json({ success: false, message: 'VKN veya TCKN gereklidir.' });

  const isTest = process.env.GIB_TEST_MODE === 'true';
  const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
  try {
    const token = await gibSessionManager.getSessionToken(client, credentials.username, credentials.password, isTest ? 'TEST' : 'PROD');
    const data = await client.getRecipientData(token, vknTckn);
    res.json({ success: true, data });
  } catch (error) {
    console.error('GIB recipient info error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Alıcı bilgileri getirilemedi.' });
  }
});

router.post('/api/gib/invoices', authMiddleware, async (req, res) => {
  const { credentials, startDate, endDate } = req.body;
  if (!credentials?.username || !credentials?.password)
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı ve şifre gereklidir.' });
  if (!startDate || !endDate)
    return res.status(400).json({ success: false, message: 'Başlangıç ve bitiş tarihleri gereklidir.' });

  const isTest = process.env.GIB_TEST_MODE === 'true';
  const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
  try {
    const formatToGIB = (dateStr) => {
      if (!dateStr) return '';
      let clean = String(dateStr).trim();
      if (clean.includes('T')) clean = clean.split('T')[0];
      if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts.length === 3) {
          // YYYY-MM-DD -> DD/MM/YYYY
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
      }
      if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts.length === 3) {
          // DD.MM.YYYY -> DD/MM/YYYY
          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
      }
      return clean;
    };

    const gibStart = formatToGIB(startDate);
    const gibEnd = formatToGIB(endDate);

    console.log(`[GIB Invoices Fetch] Sorgu başlatılıyor: ${gibStart} - ${gibEnd} (Kullanıcı: ${credentials.username})`);

    const token = await gibSessionManager.getSessionToken(client, credentials.username, credentials.password, isTest ? 'TEST' : 'PROD');
    const invoices = await client.getAllInvoicesByDateRange(token, { startDate: gibStart, endDate: gibEnd });

    console.log(`[GIB Invoices Fetch] Başarılı! GİB'den dönen fatura adedi: ${invoices?.length || 0}`);

    const parseGibMoney = (str) => {
      if (typeof str === 'number') return str;
      if (!str) return 0;
      let clean = String(str).replace(/[^\d\.,]/g, '');
      if (!clean) return 0;
      if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
          clean = clean.replace(/\./g, '').replace(/,/g, '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(/,/g, '.');
      }
      return parseFloat(clean) || 0;
    };

    // Her faturanın temel tutar ve matrah/kdv bilgilerini odenecek bilgisinden öncelikli oluştur
    if (Array.isArray(invoices)) {
      for (const inv of invoices) {
        const rawAmt = inv.odenecek ?? inv.odenecekTutar ?? inv.belgeTutari ?? inv.belgeToplamTutar ?? inv.toplamTutar ?? inv.tutar;
        const baseAmt = parseGibMoney(rawAmt);
        inv.tutar = baseAmt;
        inv.odenecekTutar = baseAmt;
        if (baseAmt > 0) {
          inv.matrah = +(baseAmt / 1.20).toFixed(2);
          inv.kdvTutari = +(baseAmt - inv.matrah).toFixed(2);
        } else {
          inv.matrah = 0;
          inv.kdvTutari = 0;
        }
      }
    }

    // Faturaların matrah, kdv ve toplam tutar detaylarını otomatik çözümle (varsa ayrıntılı XML/HTML'den üzerine yaz)
    if (Array.isArray(invoices) && invoices.length > 0 && req.body.includeDetails !== false) {
      console.log(`[GIB Invoices Fetch] Faturaların matrah, kdv ve toplam tutar bilgileri çözümleniyor (${invoices.length} adet)...`);
      const chunkSize = 4;
      for (let i = 0; i < invoices.length; i += chunkSize) {
        const chunk = invoices.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (inv) => {
          try {
            const details = await getGibInvoiceDetails(client, token, inv.ettn, inv.onayDurumu === 'Onaylandı');
            if (details && details.success) {
              if (details.tutar > 0) {
                inv.tutar = details.tutar;
                inv.odenecekTutar = details.tutar;
              }
              if (details.matrah > 0) {
                inv.matrah = details.matrah;
              } else if (inv.tutar > 0 && !inv.matrah) {
                inv.matrah = +(inv.tutar / 1.20).toFixed(2);
              }
              if (details.kdvTutari > 0) {
                inv.kdvTutari = details.kdvTutari;
              } else if (inv.tutar > 0 && !inv.kdvTutari) {
                inv.kdvTutari = +(inv.tutar - (inv.matrah || 0)).toFixed(2);
              }
              if (details.tevkifatTutari) inv.tevkifatTutari = details.tevkifatTutari;
              if (details.stopajTutari) inv.stopajTutari = details.stopajTutari;
              if (details.aliciUnvan && !inv.aliciUnvanAdSoyad) inv.aliciUnvanAdSoyad = details.aliciUnvan;
              if (details.aliciVknTckn && !inv.aliciVknTckn) inv.aliciVknTckn = details.aliciVknTckn;
            }
          } catch (detErr) {
            console.warn(`[GIB Invoices Fetch] ${inv.ettn} detay çözümlenemedi:`, detErr.message);
          }
        }));
      }
    }

    return res.json({
      success: true,
      data: invoices || [],
      queryRange: { startDate: gibStart, endDate: gibEnd }
    });
  } catch (error) {
    console.error('[GIB Invoices Fetch] Hata Oluştu:', error);
    return res.status(500).json({
      success: false,
      message: 'GİB faturaları getirme hatası: ' + error.message,
    });
  }
});

router.post('/api/gib/download-pdf', authMiddleware, async (req, res) => {
  const { credentials, uuid, signed } = req.body;
  if (!credentials?.username || !credentials?.password)
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı ve şifre gereklidir.' });
  if (!uuid)
    return res.status(400).json({ success: false, message: 'Fatura UUID (ETTN) gereklidir.' });

  // 1. Önce sunucu diskindeki önbelleğe bak (Saliseler içinde açılır)
  const cachedHtml = getTextFileIfExists(`gib_${uuid}.html`, 'faturalar');
  if (cachedHtml) {
    return res.json({ success: true, html: cachedHtml, cached: true });
  }

  const isTest = process.env.GIB_TEST_MODE === 'true';
  const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
  try {
    const token = await gibSessionManager.getSessionToken(client, credentials.username, credentials.password, isTest ? 'TEST' : 'PROD');
    const html = await client.getInvoiceHTML(token, uuid, { signed: signed !== false });
    
    // Sunucu diskine kaydet
    if (html) {
      saveTextFile(html, `gib_${uuid}.html`, 'faturalar');
    }

    return res.json({ success: true, html });
  } catch (error) {
    console.error('[GIB PDF Download/HTML] Hata Oluştu:', error);
    return res.status(500).json({
      success: false,
      message: 'GİB faturası HTML okuma hatası: ' + error.message,
    });
  }
});

async function getGibInvoiceDetails(client, token, uuid, signed) {
  const downloadUrl = client.getDownloadURL(token, uuid, { signed: signed !== false });

  let xmlContent = null;
  let htmlContent = null;

  try {
    const zipResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      headers: client.buildHeaders()
    });
    const zip = new AdmZip(Buffer.from(zipResponse.data));
    const zipEntries = zip.getEntries();
    
    const xmlEntry = zipEntries.find(entry => entry.entryName.endsWith('.xml'));
    if (xmlEntry) {
      xmlContent = xmlEntry.getData().toString('utf8');
    } else {
      const htmlEntry = zipEntries.find(entry => entry.entryName.endsWith('.html') || entry.entryName.endsWith('.htm'));
      if (htmlEntry) htmlContent = htmlEntry.getData().toString('utf8');
    }
  } catch (zipErr) {
    // ZIP okunamadı, doğrudan HTML alınacak
  }

  if (!xmlContent && !htmlContent) {
    htmlContent = await client.getInvoiceHTML(token, uuid, { signed: signed !== false });
  }
  
  if (!xmlContent && !htmlContent) {
    throw new Error('Fatura detayı (XML veya HTML) alınamadı.');
  }

  let parsedData = { success: true, tutar: 0, matrah: 0, kdvTutari: 0, tevkifatTutari: 0, stopajTutari: 0, aliciVknTckn: '', aliciUnvan: '' };
  
  if (xmlContent) {
    const jsonObj = xmlParser.parse(xmlContent);
    if (jsonObj.Invoice) {
      const inv = jsonObj.Invoice;
      const monTotal = inv['LegalMonetaryTotal'];
      const taxTotal = inv['TaxTotal'];
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
        return getText(partyName?.['Name']) || getText(party?.['PartyLegalEntity']?.['RegistrationName']) || getText(party?.['Person']?.['FirstName']) || '';
      };
      const getSoyad = (party) => getText(party?.['Person']?.['FamilyName']) || '';

      let xmlKdvTutari = 0;
      let xmlStopajTutari = 0;
      
      const taxSubtotals = taxTotal?.['TaxSubtotal'];
      if (taxSubtotals) {
        const subtotalArr = Array.isArray(taxSubtotals) ? taxSubtotals : [taxSubtotals];
        for (const sub of subtotalArr) {
          const taxScheme = sub?.['TaxCategory']?.['TaxScheme'] || sub?.['TaxScheme'];
          const schemeId = getText(taxScheme?.['ID']) || '';
          const taxAmount = parseFloat(sub?.['TaxAmount']?.['#text'] || sub?.['TaxAmount'] || 0);
          
          if (schemeId === '0015' || schemeId === 'KDV' || String(getText(taxScheme?.['Name'])).toUpperCase().includes('KDV')) {
            xmlKdvTutari += taxAmount;
          } else if (schemeId === '0003' || String(getText(taxScheme?.['Name'])).toUpperCase().includes('STOPAJ')) {
            xmlStopajTutari += taxAmount;
          }
        }
      }
      if (xmlKdvTutari === 0) {
        xmlKdvTutari = parseFloat(taxTotal?.['TaxAmount']?.['#text'] || taxTotal?.['TaxAmount'] || 0);
      }

      let xmlTevkifatTutari = 0;
      const withholdingTax = inv['WithholdingTaxTotal'];
      if (withholdingTax) {
        const whArr = Array.isArray(withholdingTax) ? withholdingTax : [withholdingTax];
        for (const wh of whArr) {
          xmlTevkifatTutari += parseFloat(wh?.['TaxAmount']?.['#text'] || wh?.['TaxAmount'] || 0);
        }
      }

      parsedData = {
        success: true,
        tutar: parseFloat(monTotal?.['PayableAmount']?.['#text'] || monTotal?.['PayableAmount'] || 0),
        matrah: parseFloat(monTotal?.['TaxExclusiveAmount']?.['#text'] || monTotal?.['TaxExclusiveAmount'] || 0),
        kdvTutari: xmlKdvTutari,
        tevkifatTutari: xmlTevkifatTutari,
        stopajTutari: xmlStopajTutari,
        aliciVknTckn: getVkn(customerParty),
        aliciUnvan: (getAd(customerParty) + ' ' + getSoyad(customerParty)).trim(),
        rawXml: xmlContent
      };
    } else {
      throw new Error('XML formatı standart UBL-TR değil.');
    }
  } else if (htmlContent) {
    const parseAmount = (str) => {
      if (!str) return 0;
      let clean = str.replace(/[^\d\.,]/g, '');
      if (!clean) return 0;
      if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
          clean = clean.replace(/\./g, '').replace(/,/g, '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(/,/g, '.');
      }
      return parseFloat(clean) || 0;
    };

    const rows = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(htmlContent)) !== null) {
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const tds = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
        const text = tdMatch[1].replace(/<[^>]+>/g, '').trim();
        if (text) tds.push(text);
      }
      if (tds.length >= 2) {
        rows.push(tds);
      }
    }

    const summaryRows = rows.filter(r => r.length <= 4);

    const extractAmount = (keywords, excludeKeywords = []) => {
      // 1. Önce summaryRows içinde (kısa satırlar)
      for (const tds of summaryRows) {
        const allExceptLast = tds.slice(0, -1).join(' ');
        const amountCell = tds[tds.length - 1];
        const matchesKeyword = keywords.some(k => new RegExp(k, 'i').test(allExceptLast));
        const matchesExclude = excludeKeywords.some(k => new RegExp(k, 'i').test(allExceptLast));
        if (matchesKeyword && !matchesExclude) {
          const val = parseAmount(amountCell);
          if (val > 0) return val;
        }
      }
      // 2. Tüm satırlar içinde
      for (const tds of rows) {
        const allExceptLast = tds.slice(0, -1).join(' ');
        const amountCell = tds[tds.length - 1];
        const matchesKeyword = keywords.some(k => new RegExp(k, 'i').test(allExceptLast));
        const matchesExclude = excludeKeywords.some(k => new RegExp(k, 'i').test(allExceptLast));
        if (matchesKeyword && !matchesExclude && !allExceptLast.includes('=')) {
          const val = parseAmount(amountCell);
          if (val > 0) return val;
        }
      }
      // 3. Doğrudan HTML regex eşleşmesi
      for (const kw of keywords) {
        const regex = new RegExp(kw + '[\\s\\S]{0,120}?([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:\\.[0-9]{2}))', 'i');
        const match = htmlContent.match(regex);
        if (match && match[1]) {
          const val = parseAmount(match[1]);
          if (val > 0) return val;
        }
      }
      return 0;
    };

    parsedData.tutar = extractAmount(['Ödenecek Tutar', 'Genel Toplam']);
    parsedData.matrah = extractAmount(['Mal Hizmet Toplam', 'Tevkifata Tabi İşlem Tutarı']);
    parsedData.kdvTutari = extractAmount(['Hesaplanan KDV'], ['Tevkifat', 'Tevkifata Tabi', 'İade']);
    parsedData.tevkifatTutari = extractAmount(['KDV Tevkifat']);
    parsedData.stopajTutari = extractAmount(['STOPAJ', 'KV. STOPAJ']);
    parsedData.rawHtml = htmlContent;
  }

  return parsedData;
}

router.post('/api/gib/invoice-details', authMiddleware, async (req, res) => {
  const { credentials, uuid, signed } = req.body;
  if (!credentials?.username || !credentials?.password)
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı ve şifre gereklidir.' });
  if (!uuid)
    return res.status(400).json({ success: false, message: 'Fatura UUID (ETTN) gereklidir.' });

  const isTest = process.env.GIB_TEST_MODE === 'true';
  const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
  try {
    const token = await gibSessionManager.getSessionToken(client, credentials.username, credentials.password, isTest ? 'TEST' : 'PROD');
    const parsedData = await getGibInvoiceDetails(client, token, uuid, signed !== false);
    return res.json(parsedData);
  } catch (error) {
    console.error('[GIB Invoice Details] Hata Oluştu:', error);
    return res.status(500).json({
      success: false,
      message: 'GİB faturasından detay okunamadı: ' + error.message,
    });
  }
});

// GİB Oturumunu Güvenli Şekilde Sonlandırma (Kullanıcı Talebi veya Toplu İşlem Sonu)
router.post('/api/gib/force-logout', authMiddleware, async (req, res) => {
  const { username, credentials, token } = req.body;
  const userToLogout = credentials?.username || username;
  if (!userToLogout && !token) {
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı veya oturum anahtarı gereklidir.' });
  }
  const isTest = process.env.GIB_TEST_MODE === 'true';
  const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
  try {
    const result = await gibSessionManager.forceLogout(client, userToLogout, isTest ? 'TEST' : 'PROD', token);
    return res.json(result);
  } catch (error) {
    console.error('[GIB Force Logout] Hata:', error);
    return res.status(500).json({ success: false, message: 'Güvenli çıkış yapılırken hata: ' + error.message });
  }
});

router.post('/api/gib/logout', authMiddleware, async (req, res) => {
  const { username, credentials, token } = req.body;
  const userToLogout = credentials?.username || username;
  if (!userToLogout && !token) {
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı veya oturum anahtarı gereklidir.' });
  }
  const isTest = process.env.GIB_TEST_MODE === 'true';
  const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
  try {
    const result = await gibSessionManager.forceLogout(client, userToLogout, isTest ? 'TEST' : 'PROD', token);
    return res.json(result);
  } catch (error) {
    console.error('[GIB Logout] Hata:', error);
    return res.status(500).json({ success: false, message: 'Güvenli çıkış yapılırken hata: ' + error.message });
  }
});

// GİB Oturum Durumu
router.get('/api/gib/session-status', authMiddleware, async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.json({ active: false });
  }
  const isTest = process.env.GIB_TEST_MODE === 'true';
  const active = gibSessionManager.hasActiveSession(username, isTest ? 'TEST' : 'PROD');
  return res.json({ active });
});


// --- STOK (INVENTORY) MODULE ROUTES ---

// Helper for UUID generation if ID is missing
const ensureId = (id) => id || uuidv4();

// Categories

router.get('/api/cron/sync-elogo', async (req, res) => {
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
});


// ==========================================
// YAPAY ZEKA (AKILLI ÖĞRENME) KURALLARI
// ==========================================


router.get('/api/gib/dijital/captcha', async (req, res) => {
  try {
    const data = await dijitalGibClient.fetchCaptcha();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Giriş yap (Manuel veya otomatik captcha ile)
router.post('/api/gib/dijital/login', async (req, res) => {
  try {
    const { userid, password, captchaText, captchaCid, autoSolve, geminiApiKey } = req.body;
    if (!userid || !password) {
      return res.status(400).json({ success: false, message: 'Kullanıcı kodu ve şifre zorunludur.' });
    }

    if (autoSolve) {
      const apiKey = geminiApiKey || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      const result = await dijitalGibClient.autoLogin(userid, password, apiKey);
      return res.json(result);
    }

    if (!captchaText || !captchaCid) {
      return res.status(400).json({ success: false, message: 'Güvenlik kodu veya referansı eksik.' });
    }

    const result = await dijitalGibClient.login(userid, password, captchaText, captchaCid);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. e-Tebligat listele
router.post('/api/gib/dijital/tebligatlar', async (req, res) => {
  try {
    const { token, userid, password, pageNo, pageSize, arsivDurum, geminiApiKey } = req.body;
    let authToken = token;

    if (!authToken && userid && password) {
      const apiKey = geminiApiKey || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      const loginRes = await dijitalGibClient.autoLogin(userid, password, apiKey);
      if (!loginRes.success) {
        return res.status(401).json(loginRes);
      }
      authToken = loginRes.token;
    }

    if (!authToken) {
      return res.status(401).json({ success: false, message: 'Geçerli bir GİB oturum token\'ı veya giriş bilgisi bulunamadı.' });
    }

    const data = await dijitalGibClient.listTebligatlar({
      token: authToken,
      pageNo: Number(pageNo) || 1,
      pageSize: Number(pageSize) || 50,
      arsivDurum: arsivDurum !== undefined ? arsivDurum : null
    });

    res.json({ success: true, token: authToken, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.response?.data?.messages?.[0]?.text || err.message });
  }
});

// 4. Tebligat ekleri/belgeleri
router.post('/api/gib/dijital/tebligat-belgeleri', async (req, res) => {
  try {
    const { token, tebligId, tebligSecureId } = req.body;
    if (!token || !tebligId || !tebligSecureId) {
      return res.status(400).json({ success: false, message: 'Eksik parametreler (token, tebligId, tebligSecureId).' });
    }

    const data = await dijitalGibClient.getTebligatBelgeleri({ token, tebligId, tebligSecureId });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Tebligat belgesini / ekini indir
router.post('/api/gib/dijital/tebligat-indir', async (req, res) => {
  try {
    const { token, params, dosyaAdi } = req.body;
    if (!token || !params) {
      return res.status(400).json({ success: false, message: 'Eksik parametreler.' });
    }

    const linkData = await dijitalGibClient.getDocumentLink({ token, params });
    const reportLink = linkData?.reportLink || linkData?.data?.reportLink;
    if (!reportLink) {
      return res.status(404).json({ success: false, message: 'İndirme bağlantısı üretilemedi.' });
    }

    const pdfBuffer = await dijitalGibClient.downloadDocumentBuffer({ token, reportLink });
    const downloadName = (dosyaAdi || 'tebligat_belgesi').replace(/\.imz$/i, '') + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
