const fs = require('fs');
const path = 'c:/Users/Alper/Desktop/fatura/v2_app/api/index.js';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '// --- GİB API ROUTES (e-fatura npm paketi ile) ---';
const endMarker = '// --- STOK (INVENTORY) MODULE ROUTES ---';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  
  const newLogic = `// --- GİB API ROUTES (Custom FaturaClient ile) ---
import { createFaturaClient } from './fatura-client.js';

function formatGIBTime(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return \`\${hh}:\${mm}:\${ss}\`;
}

app.post('/api/gib/create-draft', authMiddleware, async (req, res) => {
  const { credentials, invoice, autoSign } = req.body;
  if (!credentials?.username || !credentials?.password)
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı ve şifre gereklidir.' });
  if (!invoice)
    return res.status(400).json({ success: false, message: 'Fatura verisi eksik.' });

  const vknStr = String(invoice.vknTckn || '').trim().replace(/\\s/g, '');
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
      const price = parseFloat(k.birimFiyat) || 0;
      const vatRate = parseFloat(k.kdvOrani) || 0;
      
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

      return {
        name: k.ad || 'Hizmet',
        quantity: qty,
        unitPrice: price,
        price: price,
        VATRate: vatRate,
        VATAmount: itemKdv,
        tevkifatKodu: k.tevkifatKodu || '',
        tevkifatOrani: tevkifatOrani > 0 && tevkifatOrani < 10 ? tevkifatOrani : (tevkifatOrani >= 10 ? tevkifatOrani / 10 : 0),
        tevkifatAmount: itemTevkifat,
        stopajRate: stopajRate,
        stopajAmount: itemStopaj,
        unitType: k.birim || 'C62'
      };
    });
  } else {
    const matrah = invoice.kdvDahil ? invoice.tutar / (1 + (invoice.kdvOrani || 20) / 100) : invoice.tutar;
    const itemKdv = matrah * ((invoice.kdvOrani || 20) / 100);
    
    subtotal = matrah;
    vatAmount = itemKdv;

    items = [{
      name: invoice.aciklama || 'Hizmet / Mal Bedeli',
      quantity: 1,
      unitPrice: matrah,
      price: matrah,
      VATRate: invoice.kdvOrani || 20,
      VATAmount: itemKdv,
      tevkifatKodu: '',
      tevkifatOrani: 0,
      tevkifatAmount: 0,
      stopajRate: 0,
      stopajAmount: 0,
      unitType: 'C62'
    }];
  }

  const grandTotalInclVAT = subtotal + vatAmount;
  const paymentTotal = subtotal + vatAmount - stopajAmount - tevkifatAmount;

  const now = new Date();
  const dateParts = invoice.faturaTarihi ? invoice.faturaTarihi.split('-') : [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')];
  
  const invoiceDetails = {
    date: \`\${dateParts[2]}/\${dateParts[1]}/\${dateParts[0]}\`,
    time: formatGIBTime(now),
    taxIDOrTRID: vknStr,
    title: \`\${invoice.ad || ''} \${invoice.soyad || ''}\`.trim(),
    name: invoice.ad || '',
    surname: invoice.soyad || '',
    invoiceType: invoice.faturaTipi || 'SATIS',
    fullAddress: invoice.adres || 'Adres Bulunmuyor',
    district: invoice.ilce || '',
    city: invoice.il || '',
    items: items,
    subtotal: subtotal,
    totalVAT: vatAmount,
    totalStopaj: stopajAmount,
    totalTevkifat: tevkifatAmount,
    gelirVergisiOrani: parseFloat(invoice.stopajOrani) || 0,
    gelirVergisiTevkifatiTutari: stopajAmount.toFixed(2),
    grandTotalInclVAT: grandTotalInclVAT,
    paymentTotal: paymentTotal,
    note: invoice.aciklama || ''
  };

  try {
    const isTest = process.env.GIB_TEST_MODE === 'true';
    const client = createFaturaClient(isTest ? 'TEST' : 'PROD');
    
    const token = await client.getToken(credentials.username, credentials.password);
    const createdInvoice = await client.createDraftInvoice(token, invoiceDetails);
    const invoiceUUID = createdInvoice.uuid;

    let signResult = null;
    if (autoSign === true) {
      signResult = await client.signDraftInvoice(token, createdInvoice);
    }

    await client.logout(token);

    return res.json({
      success: true,
      message: autoSign ? 'Fatura başarıyla oluşturuldu ve imzalandı.' : 'Fatura taslak olarak GİB portalına gönderildi.',
      data: { invoiceUUID, signed: autoSign === true, signResult }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'GİB fatura hatası: ' + error.message,
    });
  }
});\n\n`;

  fs.writeFileSync(path, before + newLogic + after, 'utf8');
  console.log('Replaced successfully');
} else {
  console.log('Markers not found!');
}
