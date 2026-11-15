import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { createFaturaClient } from '../fatura-client.js';
import { gibSessionManager } from '../gibSessionManager.js';
import { dijitalGibClient } from '../services/dijitalGibClient.js';

function formatGIBTime(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

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

export async function gibCreateDraft(req, res) {
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
}

export async function gibRecipientInfo(req, res) {
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
}

export async function gibGetInvoices(req, res) {
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
}

export async function gibDownloadPdf(req, res) {
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
}

export async function gibInvoiceDetails(req, res) {
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
}

export async function gibForceLogout(req, res) {
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
}

export async function gibLogout(req, res) {
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
}

export async function gibSessionStatus(req, res) {
  const username = req.query.username;
  if (!username) {
    return res.json({ active: false });
  }
  const isTest = process.env.GIB_TEST_MODE === 'true';
  const active = gibSessionManager.hasActiveSession(username, isTest ? 'TEST' : 'PROD');
  return res.json({ active });
}

export async function gibDijitalCaptcha(req, res) {
  try {
    const data = await dijitalGibClient.fetchCaptcha();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function gibDijitalLogin(req, res) {
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
}

export async function gibDijitalTebligatlar(req, res) {
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
}

export async function gibDijitalTebligatBelgeleri(req, res) {
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
}

export async function gibDijitalTebligatIndir(req, res) {
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
}
