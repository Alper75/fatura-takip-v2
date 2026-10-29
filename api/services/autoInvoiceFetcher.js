import { client } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { XMLParser } from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import { ElogoClient } from './elogoClient.js';
import { UyumsoftClient } from './uyumsoftClient.js';
import { createFaturaClient } from '../fatura-client.js';
import { gibSessionManager } from '../gibSessionManager.js';
import { telegramBotService } from './telegramBot.js';
import { stockSyncService } from './stockSyncService.js';

class AutoInvoiceFetcherService {
  constructor() {
    this.schedulerTimer = null;
    this.isScanning = new Map(); // companyId -> boolean lock
  }

  async getCompanySettings(companyId) {
    const keys = [
      'auto_sync_enabled',
      'auto_sync_provider',
      'auto_sync_direction', // 'both' | 'incoming' | 'outgoing'
      'auto_sync_interval_mins',
      'auto_sync_notify_telegram',
      'auto_sync_last_run',
      'auto_sync_last_status',
      'elogo_username',
      'elogo_password',
      'elogo_is_test',
      'uyumsoft_username',
      'uyumsoft_password',
      'uyumsoft_is_test',
      'gib_username',
      'gib_password'
    ];
    const placeholders = keys.map(() => '?').join(',');
    const rs = await client.execute({
      sql: `SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN (${placeholders})`,
      args: [companyId, ...keys]
    });

    const settings = {
      auto_sync_enabled: 'false',
      auto_sync_provider: 'elogo',
      auto_sync_direction: 'both',
      auto_sync_interval_mins: '60',
      auto_sync_notify_telegram: 'true',
      auto_sync_last_run: null,
      auto_sync_last_status: null,
      elogo_is_test: 'false',
      uyumsoft_is_test: 'false'
    };

    for (const row of rs.rows) {
      settings[row.setting_key] = row.setting_value;
    }

    return settings;
  }

  async saveCompanySettings(companyId, updates) {
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && val !== null) {
        await client.execute({
          sql: `INSERT INTO company_settings (company_id, setting_key, setting_value) 
                VALUES (?, ?, ?) 
                ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value = ?`,
          args: [companyId, key, String(val), String(val)]
        });
      }
    }
  }

  async getLogs(companyId, limit = 25) {
    try {
      const rs = await client.execute({
        sql: `SELECT id, provider, run_at, status, new_count, details 
              FROM auto_sync_logs 
              WHERE company_id = ? 
              ORDER BY run_at DESC 
              LIMIT ?`,
        args: [companyId, limit]
      });
      return rs.rows;
    } catch (e) {
      console.warn('[AutoInvoiceFetcher] Log çekme uyarısı:', e.message);
      return [];
    }
  }

  async addLog(companyId, provider, status, newCount, details) {
    try {
      const id = 'asl_' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
      await client.execute({
        sql: `INSERT INTO auto_sync_logs (id, company_id, provider, run_at, status, new_count, details) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, companyId, provider, new Date().toISOString(), status, newCount, details]
      });
    } catch (e) {
      console.warn('[AutoInvoiceFetcher] Log yazma hatası:', e.message);
    }
  }

  /**
   * Bir firmanın gelen (Alış) ve giden (Satış) faturalarını sağlayıcı üzerinden tara ve yeni olanları içeri aktar.
   * İşletme Defteri ve Bilanço firmaları ile tam uyumlu çalışır.
   */
  async scanCompany(companyId, trigger = 'manual') {
    if (this.isScanning.get(companyId)) {
      return { success: false, message: 'Bu firma için tarama işlemi zaten devam ediyor.' };
    }

    this.isScanning.set(companyId, true);
    const settings = await this.getCompanySettings(companyId);
    const provider = settings.auto_sync_provider || 'elogo';
    const nowIso = new Date().toISOString();

    // Şirket defter türü tespiti (Bilanço mu İşletme Defteri mi?)
    let isIsletme = false;
    try {
      const compRs = await client.execute({
        sql: 'SELECT company_type FROM companies WHERE id = ?',
        args: [companyId]
      });
      const cType = (compRs.rows[0]?.company_type || '').toUpperCase();
      isIsletme = cType.includes('İŞLETME') || cType.includes('ISLETME');
    } catch (e) {}

    settings.isIsletme = isIsletme;

    console.log(`[AutoInvoiceFetcher] Tarama başlatıldı: Company ${companyId} (${isIsletme ? 'İşletme Defteri' : 'Bilanço'}), Provider: ${provider}, Yön: ${settings.auto_sync_direction}, Tetikleyici: ${trigger}`);

    try {
      let result;
      if (provider === 'elogo') {
        result = await this._scanElogo(companyId, settings);
      } else if (provider === 'uyumsoft') {
        result = await this._scanUyumsoft(companyId, settings);
      } else if (provider === 'gib') {
        result = await this._scanGib(companyId, settings);
      } else {
        throw new Error(`Bilinmeyen sağlayıcı: ${provider}`);
      }

      await this.saveCompanySettings(companyId, {
        auto_sync_last_run: nowIso,
        auto_sync_last_status: 'success'
      });

      const newInvs = result.newInvoices || [];
      const alisCount = newInvs.filter(i => i.tip !== 'satis').length;
      const satisCount = newInvs.filter(i => i.tip === 'satis').length;

      let details = '';
      if (newInvs.length > 0) {
        details = `${newInvs.length} yeni fatura sisteme aktarıldı (Alış/Gider: ${alisCount}, Satış/Gelir: ${satisCount}): ` +
          newInvs.slice(0, 5).map(i => `${i.faturaNo} (${i.tip === 'satis' ? i.aliciAdi : i.tedarikciAdi})`).join(', ');
        if (newInvs.length > 5) details += ` ve ${newInvs.length - 5} fatura daha.`;
      } else {
        details = result.totalFound ? `${result.totalFound} fatura kontrol edildi, yeni fatura yok.` : 'Yeni fatura bulunamadı.';
      }

      await this.addLog(companyId, provider, 'success', newInvs.length, details);

      // Telegram Bildirimi Gönder
      if (newInvs.length > 0 && settings.auto_sync_notify_telegram === 'true') {
        await this._sendTelegramNotification(companyId, newInvs, provider, isIsletme);
      }

      return {
        success: true,
        provider,
        newCount: newInvs.length,
        alisCount,
        satisCount,
        newInvoices: newInvs,
        message: details
      };
    } catch (error) {
      console.error(`[AutoInvoiceFetcher] Tarama Hatası (Company ${companyId}):`, error);
      await this.saveCompanySettings(companyId, {
        auto_sync_last_run: nowIso,
        auto_sync_last_status: 'error'
      });
      await this.addLog(companyId, provider, 'error', 0, 'Hata: ' + error.message);
      return {
        success: false,
        provider,
        message: error.message
      };
    } finally {
      this.isScanning.set(companyId, false);
    }
  }

  // --- 1. eLogo Tarama (Alış & Satış) ---
  async _scanElogo(companyId, settings) {
    if (!settings.elogo_username || !settings.elogo_password) {
      throw new Error('eLogo kullanıcı adı ve şifresi tanımlı değil.');
    }

    const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
    const endDate = new Date().toISOString();
    const beginDateObj = new Date();
    beginDateObj.setDate(beginDateObj.getDate() - 15); // Son 15 gün
    const beginDate = beginDateObj.toISOString();

    const direction = settings.auto_sync_direction || 'both';
    const scanIncoming = direction === 'both' || direction === 'incoming';
    const scanOutgoing = direction === 'both' || direction === 'outgoing';
    const isIsletme = !!settings.isIsletme;

    const newInvoices = [];
    let totalFound = 0;
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });

    // 1.1 GELEN (ALIŞ) FATURALARI
    if (scanIncoming) {
      try {
        const response = await elogo.getDocumentList('EINVOICE', beginDate, endDate, 2, 1);
        if (response.success) {
          const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
          const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
          totalFound += documents.length;

          for (const doc of documents) {
            const uuid = doc.documentUuid || doc.uuid;
            const docNo = doc.documentId || '';
            const exists = await this._isInvoiceExists(companyId, uuid, docNo, 'alis');
            if (exists || !uuid) continue;

            const docDataRes = await elogo.getDocumentData(uuid);
            if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) continue;

            const buffer = Buffer.from(docDataRes.data.document.binaryData.Value, 'base64');
            let xmlString = '';
            if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP
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

            const invoiceData = this._extractUblInvoice(inv, uuid, docNo, xmlString, 'incoming');
            const saved = await this._saveIncomingInvoice(companyId, invoiceData, isIsletme);
            if (saved) newInvoices.push(saved);
          }
        }
      } catch (err) {
        console.warn('[AutoInvoiceFetcher] eLogo Alış tarama hatası:', err.message);
      }
    }

    // 1.2 GİDEN (SATIŞ) FATURALARI (e-Fatura & e-Arşiv)
    if (scanOutgoing) {
      const outDocTypes = ['EINVOICE', 'EARCHIVE'];
      for (const dType of outDocTypes) {
        try {
          const response = await elogo.getDocumentList(dType, beginDate, endDate, 1, 1);
          if (response.success) {
            const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
            const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
            totalFound += documents.length;

            for (const doc of documents) {
              const uuid = doc.documentUuid || doc.uuid;
              const docNo = doc.documentId || '';
              const exists = await this._isInvoiceExists(companyId, uuid, docNo, 'satis');
              if (exists || !uuid) continue;

              const docDataRes = await elogo.getDocumentData(uuid);
              if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) continue;

              const buffer = Buffer.from(docDataRes.data.document.binaryData.Value, 'base64');
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

              const invoiceData = this._extractUblInvoice(inv, uuid, docNo, xmlString, 'outgoing');
              const saved = await this._saveOutgoingInvoice(companyId, invoiceData, isIsletme);
              if (saved) newInvoices.push(saved);
            }
          }
        } catch (err) {
          console.warn(`[AutoInvoiceFetcher] eLogo Satış (${dType}) tarama hatası:`, err.message);
        }
      }
    }

    return { totalFound, newInvoices };
  }

  // --- 2. Uyumsoft Tarama (Alış & Satış & e-SMM) ---
  async _scanUyumsoft(companyId, settings) {
    if (!settings.uyumsoft_username || !settings.uyumsoft_password) {
      throw new Error('Uyumsoft kullanıcı adı ve şifresi tanımlı değil.');
    }

    const uyumsoft = new UyumsoftClient(settings.uyumsoft_username, settings.uyumsoft_password, settings.uyumsoft_is_test === 'true');
    const endDate = new Date().toISOString();
    const beginDateObj = new Date();
    beginDateObj.setDate(beginDateObj.getDate() - 15);
    const beginDate = beginDateObj.toISOString();

    const direction = settings.auto_sync_direction || 'both';
    const scanIncoming = direction === 'both' || direction === 'incoming';
    const scanOutgoing = direction === 'both' || direction === 'outgoing';
    const isIsletme = !!settings.isIsletme;

    const newInvoices = [];
    let totalFound = 0;
    const ublParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });

    // 2.1 GELEN (ALIŞ) FATURALARI
    if (scanIncoming) {
      try {
        const response = await uyumsoft.getDocumentList('EINVOICE', beginDate, endDate, 2, 1);
        if (response.success) {
          const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
          const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
          totalFound += documents.length;

          for (const doc of documents) {
            const uuid = doc.documentUuid || doc.uuid;
            const docNo = doc.documentId || '';
            const exists = await this._isInvoiceExists(companyId, uuid, docNo, 'alis');
            if (exists || !uuid) continue;

            const docDataRes = await uyumsoft.getDocumentData(uuid);
            if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) continue;

            const buffer = Buffer.from(docDataRes.data.document.binaryData.Value, 'base64');
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

            const invoiceData = this._extractUblInvoice(inv, uuid, docNo, xmlString, 'incoming');
            const saved = await this._saveIncomingInvoice(companyId, invoiceData, isIsletme);
            if (saved) newInvoices.push(saved);
          }
        }
      } catch (err) {
        console.warn('[AutoInvoiceFetcher] Uyumsoft Alış tarama hatası:', err.message);
      }
    }

    // 2.2 GİDEN (SATIŞ) FATURALARI
    if (scanOutgoing) {
      const outTypes = ['EINVOICE', 'EARCHIVE'];
      for (const dType of outTypes) {
        try {
          const response = await uyumsoft.getDocumentList(dType, beginDate, endDate, 1, 1);
          if (response.success) {
            const docListRaw = response.data?.docList?.Document || response.data?.docList?.document || response.data?.GetDocumentListResult?.document || [];
            const documents = Array.isArray(docListRaw) ? docListRaw : (docListRaw ? [docListRaw] : []);
            totalFound += documents.length;

            for (const doc of documents) {
              const uuid = doc.documentUuid || doc.uuid;
              const docNo = doc.documentId || '';
              const exists = await this._isInvoiceExists(companyId, uuid, docNo, 'satis');
              if (exists || !uuid) continue;

              const docDataRes = await uyumsoft.getDocumentData(uuid);
              if (!docDataRes.success || !docDataRes.data?.document?.binaryData?.Value) continue;

              const buffer = Buffer.from(docDataRes.data.document.binaryData.Value, 'base64');
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

              const invoiceData = this._extractUblInvoice(inv, uuid, docNo, xmlString, 'outgoing');
              const saved = await this._saveOutgoingInvoice(companyId, invoiceData, isIsletme);
              if (saved) newInvoices.push(saved);
            }
          }
        } catch (err) {
          console.warn(`[AutoInvoiceFetcher] Uyumsoft Satış (${dType}) hatası:`, err.message);
        }
      }
    }

    return { totalFound, newInvoices };
  }

  // --- 3. GİB Portal Tarama (Alış & Satış) ---
  async _scanGib(companyId, settings) {
    if (!settings.gib_username || !settings.gib_password) {
      throw new Error('GİB kullanıcı kodu ve şifresi tanımlı değil.');
    }

    const isTest = process.env.GIB_TEST_MODE === 'true';
    const clientGib = createFaturaClient(isTest ? 'TEST' : 'PROD');
    const token = await gibSessionManager.getSessionToken(clientGib, settings.gib_username, settings.gib_password, isTest ? 'TEST' : 'PROD');

    const toGibDate = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const today = new Date();
    const past15 = new Date();
    past15.setDate(today.getDate() - 15);

    const direction = settings.auto_sync_direction || 'both';
    const scanIncoming = direction === 'both' || direction === 'incoming';
    const scanOutgoing = direction === 'both' || direction === 'outgoing';
    const isIsletme = !!settings.isIsletme;

    const newInvoices = [];
    let totalFound = 0;

    // 3.1 GİDEN (SATIŞ) FATURALARI
    if (scanOutgoing) {
      try {
        const outList = await clientGib.getAllInvoicesByDateRange(token, {
          startDate: toGibDate(past15),
          endDate: toGibDate(today)
        });
        const list = Array.isArray(outList) ? outList : [];
        totalFound += list.length;

        for (const inv of list) {
          const uuid = inv.ettn || inv.uuid || inv.faturaUuid;
          const docNo = inv.belgeNumarasi || inv.faturaNo;
          const exists = await this._isInvoiceExists(companyId, uuid, docNo, 'satis');
          if (exists) continue;

          const issueDate = inv.tarih ? inv.tarih.split('/').reverse().join('-') : new Date().toISOString().split('T')[0];
          const recipientName = inv.aliciUnvanAdSoyad || inv.unvan || 'GİB Müşteri';
          const recipientVkn = inv.aliciVergiNo || inv.vknTckn || '';
          const totalAmount = parseFloat(inv.odenecek || inv.toplamTutar || inv.vergilerDahilToplamTutar || 0);

          const invoiceData = {
            uuid,
            faturaNo: docNo || `GIB${Date.now()}`,
            faturaTarihi: issueDate,
            aliciAdi: recipientName,
            aliciVkn: recipientVkn,
            toplamTutar: totalAmount,
            kdvOrani: 20,
            kdvTutari: 0,
            matrah: totalAmount,
            faturaAciklama: isIsletme ? 'GİB İşletme Geliri (Satış Faturası)' : 'GİB e-Arşiv Satış Faturası'
          };

          const saved = await this._saveOutgoingInvoice(companyId, invoiceData, isIsletme);
          if (saved) newInvoices.push(saved);
        }
      } catch (err) {
        console.warn('[AutoInvoiceFetcher] GİB Satış faturaları tarama hatası:', err.message);
      }
    }

    // 3.2 GELEN (ALIŞ) FATURALARI (Adınıza Düzenlenenler)
    if (scanIncoming) {
      try {
        if (typeof clientGib.getAllInvoicesIssuedToMeByDateRange === 'function') {
          const inList = await clientGib.getAllInvoicesIssuedToMeByDateRange(token, {
            startDate: toGibDate(past15),
            endDate: toGibDate(today)
          });
          const list = Array.isArray(inList) ? inList : [];
          totalFound += list.length;

          for (const inv of list) {
            const uuid = inv.ettn || inv.uuid || inv.faturaUuid;
            const docNo = inv.belgeNumarasi || inv.faturaNo;
            const exists = await this._isInvoiceExists(companyId, uuid, docNo, 'alis');
            if (exists) continue;

            const issueDate = inv.tarih ? inv.tarih.split('/').reverse().join('-') : new Date().toISOString().split('T')[0];
            const senderName = inv.saticiUnvan || inv.aliciUnvanAdSoyad || inv.unvan || 'GİB Alış Fatura';
            const senderVkn = inv.saticiVergiNo || inv.aliciVergiNo || inv.vknTckn || '';
            const totalAmount = parseFloat(inv.odenecek || inv.toplamTutar || inv.vergilerDahilToplamTutar || 0);

            const invoiceData = {
              uuid,
              faturaNo: docNo || `GIB${Date.now()}`,
              faturaTarihi: issueDate,
              tedarikciAdi: senderName,
              tedarikciVkn: senderVkn,
              toplamTutar: totalAmount,
              kdvOrani: 20,
              kdvTutari: 0,
              matrah: totalAmount,
              faturaAciklama: isIsletme ? 'GİB İşletme Gideri (Alış Faturası)' : 'GİB e-Arşiv Alış Faturası'
            };

            const saved = await this._saveIncomingInvoice(companyId, invoiceData, isIsletme);
            if (saved) newInvoices.push(saved);
          }
        }
      } catch (err) {
        console.warn('[AutoInvoiceFetcher] GİB Gelen faturalar tarama hatası:', err.message);
      }
    }

    return { totalFound, newInvoices };
  }

  // --- Yardımcı: Faturanın Veritabanında Varlığını Kontrol Et ---
  async _isInvoiceExists(companyId, uuid, faturaNo, type = 'alis') {
    const table = type === 'satis' ? 'satis_faturalari' : 'alis_faturalari';
    if (uuid) {
      const rs = await client.execute({
        sql: `SELECT id FROM ${table} WHERE company_id = ? AND gib_uuid = ? LIMIT 1`,
        args: [companyId, uuid]
      });
      if (rs.rows.length > 0) return true;
    }

    if (faturaNo) {
      const rs = await client.execute({
        sql: `SELECT id FROM ${table} WHERE company_id = ? AND fatura_no = ? LIMIT 1`,
        args: [companyId, faturaNo]
      });
      if (rs.rows.length > 0) return true;
    }

    return false;
  }

  // --- Yardımcı: UBL Invoice Ayrıştırma (Gelen Alış veya Giden Satış) ---
  _extractUblInvoice(inv, uuid, defaultDocNo, xmlString, direction = 'incoming') {
    const getText = (node) => (typeof node === 'object' && node !== null) ? (node['#text'] || '') : (node || '');
    
    // Alışta tedarikçi (Supplier), Satışta müşteri (Customer) karşı taraftır
    const partyNode = direction === 'outgoing'
      ? (inv['AccountingCustomerParty']?.['Party'] || inv['AccountingCustomerParty'])
      : (inv['AccountingSupplierParty']?.['Party'] || inv['AccountingSupplierParty']);

    let partyName = 'Bilinmiyor';
    let partyVkn = '';

    if (partyNode) {
      const partyNameEl = Array.isArray(partyNode['PartyName']) ? partyNode['PartyName'][0] : partyNode['PartyName'];
      partyName = getText(partyNameEl?.['Name']) || getText(partyNode['PartyLegalEntity']?.['RegistrationName']) || (getText(partyNode['Person']?.['FirstName']) + ' ' + getText(partyNode['Person']?.['FamilyName'])).trim();
      
      const idNode = partyNode['PartyIdentification'];
      const idArray = Array.isArray(idNode) ? idNode : (idNode ? [idNode] : []);
      for (const ident of idArray) {
        const id = ident['ID'];
        if (!id) continue;
        const val = id['#text'] || id;
        if (val) {
          partyVkn = String(val).replace('.0', '');
          break;
        }
      }
    }

    const faturaNo = getText(inv['ID']) || defaultDocNo || `FAT${Date.now()}`;
    const issueDate = getText(inv['IssueDate']) || new Date().toISOString().split('T')[0];
    const totals = inv['LegalMonetaryTotal'];
    const totalAmount = parseFloat(getText(totals?.['PayableAmount'])) || 0;
    const matrah = parseFloat(getText(totals?.['TaxExclusiveAmount'])) || 0;

    let kdvTutari = 0;
    let kdvOrani = 20;
    const taxTotal = inv['TaxTotal'];
    const taxTotalArray = Array.isArray(taxTotal) ? taxTotal : (taxTotal ? [taxTotal] : []);
    for (const tt of taxTotalArray) {
      const subtotals = tt['TaxSubtotal'];
      if (!subtotals) continue;
      const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
      for (const sub of subArr) {
        const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
        const percent = parseFloat(getText(sub['Percent'])) || 0;
        kdvTutari += amount;
        if (percent > 0) kdvOrani = percent;
      }
    }

    const lines = inv['InvoiceLine'];
    const lineArr = Array.isArray(lines) ? lines : (lines ? [lines] : []);
    const itemsText = lineArr.map(l => {
      return getText(l?.['Item']?.['Name']) || 
             getText(l?.['Item']?.['Description']) || 
             getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) ||
             getText(l?.['Item']?.['BuyersItemIdentification']?.['ID']) ||
             '';
    }).filter(Boolean).join(', ');

    const rawItems = lineArr.map(l => {
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
        barcode: getText(l?.['Item']?.['SellersItemIdentification']?.['ID']) || getText(l?.['Item']?.['StandardItemIdentification']?.['ID']) || ''
      };
    });

    return {
      uuid,
      faturaNo,
      faturaTarihi: issueDate,
      tedarikciAdi: partyName || 'Bilinmeyen Tedarikçi',
      tedarikciVkn: partyVkn || '-',
      aliciAdi: partyName || 'Bilinmeyen Müşteri',
      aliciVkn: partyVkn || '-',
      toplamTutar: totalAmount,
      matrah,
      kdvOrani,
      kdvTutari,
      faturaAciklama: itemsText || (direction === 'outgoing' ? 'Otomatik Satış Faturası' : 'Otomatik Alış Faturası'),
      items: rawItems,
      direction
    };
  }

  // --- Yardımcı: Alış (Gider) Faturasını Kaydet ---
  async _saveIncomingInvoice(companyId, data, isIsletme = false) {
    const id = uuidv4();
    const payable = Number(data.toplamTutar) || 0;

    // Tedarikçi Cari Kartını Bul veya Oluştur
    let cariId = null;
    let muhasebeKodu = null;
    if (data.tedarikciVkn && data.tedarikciVkn !== '-') {
      const cariRs = await client.execute({
        sql: 'SELECT id, muhasebe_kodu FROM cariler WHERE company_id = ? AND vkn_tckn = ? LIMIT 1',
        args: [companyId, data.tedarikciVkn]
      });
      if (cariRs.rows.length > 0) {
        cariId = cariRs.rows[0].id;
        if (cariRs.rows[0].muhasebe_kodu) muhasebeKodu = cariRs.rows[0].muhasebe_kodu;
      } else {
        cariId = uuidv4();
        await client.execute({
          sql: `INSERT INTO cariler (id, unvan, vkn_tckn, tip, bakiye, olusturma_tarihi, company_id) 
                VALUES (?, ?, ?, 'tedarikci', 0, ?, ?)`,
          args: [cariId, data.tedarikciAdi, data.tedarikciVkn, new Date().toISOString().split('T')[0], companyId]
        }).catch(err => console.warn('Cari oluşturulamadı:', err.message));
      }
    }

    // Bilanço firması ise geçmiş alış faturalarından muhasebe kodu öğren
    if (!isIsletme && !muhasebeKodu && data.tedarikciVkn) {
      const pastAlis = await client.execute({
        sql: "SELECT muhasebe_kodu FROM alis_faturalari WHERE company_id = ? AND tedarikci_vkn = ? AND muhasebe_kodu IS NOT NULL AND muhasebe_kodu != '' ORDER BY id DESC LIMIT 1",
        args: [companyId, data.tedarikciVkn]
      });
      if (pastAlis.rows && pastAlis.rows.length > 0) {
        muhasebeKodu = pastAlis.rows[0].muhasebe_kodu;
      }
    }

    if (!isIsletme && !muhasebeKodu) {
      const textToSearch = `${data.tedarikciAdi || ''} ${data.faturaAciklama || ''}`.toUpperCase();
      if (/ELEKTRİK|ENERJİ|OTEL|KONAKLAMA|YEMEK|LOKANTA|RESTORAN|PETROL|AKARYAKIT|KOMİSYON|TELEKOM|TURKCELL|VODAFONE|KIRTASİYE/.test(textToSearch)) {
        muhasebeKodu = '770.03.001';
      }
    }

    const desc = isIsletme 
      ? `İşletme Gideri (${data.faturaNo}) - ${data.faturaAciklama || 'Alış'}` 
      : `Otomatik Alış Faturası (${data.faturaNo})`;

    // Alış Faturalarına Ekle
    await client.execute({
      sql: `INSERT INTO alis_faturalari 
        (id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, mal_hizmet_adi, 
         toplam_tutar, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
         stopaj_orani, stopaj_tutari, muhasebe_kodu, karsi_hesap_kodu, pdf_dosya, pdf_dosya_adi, 
         odeme_tarihi, odeme_durumu, odenen_tutar, kalan_tutar, cari_id, vade_tarihi, 
         aciklama, olusturma_tarihi, company_id, gib_uuid) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', 0, '0', 0, ?, null, null, null, null, 'odenmedi', 0, ?, ?, null, ?, ?, ?, ?)`,
      args: [
        id,
        data.faturaNo,
        data.faturaTarihi,
        data.tedarikciAdi,
        data.tedarikciVkn,
        data.faturaAciklama,
        payable,
        data.kdvOrani || 20,
        data.kdvTutari || 0,
        data.matrah || (payable - (data.kdvTutari || 0)),
        muhasebeKodu,
        payable,
        cariId,
        desc,
        new Date().toISOString().split('T')[0],
        companyId,
        data.uuid
      ]
    });

    // Cari Deftere Ekle
    if (cariId) {
      const chId = 'ch_' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
      await client.execute({
        sql: `INSERT INTO cari_hareketler (id, company_id, cari_id, tarih, islem_turu, tutar, aciklama, bagli_fatura_id, olusturma_tarihi)
              VALUES (?, ?, ?, ?, 'alis_faturasi', ?, ?, ?, ?)`,
        args: [
          chId,
          companyId,
          cariId,
          data.faturaTarihi,
          payable,
          `${data.faturaNo} nolu ${isIsletme ? 'işletme gider' : 'alış'} faturası`,
          id,
          new Date().toISOString().split('T')[0]
        ]
      }).catch(err => console.warn('Cari hareket eklenemedi:', err.message));
    }

    // Stok Hareketi (Bilanço Stok Hesapları İçin)
    if (!isIsletme && stockSyncService.isStockAccount(muhasebeKodu) && data.items && data.items.length > 0) {
      await stockSyncService.syncInvoiceStockMovements(companyId, {
        faturaId: id,
        faturaTipi: 'alis',
        items: data.items,
        faturaNo: data.faturaNo,
        faturaTarihi: data.faturaTarihi,
        muhasebeKodu
      }).catch(err => console.warn('[AutoInvoiceFetcher] Otomatik stok hareketi uyarısı:', err.message));
    }

    return {
      id,
      faturaNo: data.faturaNo,
      tedarikciAdi: data.tedarikciAdi,
      tutar: payable,
      tarih: data.faturaTarihi,
      tip: 'alis',
      isIsletme
    };
  }

  // --- Yardımcı: Satış (Gelir) Faturasını Kaydet ---
  async _saveOutgoingInvoice(companyId, data, isIsletme = false) {
    const id = uuidv4();
    const payable = Number(data.toplamTutar) || 0;

    // Müşteri Cari Kartını Bul veya Oluştur
    let cariId = null;
    let muhasebeKodu = null;
    if (data.aliciVkn && data.aliciVkn !== '-') {
      const cariRs = await client.execute({
        sql: 'SELECT id, muhasebe_kodu FROM cariler WHERE company_id = ? AND vkn_tckn = ? LIMIT 1',
        args: [companyId, data.aliciVkn]
      });
      if (cariRs.rows.length > 0) {
        cariId = cariRs.rows[0].id;
        if (cariRs.rows[0].muhasebe_kodu) muhasebeKodu = cariRs.rows[0].muhasebe_kodu;
      } else {
        cariId = uuidv4();
        await client.execute({
          sql: `INSERT INTO cariler (id, unvan, vkn_tckn, tip, bakiye, olusturma_tarihi, company_id) 
                VALUES (?, ?, ?, 'musteri', 0, ?, ?)`,
          args: [cariId, data.aliciAdi, data.aliciVkn, new Date().toISOString().split('T')[0], companyId]
        }).catch(err => console.warn('Müşteri cari oluşturulamadı:', err.message));
      }
    }

    if (!isIsletme && !muhasebeKodu) {
      muhasebeKodu = '600.01.020';
    }

    const desc = isIsletme
      ? `İşletme Geliri (${data.faturaNo}) - ${data.faturaAciklama || 'Satış'}`
      : `Otomatik Satış Faturası (${data.faturaNo})`;

    // Satış Faturalarına Ekle
    await client.execute({
      sql: `INSERT INTO satis_faturalari 
        (id, fatura_no, fatura_tarihi, ad, tc_vkn, 
         alinan_ucret, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, 
         stopaj_orani, stopaj_tutari, muhasebe_kodu, pdf_dosya, pdf_dosya_adi, 
         odeme_tarihi, odeme_durumu, odenen_tutar, kalan_tutar, cari_id, vade_tarihi, 
         aciklama, olusturma_tarihi, company_id, gib_uuid) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, null, null, null, 'odenmedi', 0, ?, ?, null, ?, ?, ?, ?)`,
      args: [
        id,
        data.faturaNo,
        data.faturaTarihi,
        data.aliciAdi,
        data.aliciVkn,
        payable,
        data.kdvOrani || 20,
        data.kdvTutari || 0,
        data.matrah || (payable - (data.kdvTutari || 0)),
        muhasebeKodu,
        payable,
        cariId,
        desc,
        new Date().toISOString(),
        companyId,
        data.uuid
      ]
    });

    // Cari Deftere Ekle (Satış Faturası Borç/Alacak Hareketi)
    if (cariId) {
      const chId = 'ch_' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
      await client.execute({
        sql: `INSERT INTO cari_hareketler (id, company_id, cari_id, tarih, islem_turu, tutar, aciklama, bagli_fatura_id, olusturma_tarihi)
              VALUES (?, ?, ?, ?, 'satis_faturasi', ?, ?, ?, ?)`,
        args: [
          chId,
          companyId,
          cariId,
          data.faturaTarihi,
          payable,
          `${data.faturaNo} nolu ${isIsletme ? 'işletme gelir' : 'satış'} faturası`,
          id,
          new Date().toISOString().split('T')[0]
        ]
      }).catch(err => console.warn('Cari hareket eklenemedi:', err.message));
    }

    return {
      id,
      faturaNo: data.faturaNo,
      aliciAdi: data.aliciAdi,
      tutar: payable,
      tarih: data.faturaTarihi,
      tip: 'satis',
      isIsletme
    };
  }

  // --- Telegram Bildirimi Hazırla ve Gönder ---
  async _sendTelegramNotification(companyId, newInvoices, provider, isIsletme = false) {
    try {
      const compRs = await client.execute({
        sql: 'SELECT name FROM companies WHERE id = ?',
        args: [companyId]
      });
      const compName = compRs.rows[0]?.name || 'Şirketiniz';

      const alisList = newInvoices.filter(i => i.tip !== 'satis');
      const satisList = newInvoices.filter(i => i.tip === 'satis');

      let msg = `🔔 *Yeni e-Fatura Entegrasyon Bildirimi!*\n`;
      msg += `🏢 *Firma:* ${compName} _(${isIsletme ? 'İşletme Defteri' : 'Bilanço'})_\n`;
      msg += `🔌 *Entegratör:* ${provider.toUpperCase()}\n`;
      msg += `📥 *Toplam:* ${newInvoices.length} yeni fatura aktarıldı\n`;
      if (alisList.length > 0) msg += `   🔹 Alış / Gider: ${alisList.length} adet\n`;
      if (satisList.length > 0) msg += `   🔸 Satış / Gelir: ${satisList.length} adet\n\n`;

      newInvoices.slice(0, 6).forEach((inv, index) => {
        const isSatis = inv.tip === 'satis';
        const partner = isSatis ? inv.aliciAdi : inv.tedarikciAdi;
        const icon = isSatis ? '📤 [Satış/Gelir]' : '📥 [Alış/Gider]';
        msg += `*${index + 1}. ${icon} ${partner}*\n`;
        msg += `   📄 No: \`${inv.faturaNo}\`\n`;
        msg += `   💰 Tutar: *${Number(inv.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺*\n`;
        msg += `   📅 Tarih: ${inv.tarih}\n\n`;
      });

      if (newInvoices.length > 6) {
        msg += `_...ve ${newInvoices.length - 6} adet daha belge._\n\n`;
      }

      msg += isIsletme 
        ? `✅ Faturalar İşletme Defteri Gelir & Gider listelerine eklenmiş, Luca Hızlı Fiş için hazır hale getirilmiştir.`
        : `✅ Faturalar Alış ve Satış listelerinize eklenmiş ve carilerine işlenmiştir.`;

      await telegramBotService.broadcast(msg);
    } catch (e) {
      console.warn('[AutoInvoiceFetcher] Telegram bildirim hatası:', e.message);
    }
  }

  // --- Periyodik Arka Plan Zamanlayıcı ---
  startScheduler() {
    if (this.schedulerTimer) return;
    console.log('[AutoInvoiceFetcher] Zamanlayıcı başlatıldı (60 saniyelik periyot).');

    this.schedulerTimer = setInterval(async () => {
      try {
        const rs = await client.execute(`
          SELECT company_id, setting_value 
          FROM company_settings 
          WHERE setting_key = 'auto_sync_enabled' AND setting_value = 'true'
        `);

        for (const row of rs.rows) {
          const companyId = row.company_id;
          const settings = await this.getCompanySettings(companyId);
          const intervalMins = parseInt(settings.auto_sync_interval_mins || '60', 10);
          const lastRun = settings.auto_sync_last_run ? new Date(settings.auto_sync_last_run).getTime() : 0;
          const now = Date.now();

          if (now - lastRun >= intervalMins * 60 * 1000) {
            console.log(`[AutoInvoiceFetcher] Zamanlanmış tarama tetikleniyor: Company ${companyId}`);
            this.scanCompany(companyId, 'scheduler').catch(err => {
              console.error(`[AutoInvoiceFetcher] Scheduler hatası (${companyId}):`, err.message);
            });
          }
        }
      } catch (err) {
        console.warn('[AutoInvoiceFetcher] Scheduler döngü hatası:', err.message);
      }
    }, 60 * 1000);
  }

  stopScheduler() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
      console.log('[AutoInvoiceFetcher] Zamanlayıcı durduruldu.');
    }
  }
}

export const autoInvoiceFetcher = new AutoInvoiceFetcherService();
