import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { createInvoiceAndGetHTML } from 'fatura';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { XMLParser } from 'fast-xml-parser';
import crypto from 'crypto';

import { client, initDb } from './db.js';
import { generateToken, authMiddleware, adminMiddleware, superAdminMiddleware, bcrypt } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We now call initDb() automatically to ensure the new 'status' column is added.
initDb().catch(e => console.error('Startup DB Init Error:', e));

// BigInt Serialization Fix for LibSQL
BigInt.prototype.toJSON = function() { return this.toString() };

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Global Error Catch for Startup Failures
app.use((req, res, next) => {
  if (!client) {
    return res.status(500).json({ 
      success: false, 
      message: 'Vercel Ayarı Eksik: TURSO_URL tanımlı değil.',
      error: 'Lütfen Vercel Dashboard > Project Settings > Environment Variables kısmından TURSO_URL ve TURSO_AUTH_TOKEN eklediğinizden ve projenizi "Redeploy" ettiğinizden emin olun.'
    });
  }
  next();
});

// Vercel /tmp directory for ephemeral uploads
const isVercel = process.env.VERCEL;
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// XML Parser for UBL-TR Invoice
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false, // IDs like VKN/TCKN won't be converted to numbers (prevents .0)
});

app.post('/api/invoices/parse-xml', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'XML dosyası gereklidir.' });
  
  try {
    const xmlContent = fs.readFileSync(req.file.path, 'utf-8');
    const jsonObj = parser.parse(xmlContent);
    let parsedData = null;

    // --- CASE 1: Standard UBL-TR Invoice ---
    if (jsonObj.Invoice) {
      const inv = jsonObj.Invoice;
      
      const supplierParty = inv['AccountingSupplierParty']?.['Party'];
      const customerParty = inv['AccountingCustomerParty']?.['Party'];
      
      const getVkn = (party) => {
        const id = party?.['PartyIdentification']?.['ID'];
        const val = Array.isArray(id) ? id.find(v => v['@_schemeID'] === 'VKN' || v['@_schemeID'] === 'TCKN')?.['#text'] : id?.['#text'] || id;
        return val ? String(val).replace('.0', '') : '';
      };
      const getAd = (party) => party?.['PartyName']?.['Name'] || party?.['Person']?.['FirstName'] || '';
      const getSoyad = (party) => party?.['Person']?.['FamilyName'] || '';
      const getTaxOffice = (party) => party?.['PartyTaxScheme']?.['TaxScheme']?.['Name'] || '';
      const getAddress = (party) => {
        const addr = party?.['PostalAddress'];
        if (!addr) return '';
        return `${addr['StreetName'] || ''} ${addr['BuildingNumber'] || ''} ${addr['CitySubdivisionName'] || ''} ${addr['CityName'] || ''}`;
      };

      const monTotal = inv['LegalMonetaryTotal'];
      const taxTotal = inv['TaxTotal'];

      parsedData = {
        faturaNo: inv['ID'],
        faturaTarihi: inv['IssueDate'],
        supplier: {
          vkn: getVkn(supplierParty),
          ad: getAd(supplierParty),
          soyad: getSoyad(supplierParty),
          vergiDairesi: getTaxOffice(supplierParty),
          adres: getAddress(supplierParty),
        },
        customer: {
          vkn: getVkn(customerParty),
          ad: getAd(customerParty),
          soyad: getSoyad(customerParty),
          vergiDairesi: getTaxOffice(customerParty),
          adres: getAddress(customerParty),
        },
        matrah: parseFloat(monTotal?.['TaxExclusiveAmount']?.['#text'] || monTotal?.['TaxExclusiveAmount'] || 0),
        toplamTutar: parseFloat(monTotal?.['PayableAmount']?.['#text'] || monTotal?.['PayableAmount'] || 0),
        kdvTutari: parseFloat(taxTotal?.['TaxAmount']?.['#text'] || taxTotal?.['TaxAmount'] || 0),
        kdvOrani: 20,
        type: 'Invoice'
      };

      const lines = inv['InvoiceLine'];
      if (lines) {
        const lineArr = Array.isArray(lines) ? lines : [lines];
        parsedData.items = lineArr.map(l => ({
          name: l['Item']?.['Name'],
          quantity: parseFloat(l['InvoicedQuantity']?.['#text'] || l['InvoicedQuantity'] || 0),
          price: parseFloat(l['Price']?.['PriceAmount']?.['#text'] || l['Price']?.['PriceAmount'] || 0),
        }));
      }
    } 
    // --- CASE 2: e-SMM (VoucherSource) ---
    else if (jsonObj['VoucherSource']?.['eArsivVeriSerbestMeslekMakbuz']) {
      const smm = jsonObj['VoucherSource']['eArsivVeriSerbestMeslekMakbuz'];
      const alici = smm['aliciBilgileri'];
      
      const getVkn = (a) => {
        const val = a?.['tuzelKisi']?.['vkn'] || a?.['gercekKisi']?.['tckn'] || '';
        return val ? String(val).replace('.0', '') : '';
      };
      const getAd = (a) => a?.['tuzelKisi']?.['unvan'] || (a?.['gercekKisi']?.['ad'] ? `${a['gercekKisi']['ad']} ${a['gercekKisi']['soyad']}` : '');
      const getAddress = (a) => {
        const addr = a?.['adres'];
        if (!addr) return '';
        return `${addr['caddeSokak'] || ''} ${addr['semt'] || ''} ${addr['sehir'] || ''}`;
      };

      const vergiBilgisi = smm['vergiBilgisi']?.['vergi'];
      const vergiler = Array.isArray(vergiBilgisi) ? vergiBilgisi : (vergiBilgisi ? [vergiBilgisi] : []);
      
      const kdvVergisi = vergiler.find(v => v['vergiKodu'] === '0015');
      const stopajVergisi = vergiler.find(v => v['vergiKodu'] === '0003' || v['vergiKodu'] === '0011');
      
      const kdv = kdvVergisi?.['vergiTutari'] || 0;
      const stopaj = stopajVergisi?.['vergiTutari'] || 0;
      
      // Calculate rates from XML (or default)
      const kdvMatrah = parseFloat(kdvVergisi?.['matrah'] || 0);
      const calculatedKdvOrani = (kdvMatrah > 0 && kdv > 0) ? Math.round((parseFloat(kdv) / kdvMatrah) * 100) : 20;
      
      const stopajMatrah = parseFloat(stopajVergisi?.['matrah'] || 0);
      const calculatedStopajOrani = (stopajMatrah > 0 && stopaj > 0) ? Math.round((parseFloat(stopaj) / stopajMatrah) * 100) : 0;

      const tevkifatBilgisi = smm['vergiBilgisi']?.['tevkifat'];
      const tevkifatlar = Array.isArray(tevkifatBilgisi) ? tevkifatBilgisi : (tevkifatBilgisi ? [tevkifatBilgisi] : []);
      const tevkifat = tevkifatlar[0];

      const convertTevkifat = (val) => {
        if (!val) return '0';
        const num = parseFloat(val);
        if (Math.abs(num - 20) < 0.1) return '2/10';
        if (Math.abs(num - 30) < 0.1) return '3/10';
        if (Math.abs(num - 40) < 0.1) return '4/10';
        if (Math.abs(num - 50) < 0.1) return '5/10';
        if (Math.abs(num - 70) < 0.1) return '7/10';
        if (Math.abs(num - 90) < 0.1) return '9/10';
        if (Math.abs(num - 100) < 0.1) return '10/10';
        return val.toString();
      };

      // Matrah is usually the "Gross" (Bürüt) in SMM
      const malHizmet = smm['malHizmetBilgisi']?.['malHizmet'];
      const lines = Array.isArray(malHizmet) ? malHizmet : (malHizmet ? [malHizmet] : []);
      const burutUcret = lines.reduce((sum, item) => sum + parseFloat(item['burutUcret'] || 0), 0);

      const stopajVergiKodu = stopajVergisi?.['vergiKodu'];
      const stopajKodu = stopajVergisi ? (stopajVergiKodu === '0003' ? '022' : stopajVergiKodu) : '';

      parsedData = {
        faturaNo: smm['makbuzNo'],
        faturaTarihi: smm['belgeTarihi'],
        supplier: {
          vkn: '',
          ad: 'Serbest Meslek Erbabı',
          vergiDairesi: '',
          adres: '',
        },
        customer: {
          vkn: getVkn(alici),
          ad: getAd(alici),
          vergiDairesi: alici?.['adres']?.['vDaire'] || '',
          adres: getAddress(alici),
        },
        matrah: burutUcret || kdvMatrah || parseFloat(smm['toplamTutar'] || 0),
        toplamTutar: parseFloat(smm['odenecekTutar'] || 0),
        kdvTutari: parseFloat(kdv),
        kdvOrani: calculatedKdvOrani,
        stopajTutari: parseFloat(stopaj),
        stopajOrani: calculatedStopajOrani.toString(),
        stopajKodu: stopajKodu,
        tevkifatTutari: parseFloat(tevkifat?.['tevkifatTutari'] || 0),
        tevkifatOrani: convertTevkifat(tevkifat?.['tevkifatOrani']),
        tevkifatKodu: tevkifat ? (tevkifat['tevkifatKodu'] || '') : '',
        type: 'e-SMM'
      };

      if (lines.length > 0) {
        parsedData.items = lines.map(l => ({
          name: l['ad'],
          quantity: 1,
          price: parseFloat(l['burutUcret'] || 0),
        }));
      }
    } else {
      throw new Error('Geçersiz XML formatı: Invoice veya e-SMM kök etiketi bulunamadı.');
    }

    res.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('XML Parse Error:', error);
    res.status(500).json({ success: false, message: 'XML ayrıştırma hatası: ' + error.message });
  } finally {
    // Cleanup
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// --- GİB PORTAL LOGIC ---
const USE_TEST_MODE = false;

// --- PERSONNEL MODULE ROUTES ---

// Login
app.post('/api/auth/login', async (req, res) => {
  const { tc, password } = req.body;
  if (!tc || !password) return res.status(400).json({ success: false, message: 'TC ve şifre gereklidir.' });
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM users WHERE tc = ?',
      args: [tc]
    });
    const user = rs.rows[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Geçersiz TC veya şifre.' });
    }

    // Check Company Status
    const compRs = await client.execute({
      sql: 'SELECT status FROM companies WHERE id = ?',
      args: [user.company_id || 1]
    });
    const company = compRs.rows[0];
    if (company && company.status === 'passive') {
      return res.status(403).json({ success: false, message: 'Şirket hesabınız pasif durumdadır. Lütfen yönetici ile iletişime geçin.' });
    }

    const token = generateToken(user);
    res.json({ success: true, token, user: { id: user.id, tc: user.tc, role: user.role, companyId: user.company_id, mustChangePassword: !!user.must_change_password } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ success: false, message: 'Yeni şifre gereklidir.' });
  try {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await client.execute({
      sql: 'UPDATE users SET password = ?, must_change_password = 0 WHERE id = ? AND company_id = ?',
      args: [hashedPassword, req.user.id, req.user.companyId]
    });
    res.json({ success: true, message: 'Şifre başarıyla değiştirildi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/personnel/me', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM personnel WHERE user_id = ? AND company_id = ?',
      args: [req.user.id, req.user.companyId]
    });
    res.json({ success: true, personnel: rs.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- SUPER ADMIN COMPANIES ---

// List all companies
app.get('/api/super/companies', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute('SELECT * FROM companies ORDER BY id DESC');
    res.json({ success: true, data: rs.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new company with its first admin
app.post('/api/super/companies', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { name, tax_no, address, email, admin_tc, admin_password, status, company_type } = req.body;
  
  if (!name) return res.status(400).json({ success: false, message: 'Şirket adı gereklidir.' });

  try {
    // 1. Create Company
    const compResult = await client.execute({
      sql: 'INSERT INTO companies (name, tax_no, address, email, status, company_type) VALUES (?, ?, ?, ?, ?, ?)',
      args: [name, n(tax_no), n(address), n(email), status || 'active', company_type || 'BİLANÇO']
    });
    const newCompanyId = Number(compResult.lastInsertRowid);

    // 2. Create Admin User if provided
    if (admin_tc && admin_password) {
      const hashedPassword = bcrypt.hashSync(admin_password, 10);
      await client.execute({
        sql: 'INSERT INTO users (tc, password, role, company_id, must_change_password) VALUES (?, ?, ?, ?, ?)',
        args: [admin_tc, hashedPassword, 'admin', newCompanyId, 0]
      });
    }

    res.json({ success: true, message: 'Şirket ve yönetici hesabı oluşturuldu.', companyId: newCompanyId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update company
app.put('/api/super/companies/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, tax_no, address, email, status, company_type } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE companies SET name = ?, tax_no = ?, address = ?, email = ?, status = ?, company_type = ? WHERE id = ?',
      args: [name, n(tax_no), n(address), n(email), status || 'active', company_type || 'BİLANÇO', id]
    });
    res.json({ success: true, message: 'Şirket bilgileri güncellendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete company
app.delete('/api/super/companies/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { id } = req.params;
  if (Number(id) === 1) return res.status(400).json({ success: false, message: 'Varsayılan şirket silinemez.' });
  
  try {
    // Not: Gerçek senaryoda cascading delete veya soft-delete tercih edilmeli.
    // Şimdilik sadece şirketi siliyoruz.
    await client.execute({
      sql: 'DELETE FROM companies WHERE id = ?',
      args: [id]
    });
    res.json({ success: true, message: 'Şirket silindi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper to calculate annual leave based on seniority
const calculateAnnualLeave = (startDate) => {
  if (!startDate) return 14;
  const start = new Date(startDate);
  const now = new Date();
  const years = now.getFullYear() - start.getFullYear();
  const isAnniversaryPassed = (now.getMonth() > start.getMonth()) || 
                               (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  const seniority = isAnniversaryPassed ? years : years - 1;

  if (seniority < 1) return 0; // Henüz 1 yıl dolmadıysa hakediş yok (veya 14 de denebilir ama yasal kural 1 yıl dolunca başlar)
  if (seniority >= 1 && seniority <= 5) return 14;
  if (seniority > 5 && seniority < 15) return 20;
  if (seniority >= 15) return 26;
  return 14;
};

app.get('/api/admin/personnel', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT p.*, u.tc, u.must_change_password 
        FROM personnel p 
        JOIN users u ON p.user_id = u.id
        WHERE p.company_id = ?
        ORDER BY p.first_name ASC
      `,
      args: [req.user.companyId]
    });
    res.json({ success: true, personnel: rs.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/personnel', authMiddleware, adminMiddleware, async (req, res) => {
  const { tc, first_name, last_name, email, phone, position, department, salary, annual_leave_days, start_date, end_date, puantaj_menu_active } = req.body;
  if (!tc || !first_name || !last_name) {
    return res.status(400).json({ success: false, message: 'TC, isim ve soyisim gereklidir.' });
  }
  try {
    const defaultPassword = bcrypt.hashSync('123456', 10);
    const userResult = await client.execute({
      sql: 'INSERT INTO users (tc, password, role, company_id) VALUES (?, ?, ?, ?)',
      args: [tc, defaultPassword, 'personnel', req.user.companyId]
    });
    
    // If annual_leave_days is not provided, calculate it
    const calculatedLeave = annual_leave_days || calculateAnnualLeave(start_date);

    await client.execute({
      sql: `
        INSERT INTO personnel (
          user_id, first_name, last_name, email, phone, 
          position, department, salary, annual_leave_days, 
          status, start_date, end_date, puantaj_menu_active, company_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        Number(userResult.lastInsertRowid), first_name, last_name, email, phone, 
        position, department, salary, calculatedLeave, 'Active', 
        start_date, end_date, puantaj_menu_active ? 1 : 0, req.user.companyId
      ]
    });
    res.json({ success: true, message: 'Personel başarıyla oluşturuldu.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/personnel/bulk-upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Excel dosyası gereklidir.' });
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const defaultPassword = bcrypt.hashSync('123456', 10);

    const findField = (row, fields) => {
      const key = Object.keys(row).find(k => fields.some(f => k.toLowerCase() === f.toLowerCase()));
      return key ? row[key] : null;
    };

    let count = 0;
    for (const row of data) {
      const tc = findField(row, ['TC', 'TCKN', 'Kimlik', 'tc_no']);
      const ad = findField(row, ['Ad', 'İsim', 'First Name', 'firstName']);
      const soyad = findField(row, ['Soyad', 'Last Name', 'lastName']);
      
      if (!tc || !ad || !soyad) continue;

      try {
        const userResult = await client.execute({
          sql: 'INSERT OR IGNORE INTO users (tc, password, role, company_id) VALUES (?, ?, ?, ?)',
          args: [tc.toString(), defaultPassword, 'personnel', req.user.companyId]
        });
        
        if (userResult.rowsAffected > 0) {
          await client.execute({
            sql: 'INSERT INTO personnel (user_id, first_name, last_name, email, phone, position, department, salary, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [
              Number(userResult.lastInsertRowid), 
              ad, soyad, 
              findField(row, ['Email', 'E-posta', 'Mail']), 
              findField(row, ['Telefon', 'Phone', 'Tel']), 
              findField(row, ['Pozisyon', 'Position', 'Görev']), 
              findField(row, ['Departman', 'Department', 'Bölüm']), 
              findField(row, ['Maaş', 'Maas', 'Salary']),
              req.user.companyId
            ]
          });
          count++;
        }
      } catch (e) {
        console.error(`Row insert failed for ${tc}:`, e.message);
      }
    }
    
    res.json({ success: true, message: `${count} yeni personel başarıyla eklendi.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Excel işleme hatası: ' + error.message });
  }
});

// Delete personnel (admin)
app.delete('/api/admin/personnel/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const rs = await client.execute({
      sql: 'SELECT user_id FROM personnel WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    const p = rs.rows[0];
    if (p && p.user_id) {
      await client.execute({
        sql: 'DELETE FROM users WHERE id = ? AND company_id = ?',
        args: [p.user_id, req.user.companyId]
      });
    }
    await client.execute({
      sql: 'DELETE FROM personnel WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    res.json({ success: true, message: 'Personel silindi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Update personnel (admin) - MOVED & CONSOLIDATED
app.put('/api/admin/personnel/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, phone, position, department, salary, annual_leave_days, status, start_date, end_date, puantaj_menu_active } = req.body;
  try {
    await client.execute({
      sql: `
        UPDATE personnel SET 
          first_name = ?, last_name = ?, email = ?, phone = ?, 
          position = ?, department = ?, salary = ?, annual_leave_days = ?, status = ?,
          start_date = ?, end_date = ?, puantaj_menu_active = ?
        WHERE id = ? AND company_id = ?
      `,
      args: [
        n(first_name), n(last_name), n(email), n(phone), 
        n(position), n(department), n(salary), n(annual_leave_days), 
        status || 'Active', n(start_date), n(end_date), (puantaj_menu_active === true || puantaj_menu_active == 1) ? 1 : 0, 
        id, req.user.companyId
      ]
    });
    res.json({ success: true, message: 'Personel güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// --- LEAVES ---
app.get('/api/admin/leaves', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT l.*, p.first_name, p.last_name 
        FROM leaves l 
        JOIN personnel p ON l.personnel_id = p.id
        WHERE l.company_id = ?
        ORDER BY l.created_at DESC
      `,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/personnel/leaves', authMiddleware, upload.single('document'), async (req, res) => {
  const { type, start_date, end_date, description } = req.body;
  const document_path = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const rsP = await client.execute({
      sql: 'SELECT id FROM personnel WHERE user_id = ? AND company_id = ?',
      args: [req.user.id, req.user.companyId]
    });
    const p = rsP.rows[0];
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    
    await client.execute({
      sql: 'INSERT INTO leaves (personnel_id, type, start_date, end_date, description, document_path, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [p.id, n(type), n(start_date), n(end_date), n(description), n(document_path), req.user.companyId]
    });
    res.json({ success: true, message: 'İzin talebi iletildi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/admin/leaves/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED', 'REJECTED'
  try {
    const rsL = await client.execute({
      sql: 'SELECT * FROM leaves WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    const leave = rsL.rows[0];
    if (!leave) return res.status(404).json({ success: false, message: 'İzin kaydı bulunamadı.' });

    if (status === 'APPROVED' && leave.status !== 'APPROVED') {
      // Yıllık izinden düş (sadece yıllık izin ise)
      if (leave.type === 'Annual' || leave.type === 'Annual Leave') {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        await client.execute({
          sql: 'UPDATE personnel SET annual_leave_days = annual_leave_days - ? WHERE id = ? AND company_id = ?',
          args: [diffDays, leave.personnel_id, req.user.companyId]
        });
      }

      // PUANTAJA OTOMATİK İŞLE
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const ptStatus = (leave.type === 'Sickness') ? 'Sickness' : 
                       (leave.type === 'Unpaid' || leave.type === 'Unpaid Leave') ? 'Unpaid Leave' : 'Annual Leave';

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await client.execute({
          sql: `
            INSERT INTO pointage (personnel_id, date, status, overtime_hours, company_id)
            VALUES (?, ?, ?, 0, ?)
            ON CONFLICT(personnel_id, date) DO UPDATE SET status = excluded.status
          `,
          args: [leave.personnel_id, dateStr, ptStatus, req.user.companyId]
        });
      }
    }

    await client.execute({
      sql: 'UPDATE leaves SET status = ? WHERE id = ? AND company_id = ?',
      args: [status, id, req.user.companyId]
    });
    res.json({ success: true, message: 'Talep güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// --- REQUESTS (Expenses/Advances) ---
app.get('/api/admin/requests', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT r.*, p.first_name, p.last_name 
        FROM requests r 
        JOIN personnel p ON r.personnel_id = p.id
        WHERE r.company_id = ?
        ORDER BY r.created_at DESC
      `,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/personnel/requests', authMiddleware, upload.single('receipt'), async (req, res) => {
  const { type, amount, date, description } = req.body;
  const receipt_path = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const rsP = await client.execute({
      sql: 'SELECT id FROM personnel WHERE user_id = ? AND company_id = ?',
      args: [req.user.id, req.user.companyId]
    });
    const p = rsP.rows[0];
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    
    await client.execute({
      sql: 'INSERT INTO requests (personnel_id, type, amount, date, description, receipt_path, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [p.id, n(type), n(amount), n(date), n(description), n(receipt_path), req.user.companyId]
    });
    res.json({ success: true, message: 'Masraf talebi iletildi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/admin/requests/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE requests SET status = ? WHERE id = ? AND company_id = ?',
      args: [status, id, req.user.companyId]
    });
    res.json({ success: true, message: 'Talep güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// This route was a duplicate of 216, removed and kept only one with extended logic above.

// --- POINTAGE & REQUESTS (Simplified structure for index) ---
// Personnel Self Routes
app.get('/api/personnel/leaves', authMiddleware, async (req, res) => {
  try {
    const rsP = await client.execute({
      sql: 'SELECT id FROM personnel WHERE user_id = ? AND company_id = ?',
      args: [req.user.id, req.user.companyId]
    });
    const p = rsP.rows[0];
    if (!p) return res.json({ success: true, data: [] });
    const rs = await client.execute({
      sql: 'SELECT * FROM leaves WHERE personnel_id = ? AND company_id = ? ORDER BY created_at DESC',
      args: [p.id, req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/personnel/requests', authMiddleware, async (req, res) => {
  try {
    const rsP = await client.execute({
      sql: 'SELECT id FROM personnel WHERE user_id = ? AND company_id = ?',
      args: [req.user.id, req.user.companyId]
    });
    const p = rsP.rows[0];
    if (!p) return res.json({ success: true, data: [] });
    const rs = await client.execute({
      sql: 'SELECT * FROM requests WHERE personnel_id = ? AND company_id = ? ORDER BY created_at DESC',
      args: [p.id, req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/personnel/pointage', authMiddleware, async (req, res) => {
  try {
    const rsP = await client.execute({
      sql: 'SELECT id FROM personnel WHERE user_id = ? AND company_id = ?',
      args: [req.user.id, req.user.companyId]
    });
    const p = rsP.rows[0];
    if (!p) return res.json({ success: true, data: [] });
    const rs = await client.execute({
      sql: 'SELECT * FROM pointage WHERE personnel_id = ? AND company_id = ?',
      args: [p.id, req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/pointage', authMiddleware, async (req, res) => {
  let { personnel_id, date, status, overtime_hours } = req.body;
  try {
    // Eğer personel kendisi giriyorsa, personnel_id'yi kendi id'si yap
    if (req.user.role === 'personnel') {
      const rsP = await client.execute({
        sql: 'SELECT id FROM personnel WHERE user_id = ? AND company_id = ?',
        args: [req.user.id, req.user.companyId]
      });
      personnel_id = rsP.rows[0].id;
    }

    // Kilit kontrolü (Personel ise)
    if (req.user.role === 'personnel') {
      const rsEx = await client.execute({
        sql: 'SELECT is_locked FROM pointage WHERE personnel_id = ? AND date = ? AND company_id = ?',
        args: [personnel_id, date, req.user.companyId]
      });
      const existing = rsEx.rows[0];
      if (existing && existing.is_locked) {
        return res.status(403).json({ success: false, message: 'Bu tarih kilitli olduğu için değişiklik yapılamaz.' });
      }
    }

    // Admin üzerinden geliyorsa kilitleme yetkisi verelim
    const isLocked = (req.user.role === 'admin' && req.body.is_locked) ? 1 : 0;
    
    await client.execute({
      sql: `
        INSERT INTO pointage (personnel_id, date, status, overtime_hours, is_locked, company_id)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(personnel_id, date) DO UPDATE SET
          status = excluded.status,
          overtime_hours = excluded.overtime_hours,
          is_locked = CASE WHEN ? = 'admin' THEN excluded.is_locked ELSE pointage.is_locked END
      `,
      args: [personnel_id, n(date), n(status), n(overtime_hours) || 0, isLocked, req.user.companyId, req.user.role]
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/admin/pointage/bulk-lock', authMiddleware, adminMiddleware, async (req, res) => {
  const { personnel_id, year, month, lock_status } = req.body;
  if (!personnel_id || !year || !month) return res.status(400).json({ success: false, message: 'Eksik parametre (personnel_id, year veya month).' });
  
  try {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-31`;
    
    const result = await client.execute({
      sql: `
        UPDATE pointage 
        SET is_locked = ? 
        WHERE personnel_id = ? AND date BETWEEN ? AND ? AND company_id = ?
      `,
      args: [lock_status ? 1 : 0, personnel_id, startDate, endDate, req.user.companyId]
    });
    
    res.json({ success: true, message: `Puantaj kayıtları ${lock_status ? 'kilitlendi' : 'kilidi açıldı'}. (${result.rowsAffected} gün güncellendi)` });
  } catch (error) { 
    console.error('BULK LOCK ERROR:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + error.message }); 
  }
});

app.post('/api/admin/pointage/bulk-lock-all', authMiddleware, adminMiddleware, async (req, res) => {
  const { year, month, lock_status } = req.body;
  if (!year || !month) return res.status(400).json({ success: false, message: 'Eksik parametre (year veya month).' });
  
  try {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-31`;
    
    const result = await client.execute({
      sql: `
        UPDATE pointage 
        SET is_locked = ? 
        WHERE date BETWEEN ? AND ? AND company_id = ?
      `,
      args: [lock_status ? 1 : 0, startDate, endDate, req.user.companyId]
    });
    
    res.json({ success: true, message: `Tüm personellerin puantaj kayıtları ${lock_status ? 'kilitlendi' : 'kilidi açıldı'}. (${result.rowsAffected} gün güncellendi)` });
  } catch (error) { 
    console.error('BULK LOCK ALL ERROR:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + error.message }); 
  }
});

app.get('/api/announcements', authMiddleware, async (req, res) => {
  const rs = await client.execute({
    sql: 'SELECT * FROM announcements WHERE company_id = ? ORDER BY created_at DESC LIMIT 10',
    args: [req.user.companyId]
  });
  res.json({ success: true, data: rs.rows });
});

app.get('/api/admin/pointage', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT po.*, p.first_name, p.last_name 
        FROM pointage po
        JOIN personnel p ON po.personnel_id = p.id
        WHERE po.company_id = ?
        ORDER BY po.date DESC
      `,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/admin/pointage/template', authMiddleware, adminMiddleware, async (req, res) => {
  const rs = await client.execute({
    sql: 'SELECT id, first_name, last_name FROM personnel WHERE status = "Active" AND company_id = ?',
    args: [req.user.companyId]
  });
  const data = rs.rows.map(p => ({
    'ID': p.id,
    'İsim': p.first_name + ' ' + p.last_name,
    'Tarih': new Date().toISOString().split('T')[0],
    'Durum': 'Work',
    'Fazla Mesai': 0
  }));
  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Puantaj");
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=puantaj_sablon.xlsx');
  res.send(buf);
});

app.post('/api/admin/pointage/bulk-upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Excel dosyası gereklidir.' });
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    let count = 0;
    for (const row of data) {
      const pid = row.ID || row.id || row.Id;
      const date = row.Tarih || row.date || row.Date;
      const status = row.Durum || row.status || row.Status;
      const ot = row['Fazla Mesai'] || row.overtime || 0;
      
      if (pid && date && status) {
        await client.execute({
          sql: `
            INSERT INTO pointage (personnel_id, date, status, overtime_hours, company_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(personnel_id, date) DO UPDATE SET
              status = excluded.status,
              overtime_hours = excluded.overtime_hours
          `,
          args: [pid, date, status, ot, req.user.companyId]
        });
        count++;
      }
    }
    
    res.json({ success: true, message: `${count} puantaj kaydı işlendi.` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Removed duplicate requests route that used old 'db' syntax

// ============================================================
// --- YARDIMCI METOD ---
// JSON.stringify undefined değerleri yoksaydığı için, req.body'den gelen undefined'ları null'a çevirir
// SQLite TypeError fırlatmasını (Bind parameter is undefined) engeller.
const n = (val) => {
  if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) return null;
  return val;
};

// ============================================================
// --- CARİLER ---
// ============================================================
app.get('/api/cariler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cariler WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ 
      id: r.id, 
      tip: r.tip, 
      unvan: r.unvan, 
      vknTckn: r.vkn_tckn, 
      vergiDairesi: r.vergi_dairesi, 
      adres: r.adres, 
      telefon: r.telefon, 
      eposta: r.eposta, 
      muhasebeKodu: r.muhasebe_kodu,
      olusturmaTarihi: r.olusturma_tarihi 
    }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/cariler', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO cariler (id,tip,unvan,vkn_tckn,vergi_dairesi,adres,telefon,eposta,muhasebe_kodu,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id), n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), n(f.muhasebeKodu), n(f.olusturmaTarihi), req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/cariler/bulk-import', authMiddleware, async (req, res) => {
  const { cariler } = req.body;
  if (!cariler || !Array.isArray(cariler)) {
    return res.status(400).json({ success: false, message: 'Geçersiz veri formatı' });
  }

  try {
    let successCount = 0;
    for (const cari of cariler) {
      if (!cari.unvan) continue;
      
      const id = 'c' + Date.now() + Math.random().toString(36).substr(2, 5);
      const tip = cari.tip || 'musteri';
      
      // VKN veya muhasebe kodu ile eşleşen var mı kontrol et
      let targetId = null;
      if (cari.muhasebeKodu) {
        const rs = await client.execute({ sql: 'SELECT id FROM cariler WHERE muhasebe_kodu = ? AND company_id = ?', args: [cari.muhasebeKodu, req.user.companyId] });
        if (rs.rows.length > 0) targetId = rs.rows[0].id;
      }
      
      if (!targetId && cari.vknTckn) {
        const rs = await client.execute({ sql: 'SELECT id FROM cariler WHERE vkn_tckn = ? AND company_id = ?', args: [cari.vknTckn, req.user.companyId] });
        if (rs.rows.length > 0) targetId = rs.rows[0].id;
      }

      if (targetId) {
        // Mevcut cariyi güncelle (adres, eposta ve muhasebe kodu boş değilse üzerine yaz)
        await client.execute({
          sql: 'UPDATE cariler SET unvan = COALESCE(?, unvan), vkn_tckn = COALESCE(nullif(?, \'\'), vkn_tckn), adres = COALESCE(nullif(?, \'\'), adres), eposta = COALESCE(nullif(?, \'\'), eposta), muhasebe_kodu = COALESCE(nullif(?, \'\'), muhasebe_kodu) WHERE id = ? AND company_id = ?',
          args: [n(cari.unvan), n(cari.vknTckn), n(cari.adres), n(cari.eposta), n(cari.muhasebeKodu), targetId, req.user.companyId]
        });
      } else {
        // Yeni ekle
        await client.execute({
          sql: 'INSERT INTO cariler (id,tip,unvan,vkn_tckn,vergi_dairesi,adres,telefon,eposta,muhasebe_kodu,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          args: [id, tip, n(cari.unvan), n(cari.vknTckn), null, n(cari.adres), null, n(cari.eposta), n(cari.muhasebeKodu), new Date().toISOString().split('T')[0], req.user.companyId]
        });
      }
      successCount++;
    }
    res.json({ success: true, count: successCount });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put('/api/cariler/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE cariler SET tip=?,unvan=?,vkn_tckn=?,vergi_dairesi=?,adres=?,telefon=?,eposta=?,muhasebe_kodu=? WHERE id=? AND company_id = ?',
      args: [n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), n(f.muhasebeKodu), req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/cariler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM cariler WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.get('/api/cari-hareketler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cari_hareketler WHERE company_id = ? ORDER BY tarih DESC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ 
      id: r.id, 
      cariId: r.cari_id, 
      tarih: r.tarih, 
      islemTuru: r.islem_turu, 
      tutar: r.tutar, 
      aciklama: r.aciklama, 
      bagliFaturaId: r.bagli_fatura_id, 
      bankaId: r.banka_id, 
      dekontDosya: r.dekont_dosya, 
      olusturmaTarihi: r.olusturma_tarihi,
      kategoriId: r.kategori_id
    }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/cari-hareketler', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO cari_hareketler (id,cari_id,tarih,islem_turu,tutar,aciklama,bagli_fatura_id,banka_id,dekont_dosya,olusturma_tarihi,kategori_id,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id), n(f.cariId), n(f.tarih), n(f.islemTuru), n(f.tutar), n(f.aciklama), n(f.bagliFaturaId), n(f.bankaId), n(f.dekontDosya), n(f.olusturmaTarihi), n(f.kategoriId), req.user.companyId]
    });
    
    // BANKA BAKİYESİ GÜNCELLE
    if (f.bankaId && f.tutar) {
        const ArtisTurleri = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan'];
        const AzalisTurleri = ['odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi','cek_senet_verilen'];
        let degisim = 0;
        if (ArtisTurleri.includes(f.islemTuru)) degisim = f.tutar;
        else if (AzalisTurleri.includes(f.islemTuru)) degisim = -f.tutar;
        else if (f.islemTuru === 'transfer') {
          if ((f.aciklama||'').toUpperCase().includes('GELEN')) degisim = f.tutar;
          else degisim = -f.tutar;
        }
        if (degisim !== 0) {
          await client.execute({
            sql: 'UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ? AND company_id = ?',
            args: [degisim, f.bankaId, req.user.companyId]
          });
        }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/cari-hareketler/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE cari_hareketler SET cari_id=?,tarih=?,islem_turu=?,tutar=?,aciklama=?,bagli_fatura_id=?,banka_id=?,dekont_dosya=?,kategori_id=? WHERE id=? AND company_id = ?',
      args: [n(f.cariId), n(f.tarih), n(f.islemTuru), n(f.tutar), n(f.aciklama), n(f.bagliFaturaId), n(f.bankaId), n(f.dekontDosya), n(f.kategoriId), req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/cari-hareketler/:id', authMiddleware, async (req, res) => {
  try { 
    const rs = await client.execute({
      sql: 'SELECT * FROM cari_hareketler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    const h = rs.rows[0];
    if (h && h.banka_id && h.tutar) {
        const ArtisTurleri = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan'];
        const AzalisTurleri = ['odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi', 'cek_senet_verilen'];
        let degisim = 0;
        if (ArtisTurleri.includes(h.islem_turu)) degisim = -h.tutar; // Gelir siliniyorsa bakiye azalır
        else if (AzalisTurleri.includes(h.islem_turu)) degisim = h.tutar; // Gider siliniyorsa bakiye artar
        else if (h.islem_turu === 'transfer') {
          if ((h.aciklama||'').toUpperCase().includes('GELEN')) degisim = -h.tutar;
          else degisim = h.tutar;
        }
        if (degisim !== 0) {
          await client.execute({
            sql: 'UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ? AND company_id = ?',
            args: [degisim, h.banka_id, req.user.companyId]
          });
        }
    }
    await client.execute({
      sql: 'DELETE FROM cari_hareketler WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true }); 
  }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- SATIŞ FATURALARI ---
// ============================================================
app.get('/api/satis-faturalari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM satis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    
    // Stok hareketlerini de çek
    const stokRs = await client.execute({
      sql: 'SELECT * FROM stok_hareketler WHERE company_id = ? AND tip = ?',
      args: [req.user.companyId, 'CIKIS']
    });
    
    const stokHareketler = stokRs.rows;
    
    const mapped = rs.rows.map(r => {
      // Bu faturaya bağlı stok kalemlerini bul
      const bagliStoklar = stokHareketler.filter(sh => sh.bagli_fatura_id === r.id).map(sh => ({
        id: sh.id,
        urunId: sh.urun_id,
        miktar: sh.miktar,
        birimFiyat: sh.birim_fiyat
      }));
      
      return { 
        id: r.id, faturaNo: r.fatura_no, tcVkn: r.tc_vkn, ad: r.ad, soyad: r.soyad, adres: r.adres, 
        kdvOrani: r.kdv_orani, alinanUcret: r.alinan_ucret, matrah: r.matrah, kdvTutari: r.kdv_tutari, 
        tevkifatOrani: r.tevkifat_orani, tevkifatTutari: r.tevkifat_tutari, tevkifatKodu: r.tevkifat_kodu, 
        stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, stopajKodu: r.stopaj_kodu, 
        muhasebeKodu: r.muhasebe_kodu, pdfDosya: r.pdf_dosya, pdfDosyaAdi: r.pdf_dosya_adi, 
        faturaTarihi: r.fatura_tarihi, odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, 
        odemeDekontu: r.odeme_dekontu, odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, 
        vadeTarihi: r.vade_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi, 
        urunId: r.urun_id, depoId: r.depo_id,
        stokKalemleri: bagliStoklar.length > 0 ? bagliStoklar : undefined
      };
    });
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/satis-faturalari', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO satis_faturalari (id,fatura_no,tc_vkn,ad,soyad,adres,kdv_orani,alinan_ucret,matrah,kdv_tutari,tevkifat_orani,tevkifat_tutari,tevkifat_kodu,stopaj_orani,stopaj_tutari,stopaj_kodu,muhasebe_kodu,pdf_dosya,pdf_dosya_adi,fatura_tarihi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi,company_id,urun_id,depo_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.faturaNo),n(f.tcVkn),n(f.ad),n(f.soyad),n(f.adres),n(f.kdvOrani),n(f.alinanUcret),n(f.matrah),n(f.kdvTutari),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.tevkifatKodu),n(f.stopajOrani),n(f.stopajTutari),n(f.stopajKodu),n(f.muhasebeKodu),n(f.pdfDosya),n(f.pdfDosyaAdi),n(f.faturaTarihi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi),req.user.companyId,n(f.urunId),n(f.depoId)]
    });
    
    // Çoklu stok hareketleri oluştur
    const stokKalemleri = f.stokKalemleri || [];
    // Geriye uyumluluk: tek urunId varsa ve stokKalemleri boşsa, onu kullan
    if (stokKalemleri.length === 0 && f.urunId && f.urunId !== 'yok' && f.urunId !== '') {
      stokKalemleri.push({ urunId: f.urunId, miktar: 1, birimFiyat: parseFloat(f.matrah) || parseFloat(f.alinanUcret) || 0 });
    }
    
    if (stokKalemleri.length > 0) {
      // Varsayılan depoyu bul
      let targetDepoId = f.depoId || null;
      if (!targetDepoId) {
        const depRs = await client.execute({ sql: 'SELECT id FROM stok_depolar WHERE company_id = ? AND varsayilan = 1 LIMIT 1', args: [req.user.companyId] });
        if (depRs.rows.length > 0) targetDepoId = depRs.rows[0].id;
        else {
          const depRs2 = await client.execute({ sql: 'SELECT id FROM stok_depolar WHERE company_id = ? LIMIT 1', args: [req.user.companyId] });
          if (depRs2.rows.length > 0) targetDepoId = depRs2.rows[0].id;
        }
      }
      if (targetDepoId) {
        for (const sk of stokKalemleri) {
          if (!sk.urunId || sk.urunId === 'yok') continue;
          const miktar = parseFloat(sk.miktar) || 1;
          const birimFiyat = parseFloat(sk.birimFiyat) || 0;
          await client.execute({
            sql: 'INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, bagli_fatura_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [uuidv4(), sk.urunId, targetDepoId, 'CIKIS', miktar, birimFiyat, birimFiyat * miktar, f.faturaTarihi || new Date().toISOString(), 'Satış Faturası - Otomatik Stok Çıkışı', n(f.faturaNo), n(f.id), req.user.companyId]
          });
        }
      }
    }
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/satis-faturalari/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE satis_faturalari SET fatura_no=?,odeme_tarihi=?,odeme_durumu=?,odeme_dekontu=?,odeme_dekontu_adi=?,pdf_dosya=?,pdf_dosya_adi=?,muhasebe_kodu=?,tc_vkn=?,ad=?,soyad=?,adres=?,aciklama=?,urun_id=?,depo_id=? WHERE id=? AND company_id = ?',
      args: [n(f.faturaNo),n(f.odemeTarihi),n(f.odemeDurumu),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.pdfDosya),n(f.pdfDosyaAdi),n(f.muhasebeKodu),n(f.tcVkn),n(f.ad),n(f.soyad),n(f.adres),n(f.aciklama),n(f.urunId),n(f.depoId),req.params.id, req.user.companyId]
    });

    // Stok hareketlerini güncelle (Önce eskileri sil, sonra yenileri ekle)
    await client.execute({
      sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ? AND tip = ?',
      args: [req.params.id, req.user.companyId, 'CIKIS']
    });

    const stokKalemleri = f.stokKalemleri || [];
    if (stokKalemleri.length === 0 && f.urunId && f.urunId !== 'yok' && f.urunId !== '') {
      stokKalemleri.push({ urunId: f.urunId, miktar: 1, birimFiyat: parseFloat(f.matrah) || parseFloat(f.alinanUcret) || 0 });
    }

    if (stokKalemleri.length > 0) {
      let targetDepoId = f.depoId || null;
      if (!targetDepoId) {
        const depRs = await client.execute({ sql: 'SELECT id FROM stok_depolar WHERE company_id = ? AND varsayilan = 1 LIMIT 1', args: [req.user.companyId] });
        if (depRs.rows.length > 0) targetDepoId = depRs.rows[0].id;
        else {
          const depRs2 = await client.execute({ sql: 'SELECT id FROM stok_depolar WHERE company_id = ? LIMIT 1', args: [req.user.companyId] });
          if (depRs2.rows.length > 0) targetDepoId = depRs2.rows[0].id;
        }
      }
      if (targetDepoId) {
        for (const sk of stokKalemleri) {
          if (!sk.urunId || sk.urunId === 'yok') continue;
          const miktar = parseFloat(sk.miktar) || 1;
          const birimFiyat = parseFloat(sk.birimFiyat) || 0;
          await client.execute({
            sql: 'INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, bagli_fatura_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [uuidv4(), sk.urunId, targetDepoId, 'CIKIS', miktar, birimFiyat, birimFiyat * miktar, f.faturaTarihi || new Date().toISOString(), 'Satış Faturası - Stok Çıkışı (Güncellendi)', n(f.faturaNo), req.params.id, req.user.companyId]
          });
        }
      }
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/satis-faturalari/:id', authMiddleware, async (req, res) => {
  try {
    await client.batch([
      {
        sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      },
      {
        sql: 'DELETE FROM satis_faturalari WHERE id=? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      }
    ], "write");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- ALIŞ FATURALARI ---
// ============================================================
app.get('/api/alis-faturalari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM alis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    
    // Stok hareketlerini de çek
    const stokRs = await client.execute({
      sql: 'SELECT * FROM stok_hareketler WHERE company_id = ? AND tip = ?',
      args: [req.user.companyId, 'GIRIS']
    });
    
    const stokHareketler = stokRs.rows;
    
    const mapped = rs.rows.map(r => {
      // Bu faturaya bağlı stok kalemlerini bul
      const bagliStoklar = stokHareketler.filter(sh => sh.bagli_fatura_id === r.id).map(sh => ({
        id: sh.id,
        urunId: sh.urun_id,
        miktar: sh.miktar,
        birimFiyat: sh.birim_fiyat
      }));
      
      return { 
        id: r.id, faturaNo: r.fatura_no, faturaTarihi: r.fatura_tarihi, tedarikciAdi: r.tedarikci_adi, 
        tedarikciVkn: r.tedarikci_vkn, malHizmetAdi: r.mal_hizmet_adi, toplamTutar: r.toplam_tutar, 
        kdvOrani: r.kdv_orani, kdvTutari: r.kdv_tutari, matrah: r.matrah, tevkifatOrani: r.tevkifat_orani, 
        tevkifatTutari: r.tevkifat_tutari, stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, 
        muhasebeKodu: r.muhasebe_kodu, pdfDosya: r.pdf_dosya, pdfDosyaAdi: r.pdf_dosya_adi, 
        odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, odemeDekontu: r.odeme_dekontu, 
        odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, vadeTarihi: r.vade_tarihi, 
        aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi, urunId: r.urun_id, depoId: r.depo_id,
        stokKalemleri: bagliStoklar.length > 0 ? bagliStoklar : undefined
      };
    });
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/alis-faturalari', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO alis_faturalari (id,fatura_no,fatura_tarihi,tedarikci_adi,tedarikci_vkn,mal_hizmet_adi,toplam_tutar,kdv_orani,kdv_tutari,matrah,tevkifat_orani,tevkifat_tutari,stopaj_orani,stopaj_tutari,muhasebe_kodu,pdf_dosya,pdf_dosya_adi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi,company_id,urun_id,depo_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.faturaNo),n(f.faturaTarihi),n(f.tedarikciAdi),n(f.tedarikciVkn),n(f.malHizmetAdi),n(f.toplamTutar),n(f.kdvOrani),n(f.kdvTutari),n(f.matrah),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.stopajOrani),n(f.stopajTutari),n(f.muhasebeKodu),n(f.pdfDosya),n(f.pdfDosyaAdi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi),req.user.companyId,n(f.urunId),n(f.depoId)]
    });
    
    // Çoklu stok hareketleri oluştur (GIRIS - alış = stoğa giriş)
    const stokKalemleriAlis = f.stokKalemleri || [];
    if (stokKalemleriAlis.length === 0 && f.urunId && f.urunId !== 'yok' && f.urunId !== '') {
      stokKalemleriAlis.push({ urunId: f.urunId, miktar: 1, birimFiyat: parseFloat(f.matrah) || parseFloat(f.toplamTutar) || 0 });
    }
    
    if (stokKalemleriAlis.length > 0) {
      let targetDepoId = f.depoId || null;
      if (!targetDepoId) {
        const depRs = await client.execute({ sql: 'SELECT id FROM stok_depolar WHERE company_id = ? AND varsayilan = 1 LIMIT 1', args: [req.user.companyId] });
        if (depRs.rows.length > 0) targetDepoId = depRs.rows[0].id;
        else {
          const depRs2 = await client.execute({ sql: 'SELECT id FROM stok_depolar WHERE company_id = ? LIMIT 1', args: [req.user.companyId] });
          if (depRs2.rows.length > 0) targetDepoId = depRs2.rows[0].id;
        }
      }
      if (targetDepoId) {
        for (const sk of stokKalemleriAlis) {
          if (!sk.urunId || sk.urunId === 'yok') continue;
          const miktar = parseFloat(sk.miktar) || 1;
          const birimFiyat = parseFloat(sk.birimFiyat) || 0;
          await client.execute({
            sql: 'INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, bagli_fatura_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [uuidv4(), sk.urunId, targetDepoId, 'GIRIS', miktar, birimFiyat, birimFiyat * miktar, f.faturaTarihi || new Date().toISOString(), 'Alış Faturası - Otomatik Stok Girişi', n(f.faturaNo), n(f.id), req.user.companyId]
          });
        }
      }
    }
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/alis-faturalari/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE alis_faturalari SET odeme_tarihi=?,odeme_durumu=?,odeme_dekontu=?,odeme_dekontu_adi=?,pdf_dosya=?,pdf_dosya_adi=? WHERE id=? AND company_id = ?',
      args: [n(f.odemeTarihi),n(f.odemeDurumu),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.pdfDosya),n(f.pdfDosyaAdi),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/alis-faturalari/:id', authMiddleware, async (req, res) => {
  try {
    await client.batch([
      {
        sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      },
      {
        sql: 'DELETE FROM alis_faturalari WHERE id=? AND company_id = ?',
        args: [req.params.id, req.user.companyId]
      }
    ], "write");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- CEK SENET, BANKA, KESILECEK ---
// ============================================================
app.get('/api/cek-senetler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cek_senetler WHERE company_id = ? ORDER BY vade_tarihi ASC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, tip: r.tip, islemTipi: r.islem_tipi, cariId: r.cari_id, belgeNo: r.belge_no, tutar: r.tutar, vadeTarihi: r.vade_tarihi, verilisTarihi: r.verilis_tarihi, durum: r.durum, aciklama: r.aciklama }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/cek-senetler', authMiddleware, async (req, res) => {
  const c = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO cek_senetler (id,tip,islem_tipi,cari_id,belge_no,tutar,vade_tarihi,verilis_tarihi,durum,aciklama,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(c.id),n(c.tip),n(c.islemTipi),n(c.cariId),n(c.belgeNo),n(c.tutar),n(c.vadeTarihi),n(c.verilisTarihi),c.durum||'bekliyor',n(c.aciklama),req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/cek-senetler/:id', authMiddleware, async (req, res) => {
  const c = req.body;
  try {
    await client.execute({
      sql: 'UPDATE cek_senetler SET tip=?,islem_tipi=?,cari_id=?,belge_no=?,tutar=?,vade_tarihi=?,verilis_tarihi=?,durum=?,aciklama=? WHERE id=? AND company_id = ?',
      args: [n(c.tip),n(c.islemTipi),n(c.cariId),n(c.belgeNo),n(c.tutar),n(c.vadeTarihi),n(c.verilisTarihi),n(c.durum),n(c.aciklama),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/cek-senetler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM cek_senetler WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.get('/api/banka-hesaplari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM banka_hesaplari WHERE company_id = ?',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, hesapAdi: r.hesap_adi, bankaAdi: r.banka_adi, iban: r.iban, hesapNo: r.hesap_no, kartNo: r.kart_no, dovizTuru: r.doviz_turu, guncelBakiye: r.guncel_bakiye }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/banka-hesaplari', authMiddleware, async (req, res) => {
  const b = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO banka_hesaplari (id,hesap_adi,banka_adi,iban,hesap_no,kart_no,doviz_turu,guncel_bakiye,company_id) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [n(b.id),n(b.hesapAdi),n(b.bankaAdi),n(b.iban),n(b.hesapNo),n(b.kartNo),n(b.dovizTuru)||'TRY',n(b.guncelBakiye)||0,req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/banka-hesaplari/:id', authMiddleware, async (req, res) => {
  const b = req.body;
  try {
    await client.execute({
      sql: 'UPDATE banka_hesaplari SET hesap_adi=?,banka_adi=?,iban=?,hesap_no=?,kart_no=?,doviz_turu=?,guncel_bakiye=? WHERE id=? AND company_id = ?',
      args: [n(b.hesapAdi),n(b.bankaAdi),n(b.iban),n(b.hesapNo),n(b.kartNo),n(b.dovizTuru),n(b.guncelBakiye),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/banka-hesaplari/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM banka_hesaplari WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- MASRAF KURALLARI ---
// ============================================================
app.get('/api/masraf-kurallari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM masraf_kurallari WHERE company_id = ?',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, anahtarKelime: r.anahtar_kelime, islemTuru: r.islem_turu, aciklama: r.aciklama }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/masraf-kurallari', authMiddleware, async (req, res) => {
  const m = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO masraf_kurallari (id,anahtar_kelime,islem_turu,aciklama,company_id) VALUES (?,?,?,?,?)',
      args: [n(m.id),n(m.anahtarKelime),n(m.islemTuru),n(m.aciklama),req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/masraf-kurallari/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM masraf_kurallari WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/kesilecek-faturalar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM kesilecek_faturalar WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, ad: r.ad, soyad: r.soyad, vknTckn: r.vkn_tckn, vergiDairesi: r.vergi_dairesi, adres: r.adres, il: r.il, ilce: r.ilce, tutar: r.tutar, kdvDahil: !!r.kdv_dahil, kdvOrani: r.kdv_orani, faturaTarihi: r.fatura_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi, durum: r.durum, cariId: r.cari_id }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/kesilecek-faturalar', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO kesilecek_faturalar (id,ad,soyad,vkn_tckn,vergi_dairesi,adres,il,ilce,tutar,kdv_dahil,kdv_orani,fatura_tarihi,aciklama,olusturma_tarihi,durum,cari_id,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.ad),n(f.soyad),n(f.vknTckn),n(f.vergiDairesi),n(f.adres),n(f.il),n(f.ilce),n(f.tutar),f.kdvDahil?1:0,n(f.kdvOrani),n(f.faturaTarihi),n(f.aciklama),n(f.olusturmaTarihi),n(f.durum)||'bekliyor',n(f.cariId),req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/kesilecek-faturalar/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE kesilecek_faturalar SET ad=?,soyad=?,vkn_tckn=?,vergi_dairesi=?,adres=?,il=?,ilce=?,tutar=?,kdv_dahil=?,kdv_orani=?,fatura_tarihi=?,aciklama=?,durum=?,cari_id=? WHERE id=? AND company_id = ?',
      args: [n(f.ad),n(f.soyad),n(f.vknTckn),n(f.vergiDairesi),n(f.adres),n(f.il),n(f.ilce),n(f.tutar),f.kdvDahil?1:0,n(f.kdvOrani),n(f.faturaTarihi),n(f.aciklama),n(f.durum),n(f.cariId),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/kesilecek-faturalar/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM kesilecek_faturalar WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- SUPER ADMIN COMPANY MANAGEMENT ---
app.get('/api/super/companies', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute('SELECT * FROM companies ORDER BY name ASC');
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/super/companies', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { name, tax_no, address, email, admin_tc, admin_password, company_type } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Şirket adı zorunludur.' });

  try {
    // 1. Create Company
    const compResult = await client.execute({
      sql: 'INSERT INTO companies (name, tax_no, address, email, status, company_type) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      args: [n(name), n(tax_no), n(address), n(email), 'active', company_type || 'BİLANÇO']
    });
    
    const newCompanyId = compResult.rows[0].id;

    // 2. Create Admin User if provided
    if (admin_tc && admin_password) {
      const hashedPassword = bcrypt.hashSync(admin_password, 10);
      await client.execute({
        sql: 'INSERT INTO users (tc, password, role, must_change_password, company_id) VALUES (?, ?, ?, ?, ?)',
        args: [admin_tc, hashedPassword, 'admin', 0, newCompanyId]
      });
    }

    res.json({ success: true, message: 'Şirket ve yönetici hesabı başarıyla oluşturuldu.', companyId: newCompanyId });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});

app.put('/api/super/companies/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, tax_no, address, email, status, company_type } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE companies SET name = ?, tax_no = ?, address = ?, email = ?, status = ?, company_type = ? WHERE id = ?',
      args: [n(name), n(tax_no), n(address), n(email), n(status), company_type || 'BİLANÇO', id]
    });
    res.json({ success: true, message: 'Şirket güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.delete('/api/super/companies/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { id } = req.params;
  if (id === '1') return res.status(400).json({ success: false, message: 'Varsayılan şirket silinemez.' });
  
  try {
    // 1. Manually delete all associated data (Cascade)
    const tables = [
      'users', 'personnel', 'pointage', 'leaves', 'documents', 
      'assets', 'trainings', 'payroll', 'requests', 'announcements', 
      'cariler', 'cari_hareketler', 'satis_faturalari', 'alis_faturalari', 
      'cek_senetler', 'banka_hesaplari', 'masraf_kurallari', 
      'kesilecek_faturalar', 'gider_kategorileri'
    ];

    const deleteStatements = tables.map(t => ({
      sql: `DELETE FROM ${t} WHERE company_id = ?`,
      args: [id]
    }));

    // Add company deletion itself
    deleteStatements.push({
      sql: 'DELETE FROM companies WHERE id = ?',
      args: [id]
    });

    await client.batch(deleteStatements);
    res.json({ success: true, message: 'Şirket ve tüm bağlı veriler başarıyla silindi.' });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});

// --- GİDER KATEGORİLERİ ---
app.get('/api/gider-kategorileri', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM gider_kategorileri WHERE company_id = ? ORDER BY ad ASC',
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/gider-kategorileri', authMiddleware, async (req, res) => {
  const k = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO gider_kategorileri (id, ad, company_id) VALUES (?, ?, ?)',
      args: [n(k.id), n(k.ad), req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/gider-kategorileri/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM gider_kategorileri WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- GİB API ROUTES (e-fatura npm paketi ile) ---
import {
  default as EInvoice,
  InvoiceType,
  EInvoiceCountry,
  EInvoiceUnitType,
  EInvoiceCurrencyType,
  EInvoiceApiError,
  EInvoiceTypeError
} from 'e-fatura';

const UNIT_TYPE_MAP_GIB = {
  ADET: EInvoiceUnitType?.ADET,
  PAKET: EInvoiceUnitType?.PAKET,
  KG: EInvoiceUnitType?.KG,
  LT: EInvoiceUnitType?.LT,
  TON: EInvoiceUnitType?.TON,
  M2: EInvoiceUnitType?.M2,
  M3: EInvoiceUnitType?.M3,
  SAAT: EInvoiceUnitType?.SAAT,
  GUN: EInvoiceUnitType?.GUN,
};

function convertToGIBDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatGIBTime(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

app.post('/api/gib/create-draft', authMiddleware, async (req, res) => {
  const { credentials, invoice, autoSign } = req.body;
  if (!credentials?.username || !credentials?.password)
    return res.status(400).json({ success: false, message: 'GİB kullanıcı adı ve şifre gereklidir.' });
  if (!invoice)
    return res.status(400).json({ success: false, message: 'Fatura verisi eksik.' });

  // === DEBUG: Gelen verinin tam logu ===
  console.log('[GIB] Gelen invoice verisi:', JSON.stringify({
    vknTckn: invoice.vknTckn,
    ad: invoice.ad,
    adres: invoice.adres,
    il: invoice.il,
    faturaTipi: invoice.faturaTipi,
    stopajTipi: invoice.stopajTipi,
    stopajOrani: invoice.stopajOrani,
    kalemSayisi: invoice.kalemler?.length || 0,
    kalemler: invoice.kalemler?.map(k => ({
      ad: k.ad, birimFiyat: k.birimFiyat, miktar: k.miktar,
      kdvOrani: k.kdvOrani, tevkifatOrani: k.tevkifatOrani, tevkifatKodu: k.tevkifatKodu
    }))
  }, null, 2));

  // VKN/TCKN doğrulaması
  const vknStr = String(invoice.vknTckn || '').trim().replace(/\s/g, '');
  if (!vknStr || vknStr === '0' || vknStr === 'undefined') {
    return res.status(400).json({ success: false, message: 'VKN/TC Kimlik numarası zorunludur. Lütfen fatura planı formunda doldurun.' });
  }
  if (vknStr.length !== 10 && vknStr.length !== 11) {
    return res.status(400).json({ success: false, message: `VKN/TCKN 10 veya 11 haneli olmalıdır. Girilen: "${vknStr}" (${vknStr.length} hane)` });
  }
  if (/^1+$/.test(vknStr)) {
    return res.status(400).json({ success: false, message: 'Test VKN\'si (11111111111) kullanılamaz. Gerçek VKN/TCKN girin.' });
  }

  // Fatura tipi haritası (GIB portal değerleriyle birebir)
  const INVOICE_TYPE_MAP = {
    SATIS:            InvoiceType?.SATIS,
    IADE:             InvoiceType?.IADE,
    TEVKIFAT:         InvoiceType?.TEVKIFAT,
    TEVKIFATIADE:     InvoiceType?.TEVKIFAT,
    ISTISNA:          InvoiceType?.ISTISNA,
    OZELMATRAH:       InvoiceType?.OZEL_MATRAH,
    OZEL_MATRAH:      InvoiceType?.OZEL_MATRAH,
    IHRACKAYITLI:     InvoiceType?.IHRAC_KAYITLI,
    IHRAC_KAYITLI:    InvoiceType?.IHRAC_KAYITLI,
    KONAKLAMAVERGISI: InvoiceType?.SATIS,       // paket desteklemiyorsa SATIS
    YTBSATIS:         InvoiceType?.SATIS,
    YTBISTISNA:       InvoiceType?.ISTISNA,
    YTBIADE:          InvoiceType?.IADE,
    YTBTEVKIFAT:      InvoiceType?.TEVKIFAT,
    YTBTEVKIFATIADE:  InvoiceType?.TEVKIFAT,
  };
  const resolvedInvoiceType = INVOICE_TYPE_MAP[invoice.faturaTipi] || InvoiceType?.SATIS || 'SATIS';

  // Kalem listesini oluştur
  let products = [];
  if (invoice.kalemler && invoice.kalemler.length > 0) {
    products = invoice.kalemler.map(k => {
      const quantity  = parseFloat(k.miktar)    || 1;
      const unitPrice = parseFloat(k.birimFiyat) || 0;
      const vatRate   = parseFloat(k.kdvOrani)   || 0;

      const grossAmount   = Math.round(quantity * unitPrice * 100) / 100;    // Brüt
      const totalAmount   = grossAmount;                                       // İskonto yok = matrah
      const vatAmount     = Math.round(totalAmount * (vatRate / 100) * 100) / 100;

      // Tevkifat: tevkifatOrani artık sayısal % (örn: 30 = %30)
      const tevkifatOrani = parseFloat(k.tevkifatOrani) || 0;
      let vatWithholdingRate   = 0;
      let vatWithholdingAmount = 0;
      if (tevkifatOrani > 0) {
        vatWithholdingRate   = tevkifatOrani / 100;   // 0.30
        vatWithholdingAmount = Math.round(vatAmount * vatWithholdingRate * 100) / 100;
      }

      const unitType = UNIT_TYPE_MAP_GIB[k.birim] || EInvoiceUnitType?.ADET;

      const kalem = {
        name:        k.ad || 'Hizmet',
        quantity,
        unitType,
        unitPrice,
        price:       unitPrice,
        totalAmount,               // KDV hariç matrah
        grossAmount,               // Brüt (iskonto öncesi)
        vatRate,
        vatAmount,
        discountRate:   0,
        discountAmount: 0,
      };

      // Tevkifat varsa ekle (kalem seviyesinde)
      if (vatWithholdingRate > 0) {
        kalem.vatWithholdingRate   = vatWithholdingRate;
        kalem.vatWithholdingAmount = vatWithholdingAmount;
        if (k.tevkifatKodu) {
          kalem.withholdingCode    = String(k.tevkifatKodu);  // e-fatura paketi
          kalem.vatWithholdingCode = String(k.tevkifatKodu);  // alternatif alan adı
        }
      }

      return kalem;
    });
  } else {
    // Tek kalem (eski davranış - kalem girilmemişse)
    const matrah  = invoice.kdvDahil
      ? invoice.tutar / (1 + (invoice.kdvOrani || 20) / 100)
      : invoice.tutar;
    const vatAmount = Math.round(matrah * ((invoice.kdvOrani || 20) / 100) * 100) / 100;
    products = [{
      name:        invoice.aciklama || 'Hizmet / Mal Bedeli',
      quantity:    1,
      unitPrice:   Math.round(matrah * 100) / 100,
      price:       Math.round(matrah * 100) / 100,
      unitType:    EInvoiceUnitType?.ADET,
      totalAmount: Math.round(matrah * 100) / 100,
      grossAmount: Math.round(matrah * 100) / 100,
      vatRate:     invoice.kdvOrani || 20,
      vatAmount,
      discountRate:   0,
      discountAmount: 0,
    }];
  }

  const productsTotalPrice = Math.round(products.reduce((s, p) => s + p.totalAmount, 0) * 100) / 100;
  const totalVat           = Math.round(products.reduce((s, p) => s + (p.vatAmount || 0), 0) * 100) / 100;
  const totalWithholding   = Math.round(products.reduce((s, p) => s + (p.vatWithholdingAmount || 0), 0) * 100) / 100;

  // Tevkifata tabi matrah ve KDV
  const withholdingBase = Math.round(
    products.filter(p => p.vatWithholdingRate > 0).reduce((s, p) => s + p.totalAmount, 0) * 100
  ) / 100;

  // Stopaj (KV/GV) – taxes dizisi olarak işle
  let stopajAmount = 0;
  const taxTotals = {};
  const stopajTipi = invoice.stopajTipi || '';  // 'V0011' | 'V0003'
  if (stopajTipi && invoice.stopajOrani && parseFloat(invoice.stopajOrani) > 0) {
    const stopajRate = parseFloat(invoice.stopajOrani) / 100;
    stopajAmount = Math.round(productsTotalPrice * stopajRate * 100) / 100;
    taxTotals[stopajTipi] = { taxType: stopajTipi, rate: invoice.stopajOrani, amount: stopajAmount };
  }

  const paymentPrice = Math.round((productsTotalPrice + totalVat - totalWithholding - stopajAmount) * 100) / 100;

  const now = new Date();
  console.log('[GIB] Son payload ozet:', JSON.stringify({
    buyerTaxId:        vknStr,
    buyerAddress:      invoice.adres || '(bos)',
    invoiceType:       resolvedInvoiceType,
    base:              productsTotalPrice,
    totalVat,
    totalWithholding,
    withholdingBase,
    paymentPrice,
    stopajTipi,
    stopajAmount,
  }, null, 2));

  const invoicePayload = {
    date: invoice.faturaTarihi ? convertToGIBDate(invoice.faturaTarihi) : `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`,
    time: formatGIBTime(now),
    invoiceType: resolvedInvoiceType,
    currency: EInvoiceCurrencyType?.TURK_LIRASI,
    currencyRate: 1,
    country: EInvoiceCountry?.TURKIYE,

    // Alıcı
    buyerFirstName:  invoice.ad || '',
    buyerLastName:   invoice.soyad || '',
    buyerTitle:      invoice.ad || '',
    buyerTaxId:      vknStr,
    buyerTaxOffice:  invoice.vergiDairesi || '',
    buyerAddress:    invoice.adres        || '',
    buyerCity:       invoice.il           || '',
    buyerDistrict:   invoice.ilce         || '',

    // Ürünler
    products,

    // Toplamlar
    base:                    productsTotalPrice,
    productsTotalPrice,
    totalDiscount:           0,
    totalVat,
    includedTaxesTotalPrice: Math.round((productsTotalPrice + totalVat) * 100) / 100,
    paymentPrice,

    // KDV Tevkifatı toplamları (invoice seviyesi - GIB için zorunlu)
    ...(withholdingBase > 0 ? {
      withholdingBase,
      withholdingAmount: totalWithholding,
    } : {}),

    note: invoice.aciklama || '',
  };

  try {
    if (process.env.GIB_TEST_MODE === 'true') {
      EInvoice.setTestMode(true);
    }

    await EInvoice.connect({
      username: credentials.username,
      password: credentials.password,
    });

    const invoiceUUID = await EInvoice.createDraftInvoice(invoicePayload);

    let signResult = null;
    if (autoSign === true) {
      signResult = await EInvoice.signDraftInvoice({ uuid: invoiceUUID });
    }

    await EInvoice.logout();

    return res.json({
      success: true,
      message: autoSign ? 'Fatura başarıyla oluşturuldu ve imzalandı.' : 'Fatura taslak olarak GİB portalına gönderildi.',
      data: { invoiceUUID, signed: autoSign === true, signResult }
    });
  } catch (error) {
    try { await EInvoice.logout(); } catch (_) {}

    if (error instanceof EInvoiceApiError) {
      return res.status(400).json({
        success: false,
        error: 'GİB API Hatası',
        message: error.message,
        errorCode: error.errorCode,
      });
    }
    if (error instanceof EInvoiceTypeError) {
      return res.status(400).json({
        success: false,
        error: 'Doğrulama Hatası',
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'GİB fatura hatası: ' + error.message,
    });
  }
});

// --- STOK (INVENTORY) MODULE ROUTES ---

// Helper for UUID generation if ID is missing
const ensureId = (id) => id || uuidv4();

// Categories
app.get('/api/stok/kategoriler', authMiddleware, async (req, res) => {
  try {
    const companyId = n(req.user?.companyId);
    const rs = await client.execute({
      sql: `SELECT * FROM stok_kategoriler 
            WHERE company_id = ? OR (? IS NULL AND company_id IS NULL)
            ORDER BY ad ASC`,
      args: [companyId, companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/stok/kategoriler', authMiddleware, async (req, res) => {
  const { id, ad } = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO stok_kategoriler (id, ad, company_id) VALUES (?, ?, ?)',
      args: [ensureId(id), ad, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/stok/kategoriler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM stok_kategoriler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Products
app.get('/api/stok/urunler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `SELECT id, stok_kodu as stokKodu, barkod, urun_adi as urunAdi, 
            kategori_id as kategoriId, ana_birim as anaBirim, minimum_stok as minimumStok, 
            maksimum_stok as maksimumStok, lot_takibi as lotTakibi, 
            son_kullanma_tarihli as sonKullanma_tarihli, aktif, birim_fiyat as birimFiyat, aciklama 
            FROM stok_urunler WHERE company_id = ? ORDER BY urun_adi ASC`,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/stok/urunler', authMiddleware, async (req, res) => {
  const u = req.body;
  try {
    await client.execute({
      sql: `INSERT INTO stok_urunler (
        id, stok_kodu, barkod, urun_adi, kategori_id, ana_birim, 
        minimum_stok, maksimum_stok, lot_takibi, son_kullanma_tarihli, 
        aktif, birim_fiyat, aciklama, company_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ensureId(u.id), u.stokKodu, u.barkod || null, u.urunAdi, u.kategoriId || null, u.anaBirim,
        u.minimumStok || 0, u.maksimumStok || null, u.lotTakibi ? 1 : 0, u.sonKullanma_tarihli ? 1 : 0,
        u.aktif !== false ? 1 : 0, u.birimFiyat || 0, u.aciklama || null, req.user.companyId
      ]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/stok/urunler/:id', authMiddleware, async (req, res) => {
  const u = req.body;
  try {
    await client.execute({
      sql: `UPDATE stok_urunler SET 
        stok_kodu = ?, barkod = ?, urun_adi = ?, kategori_id = ?, ana_birim = ?, 
        minimum_stok = ?, maksimum_stok = ?, lot_takibi = ?, son_kullanma_tarihli = ?, 
        aktif = ?, birim_fiyat = ?, aciklama = ?
        WHERE id = ? AND company_id = ?`,
      args: [
        u.stokKodu, u.barkod || null, u.urunAdi, u.kategoriId || null, u.anaBirim,
        u.minimumStok || 0, u.maksimumStok || null, u.lotTakibi ? 1 : 0, u.sonKullanma_tarihli ? 1 : 0,
        u.aktif !== false ? 1 : 0, u.birimFiyat || 0, u.aciklama || null,
        req.params.id, req.user.companyId
      ]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/stok/urunler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM stok_urunler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Warehouses
app.get('/api/stok/depolar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM stok_depolar WHERE company_id = ? ORDER BY kod ASC',
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/stok/depolar', authMiddleware, async (req, res) => {
  const d = req.body;
  try {
    if (d.varsayilan) {
      await client.execute({
        sql: 'UPDATE stok_depolar SET varsayilan = 0 WHERE company_id = ?',
        args: [req.user.companyId]
      });
    }
    await client.execute({
      sql: 'INSERT INTO stok_depolar (id, kod, ad, varsayilan, aktif, adres, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [ensureId(d.id), d.kod, d.ad, d.varsayilan ? 1 : 0, d.aktif !== false ? 1 : 0, d.adres || null, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/stok/depolar/:id', authMiddleware, async (req, res) => {
  const d = req.body;
  try {
    if (d.varsayilan) {
      await client.execute({
        sql: 'UPDATE stok_depolar SET varsayilan = 0 WHERE company_id = ?',
        args: [req.user.companyId]
      });
    }
    await client.execute({
      sql: 'UPDATE stok_depolar SET kod = ?, ad = ?, varsayilan = ?, aktif = ?, adres = ? WHERE id = ? AND company_id = ?',
      args: [d.kod, d.ad, d.varsayilan ? 1 : 0, d.aktif !== false ? 1 : 0, d.adres || null, req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/stok/depolar/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM stok_depolar WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Movements
app.get('/api/stok/hareketler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `SELECT id, urun_id as urunId, depo_id as depoId, tip, miktar, 
            birim_fiyat as birimFiyat, tutar, tarih, aciklama, 
            referans_no as referansNo, iptal
            FROM stok_hareketler WHERE company_id = ? ORDER BY tarih DESC`,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/stok/hareketler', authMiddleware, async (req, res) => {
  const h = req.body;
  console.log('[Stok API] Hareket Kaydı İsteği:', JSON.stringify(h, null, 2));
  try {
    const companyId = n(req.user?.companyId) || 1;
    
    if (h.tip === 'TRANSFER') {
      const transId1 = uuidv4();
      const transId2 = uuidv4();
      const refNo = n(h.referansNo) || n(h.referans) || `TRA-${Date.now().toString().slice(-6)}`;
      
      const stmts = [
        {
          sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, lot_no, son_kullanma_tarihi, company_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            n(transId1), n(h.urunId), n(h.depoId), 'TRANSFER_CIKIS', n(h.miktar) || 0, 
            n(h.birimFiyat) || 0, n(h.tutar) || 0, n(h.tarih) || new Date().toISOString(), 
            n(h.aciklama), n(refNo), n(h.lotNo), n(h.sonKullanmaTarihi), companyId
          ]
        },
        {
          sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, lot_no, son_kullanma_tarihi, company_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            n(transId2), n(h.urunId), n(h.hedefDepoId), 'TRANSFER_GIRIS', n(h.miktar) || 0, 
            n(h.birimFiyat) || 0, n(h.tutar) || 0, n(h.tarih) || new Date().toISOString(), 
            n(h.aciklama), n(refNo), n(h.lotNo), n(h.sonKullanmaTarihi), companyId
          ]
        }
      ];
      console.log('[Stok API] Transfer Batch Strt:' , JSON.stringify(stmts, null, 2));
      await client.batch(stmts, "write");
    } else {
      const args = [
        ensureId(h.id), n(h.urunId), n(h.depoId), n(h.tip), n(h.miktar) || 0, 
        n(h.birimFiyat) || 0, n(h.tutar) || 0, n(h.tarih) || new Date().toISOString(), 
        n(h.aciklama), n(h.referansNo) || n(h.referans), n(h.lotNo), 
        n(h.sonKullanmaTarihi), n(h.bagliFaturaId), companyId
      ];
      console.log('[Stok API] Normal Hareket Args:', args);

      await client.execute({
        sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, lot_no, son_kullanma_tarihi, bagli_fatura_id, company_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: args
      });
    }
    res.json({ success: true });
  } catch (e) { 
    console.error('[Stok API] Hata:', e);
    res.status(500).json({ success: false, message: e.message }); 
  }
});

// Inventory Sessions (Sayım)
app.get('/api/stok/sayimlar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `SELECT id, depo_id as depoId, tarih, durum, onay_tarihi as onayTarihi, 
            onaylayan_kullanici as onaylayanKullanici, aciklama
            FROM stok_sayimlar WHERE company_id = ? ORDER BY tarih DESC`,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/stok/sayimlar/:id', authMiddleware, async (req, res) => {
  try {
    const sayimRs = await client.execute({
      sql: `SELECT id, depo_id as depoId, tarih, durum, onay_tarihi as onayTarihi, 
            onaylayan_kullanici as onaylayanKullanici, aciklama
            FROM stok_sayimlar WHERE id = ? AND company_id = ?`,
      args: [req.params.id, req.user.companyId]
    });
    const kalemlerRs = await client.execute({
      sql: `SELECT id, sayim_id as sayimId, urun_id as urunId, 
            sistem_miktari as sistemMiktari, sayim_miktari as sayimMiktari, fark
            FROM stok_sayim_kalemler WHERE sayim_id = ? AND company_id = ?`,
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true, sayim: sayimRs.rows[0], kalemler: kalemlerRs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/stok/sayimlar/baslat', authMiddleware, async (req, res) => {
  const { depoId } = req.body;
  try {
    const sayimId = uuidv4();
    const now = new Date().toISOString();
    
    // 1. Create session
    await client.execute({
      sql: 'INSERT INTO stok_sayimlar (id, depo_id, tarih, durum, company_id) VALUES (?, ?, ?, ?, ?)',
      args: [sayimId, depoId, now, 'TASLAK', req.user.companyId]
    });

    // 2. Capture snapshot of all active products
    const urunlerRs = await client.execute({
      sql: 'SELECT id FROM stok_urunler WHERE aktif = 1 AND company_id = ?',
      args: [req.user.companyId]
    });

    const batch = urunlerRs.rows.map(u => {
      // For each product, calculate current stock in this warehouse
      return {
        sql: `INSERT INTO stok_sayim_kalemler (id, sayim_id, urun_id, sistem_miktari, sayim_miktari, company_id)
              SELECT ?, ?, ?, 
              COALESCE((SELECT SUM(CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS') THEN miktar ELSE -miktar END) 
               FROM stok_hareketler WHERE urun_id = ? AND depo_id = ? AND iptal = 0 AND company_id = ?), 0),
              COALESCE((SELECT SUM(CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS') THEN miktar ELSE -miktar END) 
               FROM stok_hareketler WHERE urun_id = ? AND depo_id = ? AND iptal = 0 AND company_id = ?), 0),
              ?`,
        args: [uuidv4(), sayimId, u.id, u.id, depoId, req.user.companyId, u.id, depoId, req.user.companyId, req.user.companyId]
      };
    });

    if (batch.length > 0) {
      await client.batch(batch, "write");
    }

    res.json({ success: true, id: sayimId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/stok/sayimlar/kalem-kaydet', authMiddleware, async (req, res) => {
  const { kalemId, sayimMiktari } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE stok_sayim_kalemler SET sayim_miktari = ? WHERE id = ? AND company_id = ?',
      args: [sayimMiktari, kalemId, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/stok/sayimlar/onayla', authMiddleware, async (req, res) => {
  const { id, kullanici } = req.body;
  try {
    const sayimRs = await client.execute({
      sql: 'SELECT * FROM stok_sayimlar WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    const sayim = sayimRs.rows[0];
    if (sayim.durum !== 'TASLAK') return res.status(400).json({ success: false, message: 'Bu sayım zaten onaylanmış.' });

    const kalemlerRs = await client.execute({
      sql: 'SELECT * FROM stok_sayim_kalemler WHERE sayim_id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });

    const movements = [];
    const now = new Date().toISOString();
    const refNo = `SAYIM-${Date.now().toString().slice(-6)}`;

    for (const k of kalemlerRs.rows) {
      const diff = k.sayim_miktari - k.sistem_miktari;
      if (diff !== 0) {
        movements.push({
          sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, tarih, aciklama, referans_no, company_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [uuidv4(), k.urun_id, sayim.depo_id, diff > 0 ? 'SAYIM_GIRIS' : 'SAYIM_CIKIS', Math.abs(diff), now, 'SAYIM SONUCU DÜZELTME', refNo, req.user.companyId]
        });
      }
    }

    movements.push({
      sql: 'UPDATE stok_sayimlar SET durum = ?, onaylayan_kullanici = ? WHERE id = ? AND company_id = ?',
      args: ['ONAYLANDI', kullanici || 'Admin', id, req.user.companyId]
    });

    await client.batch(movements, "write");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Analytics
app.get('/api/stok/analiz', authMiddleware, async (req, res) => {
  try {
    const compId = req.user.companyId;

    // 1. Get all products and categories
    const urunlerRs = await client.execute({
      sql: 'SELECT * FROM stok_urunler WHERE aktif = 1 AND company_id = ?',
      args: [compId]
    });
    const kategorilerRs = await client.execute({
      sql: 'SELECT * FROM stok_kategoriler WHERE company_id = ?',
      args: [compId]
    });
    const hareketlerRs = await client.execute({
      sql: "SELECT * FROM stok_hareketler WHERE iptal = 0 AND company_id = ?",
      args: [compId]
    });

    const urunler = urunlerRs.rows;
    const kategoriler = kategorilerRs.rows;
    const hareketler = hareketlerRs.rows;

    // 2. Calculation logic (similar to mock but on DB data)
    const productStocks = urunler.map(u => {
      const uMoves = hareketler.filter(h => h.urun_id === u.id);
      const totalAmount = uMoves.reduce((total, h) => {
        const isGiris = ['GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS'].includes(h.tip);
        return isGiris ? total + h.miktar : total - h.miktar;
      }, 0);

      const lastPurchase = uMoves.filter(h => h.tip === 'GIRIS').pop();
      const unitVal = lastPurchase?.birim_fiyat || u.birim_fiyat || 0;
      const totalVal = totalAmount * unitVal;

      return {
        id: u.id,
        urunAdi: u.urun_adi,
        stokKodu: u.stok_kodu,
        kategoriId: u.kategori_id,
        miktar: totalAmount,
        deger: totalVal,
        moveCount: uMoves.length,
        minStok: u.minimum_stok
      };
    });

    const totalValuation = productStocks.reduce((sum, p) => sum + p.deger, 0);

    const categoryDist = kategoriler.map(cat => {
      const catVal = productStocks.filter(p => p.kategoriId === cat.id).reduce((sum, p) => sum + p.deger, 0);
      return {
        id: cat.id,
        ad: cat.ad,
        deger: catVal,
        yuzde: totalValuation > 0 ? (catVal / totalValuation) * 100 : 0
      };
    });

    const topMovers = [...productStocks]
      .sort((a, b) => b.moveCount - a.moveCount)
      .slice(0, 5)
      .map(p => ({
        urunAdi: p.urunAdi,
        stokKodu: p.stokKodu,
        moveCount: p.moveCount,
        miktar: p.miktar
      }));

    res.json({
      success: true,
      data: {
        totalValuation,
        categoryDist,
        topMovers,
        criticalCount: productStocks.filter(p => p.miktar <= p.minStok).length
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Manual Database Initialization Route (For Migrations)
app.get('/api/admin/db-init', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await initDb();
    res.json({ success: true, message: 'Veritabanı şeması başarıyla başlatıldı ve güncellendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Veritabanı başlatma hatası: ' + error.message });
  }
});

// Upgrade to Super Admin Route (Constraint Fix + Role Update)
// NOTE: We use a secret param to allow browser access without Bearer token
app.get('/api/admin/upgrade-to-super', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== 'super_upgrade_88') {
    return res.status(401).json({ success: false, message: 'Unauthorized: Geçersiz anahtar.' });
  }

  try {
    console.log('Starting Super Admin Upgrade via Turso Batch API...');
    
    // Check current columns to ensure we copy everything
    const columnsRs = await client.execute('PRAGMA table_info(users)');
    const columns = columnsRs.rows.map(c => c.name).join(', ');
    
// Execute all migration steps in a single atomic batch
    await client.batch([
      "PRAGMA foreign_keys=OFF",
      "DROP TABLE IF EXISTS users_new",
      `CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tc TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'personnel', 'super_admin')) NOT NULL DEFAULT 'personnel',
        must_change_password BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        company_id INTEGER DEFAULT 1
      )`,
      `INSERT INTO users_new (${columns}) SELECT ${columns} FROM users`,
      "DROP TABLE users",
      "ALTER TABLE users_new RENAME TO users",
      {
        sql: "UPDATE users SET role = 'super_admin' WHERE tc = 'admin'",
        args: []
      },
      "PRAGMA foreign_keys=ON"
    ], "write");

    res.json({ 
      success: true, 
      message: 'Başarıyla Süper Admin yapıldınız! Lütfen sayfayı yenileyin veya çıkış-giriş yapın.' 
    });
  } catch (error) {
    console.error('UPGRADE ERROR:', error);
    res.status(500).json({ success: false, message: 'Yükseltme hatası: ' + error.message });
  }
});

// Health/Debug Check Route
app.get('/api/debug/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'online', 
    env: { 
      turso_url: !!process.env.TURSO_URL, 
      turso_token: !!process.env.TURSO_AUTH_TOKEN 
    } 
  });
});
// --- QUOTATIONS (TEKLIFLER) ---
app.get('/api/teklifler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM teklifler WHERE company_id = ? ORDER BY created_at DESC',
      args: [req.user.companyId]
    });
    const teklifler = rs.rows;
    
    // Her teklif için kalemleri de getir
    const data = [];
    for (const t of teklifler) {
      const kalemlerRs = await client.execute({
        sql: 'SELECT * FROM teklif_kalemleri WHERE teklif_id = ?',
        args: [t.id]
      });
      data.push({ ...t, kalemler: kalemlerRs.rows });
    }
    
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/teklifler', authMiddleware, async (req, res) => {
  const { tarih, vade_tarihi, cari_id, musteri_adi, musteri_vkn, musteri_vergi_dairesi, musteri_adres, musteri_eposta, musteri_telefon, notlar, kalemler } = req.body;
  const companyId = req.user.companyId;

  try {
    // 1. Otomatik No Üret: TK-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRs = await client.execute({
      sql: "SELECT COUNT(*) as count FROM teklifler WHERE company_id = ? AND teklif_no LIKE ?",
      args: [companyId, `TK-${year}-%`]
    });
    const nextNum = (Number(countRs.rows[0].count) + 1).toString().padStart(4, '0');
    const teklifNo = `TK-${year}-${nextNum}`;
    
    // 2. Onay Token Üret
    const token = crypto.randomBytes(32).toString('hex');
    const totalTutar = kalemler.reduce((sum, k) => sum + (Number(k.toplam_tutar) || 0), 0);

    const result = await client.execute({
      sql: `INSERT INTO teklifler (teklif_no, tarih, vade_tarihi, cari_id, musteri_adi, musteri_vkn, musteri_vergi_dairesi, musteri_adres, musteri_eposta, musteri_telefon, toplam_tutar, durum, notlar, onay_token, company_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [teklifNo, n(tarih), n(vade_tarihi), n(cari_id), n(musteri_adi), n(musteri_vkn), n(musteri_vergi_dairesi), n(musteri_adres), n(musteri_eposta), n(musteri_telefon), totalTutar, 'Bekliyor', n(notlar), token, companyId]
    });
    
    const teklifId = result.lastInsertRowid;

    // 3. Kalemleri Ekle
    if (kalemler && kalemler.length > 0) {
      const stmts = kalemler.map(k => ({
        sql: `INSERT INTO teklif_kalemleri (teklif_id, urun_id, urun_adi, miktar, birim, birim_fiyat, iskonto_orani, iskonto_tutari, kdv_orani, toplam_tutar)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
           teklifId, n(k.urun_id), n(k.urun_adi), n(k.miktar), n(k.birim) || 'Adet', 
           n(k.birim_fiyat), n(k.iskonto_orani) || 0, n(k.iskonto_tutari) || 0, 
           n(k.kdv_orani), n(k.toplam_tutar)
        ]
      }));
      await client.batch(stmts, "write");
    }

    res.json({ success: true, id: teklifId, teklif_no: teklifNo, token });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/teklifler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { durum, notlar } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE teklifler SET durum = ?, notlar = ? WHERE id = ? AND company_id = ?',
      args: [durum, n(notlar), id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/teklifler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM teklifler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- PUBLIC TEKLIF ROUTES ---
app.get('/api/public/teklif/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM teklifler WHERE onay_token = ?',
      args: [token]
    });
    const t = rs.rows[0];
    if (!t) return res.status(404).json({ success: false, message: 'Teklif bulunamadı.' });

    const kalemlerRs = await client.execute({
      sql: 'SELECT * FROM teklif_kalemleri WHERE teklif_id = ?',
      args: [t.id]
    });

    const companyRs = await client.execute({
      sql: 'SELECT id, name, address, tax_no, email FROM companies WHERE id = ?',
      args: [t.company_id]
    });

    res.json({ success: true, teklif: t, kalemler: kalemlerRs.rows, company: companyRs.rows[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/public/teklif/:token/approve', async (req, res) => {
  const { token } = req.params;
  try {
    // 1. Teklifi Bul
    const rsT = await client.execute({
      sql: 'SELECT * FROM teklifler WHERE onay_token = ?',
      args: [token]
    });
    const t = rsT.rows[0];
    if (!t) return res.status(404).json({ success: false, message: 'Teklif bulunamadı.' });
    if (t.durum !== 'Bekliyor') return res.status(400).json({ success: false, message: 'Bu teklif zaten işlem görmüş.' });

    // 2. Sipariş No Üret: S-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRs = await client.execute({
      sql: "SELECT COUNT(*) as count FROM siparisler WHERE company_id = ? AND siparis_no LIKE ?",
      args: [t.company_id, `S-${year}-%`]
    });
    const nextNum = (Number(countRs.rows[0].count) + 1).toString().padStart(4, '0');
    const siparisNo = `S-${year}-${nextNum}`;

    // 3. Sipariş Oluştur
    const resS = await client.execute({
      sql: `INSERT INTO siparisler (siparis_no, teklif_id, tarih, cari_id, musteri_adi, toplam_tutar, durum, company_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [siparisNo, t.id, new Date().toISOString().split('T')[0], n(t.cari_id), n(t.musteri_adi), t.toplam_tutar, 'Bekliyor', t.company_id]
    });
    const siparisId = resS.lastInsertRowid;

    // 4. Sipariş Kalemlerini Aktar
    const kalemlerRs = await client.execute({
      sql: 'SELECT * FROM teklif_kalemleri WHERE teklif_id = ?',
      args: [t.id]
    });
    
    const sipStmts = kalemlerRs.rows.map(k => ({
      sql: `INSERT INTO siparis_kalemleri (siparis_id, urun_id, urun_adi, miktar, birim, birim_fiyat, kdv_orani, toplam_tutar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [siparisId, n(k.urun_id), n(k.urun_adi), n(k.miktar), n(k.birim), n(k.birim_fiyat), n(k.kdv_orani), n(k.toplam_tutar)]
    }));
    await client.batch(sipStmts, "write");

    // 5. Teklif Durumunu Güncelle
    await client.execute({
      sql: "UPDATE teklifler SET durum = 'Onaylandı (Siparişe Dönüştü)' WHERE id = ?",
      args: [t.id]
    });

    res.json({ success: true, siparis_no: siparisNo });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- ORDERS (SIPARISLER) ---
app.get('/api/siparisler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM siparisler WHERE company_id = ? ORDER BY created_at DESC',
      args: [req.user.companyId]
    });
    const siparisler = rs.rows;
    const data = [];
    for (const s of siparisler) {
      const kalemlerRs = await client.execute({
        sql: 'SELECT * FROM siparis_kalemleri WHERE siparis_id = ?',
        args: [s.id]
      });
      data.push({ ...s, kalemler: kalemlerRs.rows });
    }
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/siparisler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { durum } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE siparisler SET durum = ? WHERE id = ? AND company_id = ?',
      args: [durum, id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/siparisler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM siparisler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- LUCA HESAP PLANI ENTEGRASYONU ---
app.get('/api/luca/hesap-plani', authMiddleware, async (req, res) => {
  console.log(`[Backend] Luca hesap planı isteği alındı. User: ${req.user.tc}`);
  try {
    const rs = await client.execute({
      sql: 'SELECT kod, ad, tur FROM luca_hesap_plani WHERE company_id = ? ORDER BY kod ASC',
      args: [req.user.companyId]
    });
    console.log(`[Backend] Bulunan hesap sayısı: ${rs.rows.length}`);
    res.json({ success: true, data: rs.rows || [] });
  } catch (e) { 
    console.error('[Backend] Luca Get Error:', e);
    res.status(500).json({ success: false, message: 'Veritabanı hatası: ' + e.message }); 
  }
});

app.post('/api/luca/hesap-plani/sync', authMiddleware, async (req, res) => {
  const { accounts } = req.body; // [{kod, ad, tur}, ...]
  if (!accounts || !Array.isArray(accounts)) return res.status(400).json({ success: false, message: 'Geçersiz veri formatı.' });

  try {
    // Toplu ekleme (Batch Insert/Upsert)
    // Turso/LibSQL supports batch. We can use it or a single transaction.
    // Since we have MANY accounts, we use batch and REPLACE (or IGNORE then UPDATE).
    // SQLite doesn't have UPSERT (INSERT ... ON CONFLICT) in older versions, but libSQL does.
    
    const statements = accounts.map(a => ({
      sql: 'INSERT INTO luca_hesap_plani (company_id, kod, ad, tur) VALUES (?, ?, ?, ?) ON CONFLICT(company_id, kod) DO UPDATE SET ad=excluded.ad, tur=excluded.tur',
      args: [req.user.companyId, a.kod, a.ad, a.tur || '']
    }));

    await client.batch(statements, "write");
    console.log(`[Backend] Başarılı: ${accounts.length} hesap Luca'dan senkronize edildi.`);
    res.json({ success: true, count: accounts.length });
  } catch (e) {
    console.error('Luca Sync Error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// --- SMTP AYARLARI & MAIL GÖNDERİMİ ---
app.get('/api/settings/smtp', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
      args: [req.user.companyId]
    });
    
    let settings = {};
    rs.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, settings });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/settings/smtp', authMiddleware, async (req, res) => {
  const settings = req.body; // { smtp_host: '...', smtp_user: '...' } vb.
  try {
    const stmts = Object.keys(settings).map(key => ({
      sql: 'INSERT INTO company_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT(company_id, setting_key) DO UPDATE SET setting_value=excluded.setting_value',
      args: [req.user.companyId, key, settings[key]]
    }));
    if (stmts.length > 0) {
      await client.batch(stmts, "write");
    }
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/teklifler/:id/send-email', authMiddleware, async (req, res) => {
  const { to, subject, message } = req.body;
  const { id } = req.params;
  
  try {
    // 1. SMTP Ayarlarını Çek
    const configRs = await client.execute({
      sql: "SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN ('smtp_host','smtp_port','smtp_user','smtp_pass', 'smtp_secure')",
      args: [req.user.companyId]
    });
    
    let config = {};
    configRs.rows.forEach(r => { config[r.setting_key] = r.setting_value; });
    
    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
      return res.status(400).json({ success: false, message: 'SMTP ayarları eksik. Lütfen önce "Ayarlar" sekmesinden e-posta bilgilerinizi tanımlayın.' });
    }

    // 2. Teklif token bilgisini ve şirket bilgisini çek (Gerekirse link olarak konacak, zaten ön yüzden hazır metin dönüyor ama backend de bilebilir)
    const teklifRs = await client.execute({
      sql: 'SELECT onay_token FROM teklifler WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    
    if (!teklifRs.rows.length) return res.status(404).json({ success: false, message: 'Teklif bulunamadı.' });
    
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: parseInt(config.smtp_port) || 465,
      secure: config.smtp_secure === 'true' || config.smtp_port == '465',
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass
      }
    });

    const mailOptions = {
      from: config.smtp_user,
      to,
      subject,
      text: message, // Sadece metin gönderimi (Veya gelişmiş HTML yapabiliriz)
      html: message.replace(/\\n/g, '<br/>') // Frontend'den gelen alt satırları <br> yaparız
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, info });

  } catch (e) {
    console.error("Mail Send Error: ", e);
    res.status(500).json({ success: false, message: e.message || "E-posta gönderilirken teknik bir hata oluştu." });
  }
});

app.get('/api/stok/:id/history', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get history (Only inputs to see costs, e.g. GIRIS types)
    const historyRs = await client.execute({
      sql: 'SELECT tip, miktar, birim_fiyat, tarih FROM stok_hareketler WHERE urun_id = ? AND company_id = ? AND (tip = ? OR tip = ?) ORDER BY tarih DESC',
      args: [id, req.user.companyId, 'GIRIS', 'DEVIR']
    });
    
    // 2. Calculate remaining stock across all active inventory
    const totalRs = await client.execute({
      sql: "SELECT SUM(CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS', 'DEVIR') THEN miktar ELSE -miktar END) as kalan_stok FROM stok_hareketler WHERE urun_id = ? AND company_id = ? AND iptal = 0",
      args: [id, req.user.companyId]
    });
    
    const kalan_stok = totalRs.rows[0]?.kalan_stok || 0;
    
    res.json({ success: true, history: historyRs.rows, kalan_stok });
  } catch (e) {
    console.error("Stok History Error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/mutabakatlar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT m.*, c.unvan as cariUnvan, c.vkn_tckn as cariVkn, c.eposta as cariEposta 
        FROM mutabakatlar m
        LEFT JOIN cariler c ON m.cari_id = c.id
        WHERE m.company_id = ?
        ORDER BY m.olusturma_tarihi DESC
      `,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.delete('/api/mutabakatlar/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM mutabakatlar WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/mutabakatlar/bulk-delete', authMiddleware, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'Geçersiz ID listesi.' });
  try {
    const placeholders = ids.map(() => '?').join(',');
    await client.execute({
      sql: `DELETE FROM mutabakatlar WHERE id IN (${placeholders}) AND company_id = ?`,
      args: [...ids, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/mutabakatlar/:id/send-mail', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT m.*, c.unvan, c.eposta FROM mutabakatlar m JOIN cariler c ON m.cari_id = c.id WHERE m.id = ? AND m.company_id = ?',
      args: [req.params.id, req.user.companyId]
    });

    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Bulunamadı.' });
    const mutabakat = rs.rows[0];

    const rsSettings = await client.execute({
      sql: 'SELECT * FROM company_settings WHERE company_id = ?',
      args: [req.user.companyId]
    });
    const config = {};
    rsSettings.rows.forEach(r => { config[r.setting_key] = r.setting_value; });

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: parseInt(config.smtp_port) || 465,
      secure: config.smtp_secure === 'true' || config.smtp_port == '465',
      auth: { user: config.smtp_user, pass: config.smtp_pass }
    });

    const publicUrl = `${req.get('origin') || 'http://localhost:5173'}/?mutabakat=${mutabakat.token}`;
    await transporter.sendMail({
      from: config.smtp_user,
      to: mutabakat.eposta,
      subject: `${config.company_name || 'Şirket'} - Mutabakat Formu (${mutabakat.donem})`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #334155;">
          <h2 style="color: #4f46e5;">Mutabakat Talebi</h2>
          <p>Sayın <b>${mutabakat.unvan}</b>,</p>
          <p>Sizlerle olan <b>${mutabakat.donem}</b> dönemine ait cari hesap bakiyemiz aşağıdadır:</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="margin: 5px 0;"><b>Bakiye:</b> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(mutabakat.bakiye)}</p>
          </div>
          <p>Mutabakat işlemini onaylamak veya reddetmek için lütfen aşağıdaki butona tıklayınız:</p>
          <a href="${publicUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Mutabakatı Görüntüle</a>
          <p style="margin-top: 30px; font-size: 12px; color: #64748b;">Bu e-posta otomatik olarak gönderilmiştir.</p>
        </div>
      `
    });

    await client.execute({
      sql: 'UPDATE mutabakatlar SET gonderim_tarihi = CURRENT_TIMESTAMP WHERE id = ?',
      args: [mutabakat.id]
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/mutabakatlar/bulk', authMiddleware, async (req, res) => {
  const { mutabakatlar, bizeAitMuavinBase64 } = req.body;
  if (!mutabakatlar || !Array.isArray(mutabakatlar)) {
    return res.status(400).json({ success: false, message: 'Veri geçersiz.' });
  }

  try {
    // Ensure new columns exist (safe migration on first access)
    try {
      const colInfo = await client.execute('PRAGMA table_info(mutabakatlar)');
      const cols = colInfo.rows.map(r => r.name);
      if (!cols.includes('karsi_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_data TEXT');
      if (!cols.includes('karsi_muavin_filename')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_filename TEXT');
      if (!cols.includes('kullanici_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN kullanici_muavin_data TEXT');
    } catch (_) { /* already exist */ }

    // Store admin muavin as base64 in DB (survives Vercel restarts)
    let muavinData = null;
    if (bizeAitMuavinBase64) {
      muavinData = bizeAitMuavinBase64;
    }

    const created = [];
    let notFoundCount = 0;
    let noEmailCount = 0;

    for (const row of mutabakatlar) {
      const rsCari = await client.execute({
        sql: 'SELECT id, unvan, eposta FROM cariler WHERE (muhasebe_kodu = ? OR vkn_tckn = ? OR vkn_tckn = ?) AND company_id = ?',
        args: [row.muhasebeKodu, row.muhasebeKodu, row.vknTckn || '', req.user.companyId]
      });

      if (rsCari.rows.length > 0) {
        const cari = rsCari.rows[0];
        if (!cari.eposta) {
          noEmailCount++;
          continue;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const id = 'm' + Date.now() + Math.random().toString(36).substr(2, 5);

        await client.execute({
          sql: `INSERT INTO mutabakatlar (id, company_id, cari_id, donem, tip, borc, alacak, bakiye, token, aciklama, kullanici_muavin_data, durum) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id, req.user.companyId, cari.id, row.donem, 'CARI', row.borc, row.alacak, row.bakiye, token, row.aciklama || '', muavinData, 'Bekliyor']
        });

        created.push({ id, unvan: cari.unvan, eposta: cari.eposta });
      } else {
        notFoundCount++;
      }
    }

    res.json({ 
      success: true, 
      created,
      notFoundCount,
      noEmailCount,
      totalRows: mutabakatlar.length
    });
  } catch (e) {
    console.error("Bulk Mutabakat error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Mutabakat Public View
app.get('/api/public/mutabakat/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const rs = await client.execute({
      sql: `SELECT m.*, c.unvan, co.name as company_name, co.tax_no as company_vkn, co.address as company_address
            FROM mutabakatlar m 
            JOIN cariler c ON m.cari_id = c.id 
            JOIN companies co ON m.company_id = co.id
            WHERE m.token = ?`,
      args: [token]
    });
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Mutabakat bulunamadı veya link geçersiz.' });
    res.json({ success: true, data: rs.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/public/mutabakat/:token/respond', async (req, res) => {
  const { token } = req.params;
  const { durum, aciklama, muavinBase64, muavinFileName } = req.body;

  try {
    // Ensure new columns exist (safe migration on first access)
    try {
      const colInfo = await client.execute('PRAGMA table_info(mutabakatlar)');
      const cols = colInfo.rows.map(r => r.name);
      if (!cols.includes('karsi_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_data TEXT');
      if (!cols.includes('karsi_muavin_filename')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_filename TEXT');
      if (!cols.includes('kullanici_muavin_data')) await client.execute('ALTER TABLE mutabakatlar ADD COLUMN kullanici_muavin_data TEXT');
    } catch (_) { /* already exist */ }

    // Store file as base64 in DB (survives Vercel restarts)
    let muavinData = null;
    let muavinName = null;
    if (muavinBase64) {
      muavinData = muavinBase64; // keep full data URI including header
      muavinName = muavinFileName || `karsi_muavin_${Date.now()}.xlsx`;
    }

    await client.execute({
      sql: `UPDATE mutabakatlar 
            SET durum = ?, aciklama = ?, 
                karsi_muavin_data = COALESCE(?, karsi_muavin_data),
                karsi_muavin_filename = COALESCE(?, karsi_muavin_filename),
                yanit_tarihi = CURRENT_TIMESTAMP 
            WHERE token = ?`,
      args: [durum, aciklama || '', muavinData, muavinName, token]
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/mutabakatlar/analyze/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM mutabakatlar WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Mutabakat bulunamadı.' });
    const mutabakat = rs.rows[0];

    // Check if at least the customer muavin is available (in DB or on disk)
    const hasKarsiMuavin = mutabakat.karsi_muavin_data || (mutabakat.karsi_muavin_path && fs.existsSync(path.join(uploadsDir, mutabakat.karsi_muavin_path)));
    const hasBizMuavin = mutabakat.kullanici_muavin_data || (mutabakat.kullanici_muavin_path && fs.existsSync(path.join(uploadsDir, mutabakat.kullanici_muavin_path)));

    if (!hasKarsiMuavin || !hasBizMuavin) {
      return res.status(400).json({ success: false, message: 'Karşılaştırma için her iki muavin dosyası da mevcut olmalıdır. Lütfen karşı tarafın bir dosya yüklediğinden emin olun.' });
    }

    // 1. Gemini Key Çek
    const rsSettings = await client.execute({
      sql: "SELECT setting_value FROM company_settings WHERE company_id = ? AND setting_key = 'gemini_api_key'",
      args: [req.user.companyId]
    });
    const apiKey = rsSettings.rows[0]?.setting_value || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Yapay zeka anahtarı (Gemini API Key) bulunamadı. Lütfen ayarlardan tanımlayın.' });
    }

    // 2. Dosyaları Oku ve Parse Et (DB base64 öncelikli, fallback to disk)
    const readXlsxRows = (base64Data, filePath) => {
      if (base64Data) {
        const pureBase64 = base64Data.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(pureBase64, 'base64');
        const wb = xlsx.read(buffer, { type: 'buffer' });
        return xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else if (filePath && fs.existsSync(filePath)) {
        const wb = xlsx.readFile(filePath);
        return xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      }
      return [];
    };

    const bizRows = readXlsxRows(mutabakat.kullanici_muavin_data, path.join(uploadsDir, mutabakat.kullanici_muavin_path || ''));
    const karsiRows = readXlsxRows(mutabakat.karsi_muavin_data, path.join(uploadsDir, mutabakat.karsi_muavin_path || ''));

    // 3. AI Analiz Promptu
    const prompt = `
      Sana iki farklı firmadan gelen cari hesap "muavin" (hesap dökümü) satırlarını gönderiyorum. 
      Senin görevin bu iki tabloyu karşılaştırıp uyuşmazlıkları (farklılıkları) bulmaktır. 
      Aşağıdaki durumları tolere etmelisin ve eşleşmiş saymalısın:
      - Tarih formatı farklılıkları (Örn: 01.12 vs 2024-12-01).
      - Açıklama farklılıkları (Örn: "Fatura 123" vs "123 No'lu Satış Faturası").
      - Evrak numarasındaki sıfır eksikleri (Örn: "0001" vs "1").
      - Bir ayın sonundaki işlemin diğer ayın başında gözükmesi (Aralık sonundaki faturanın Ocak'ta işlenmesi).

      Tablo 1 (Bizim Kayıtlar): ${JSON.stringify(bizRows.slice(0, 150))} 
      Tablo 2 (Müşterinin Kayıtları): ${JSON.stringify(karsiRows.slice(0, 150))}

      Lütfen sonucu şu formatta JSON olarak dön:
      {
        "uyusmazliklar": [
          {"tarih": "...", "aciklama": "...", "tutar": "...", "sebep": "Bizde var müşteride yok / Tutar farklı / Müşteride var bizde yok"}
        ],
        "ozet": "Genel bir değerlendirme..."
      }
      Sadece JSON objesini döndür, başka açıklama yapma.
    `;

    // 4. Gemini API Çağrısı
    const geminiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      contents: [{ parts: [{ text: prompt }] }]
    }, { timeout: 30000 });

    const aiText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    const aiResult = jsonMatch ? jsonMatch[0] : aiText;

    // 5. Sonucu Kaydet
    await client.execute({
      sql: 'UPDATE mutabakatlar SET ai_analiz_sonucu = ? WHERE id = ?',
      args: [aiResult, id]
    });

    res.json({ success: true, analysis: JSON.parse(aiResult) });
  } catch (e) {
    console.error("AI Analysis Error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ID-based download: reads from DB first, fallback to disk
app.get('/api/mutabakatlar/:id/download-muavin', authMiddleware, async (req, res) => {
  try {
    // Ensure new columns exist (safe migration on first access)
    try {
      const colInfo = await client.execute('PRAGMA table_info(mutabakatlar)');
      const cols = colInfo.rows.map(r => r.name);
      if (!cols.includes('karsi_muavin_data')) {
        await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_data TEXT');
      }
      if (!cols.includes('karsi_muavin_filename')) {
        await client.execute('ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_filename TEXT');
      }
      if (!cols.includes('kullanici_muavin_data')) {
        await client.execute('ALTER TABLE mutabakatlar ADD COLUMN kullanici_muavin_data TEXT');
      }
    } catch (_) { /* columns already exist */ }

    const rs = await client.execute({
      sql: 'SELECT id, karsi_muavin_data, karsi_muavin_filename, karsi_muavin_path FROM mutabakatlar WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Mutabakat bulunamadı.' });
    const m = rs.rows[0];

    if (m.karsi_muavin_data) {
      // Serve from DB
      const pureBase64 = String(m.karsi_muavin_data).replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(pureBase64, 'base64');
      const fileName = m.karsi_muavin_filename || 'muavin.xlsx';
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    } else if (m.karsi_muavin_path) {
      // Legacy: serve from disk
      const filePath = path.join(uploadsDir, String(m.karsi_muavin_path));
      if (fs.existsSync(filePath)) return res.download(filePath, String(m.karsi_muavin_path));
    }
    res.status(404).json({ success: false, message: 'Muavin dosyası bulunamadı. Müşteri bu mutabakat için bir dosya yüklememiş olabilir.' });
  } catch (e) {
    console.error('download-muavin error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/download/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(uploadsDir, fileName);
  if (fs.existsSync(filePath)) {
    res.download(filePath, fileName);
  } else {
    res.status(404).json({ success: false, message: 'Dosya bulunamadı.' });
  }
});

app.use('/uploads', express.static(uploadsDir));

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`🚀 LUCA & FATURA BACKEND ÇALIŞIYOR: http://localhost:${PORT}`);
    console.log('--------------------------------------------------');
  });
}

export default app;
