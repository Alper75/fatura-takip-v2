const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { createInvoiceAndGetHTML } = require('fatura');

// Internal Modules (Vercel scope)
const db = require('./db');
const { generateToken, authMiddleware, adminMiddleware, bcrypt } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

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

// --- GİB PORTAL LOGIC ---
const USE_TEST_MODE = false;

// --- PERSONNEL MODULE ROUTES ---

// Login
app.post('/api/auth/login', async (req, res) => {
  const { tc, password } = req.body;
  if (!tc || !password) return res.status(400).json({ success: false, message: 'TC ve şifre gereklidir.' });
  try {
    const user = db.prepare('SELECT * FROM users WHERE tc = ?').get(tc);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Geçersiz TC veya şifre.' });
    }
    const token = generateToken(user);
    res.json({ success: true, token, user: { id: user.id, tc: user.tc, role: user.role, mustChangePassword: !!user.must_change_password } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ success: false, message: 'Yeni şifre gereklidir.' });
  try {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?').run(hashedPassword, req.user.id);
    res.json({ success: true, message: 'Şifre başarıyla değiştirildi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/personnel/me', authMiddleware, (req, res) => {
  try {
    const personnel = db.prepare('SELECT * FROM personnel WHERE user_id = ?').get(req.user.id);
    res.json({ success: true, personnel });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/personnel', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const personnelList = db.prepare(`
      SELECT p.*, u.tc, u.must_change_password 
      FROM personnel p 
      JOIN users u ON p.user_id = u.id
    `).all();
    res.json({ success: true, personnel: personnelList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/personnel/bulk-upload', authMiddleware, adminMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Excel dosyası gereklidir.' });
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const insertUser = db.prepare('INSERT INTO users (tc, password, role) VALUES (?, ?, ?)');
    const insertPersonnel = db.prepare('INSERT INTO personnel (user_id, first_name, last_name, email, phone, position, department, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const defaultPassword = bcrypt.hashSync('123456', 10);
    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const userResult = insertUser.run(row.TC.toString(), defaultPassword, 'personnel');
        insertPersonnel.run(userResult.lastInsertRowid, row.Ad, row.Soyad, row.Email, row.Telefon, row.Pozisyon, row.Departman, row.Maaş);
      }
    });
    transaction(data);
    res.json({ success: true, message: `${data.length} personel başarıyla eklendi.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Excel işleme hatası: ' + error.message });
  }
});

// --- POINTAGE & REQUESTS (Simplified structure for index) ---
app.post('/api/pointage', authMiddleware, (req, res) => {
  const { personnel_id, date, status, overtime_hours } = req.body;
  try {
    const upsert = db.prepare(`
      INSERT INTO pointage (personnel_id, date, status, overtime_hours)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(personnel_id, date) DO UPDATE SET
        status = excluded.status,
        overtime_hours = excluded.overtime_hours
    `);
    upsert.run(personnel_id, date, status, overtime_hours || 0);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/announcements', authMiddleware, (req, res) => {
  const data = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10').all();
  res.json({ success: true, data });
});

app.post('/api/requests', authMiddleware, upload.single('file'), (req, res) => {
  const { type, amount, date, description } = req.body;
  const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
  const receipt_path = req.file ? req.file.path : null;
  try {
    db.prepare('INSERT INTO requests (personnel_id, type, amount, date, description, receipt_path) VALUES (?, ?, ?, ?, ?, ?)').run(
      p.id, type, amount, date, description, receipt_path
    );
    res.json({ success: true, message: 'Talep iletildi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// --- GİB API ROUTES ---
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;
  if (!credentials || !invoice) return res.status(400).json({ success: false, message: 'Eksik veri.' });
  try {
    const gibInvoice = {
      vknTckn: invoice.vknTckn,
      ad: invoice.ad,
      soyad: invoice.soyad || '',
      adres: invoice.adres || '',
      ulke: 'Türkiye',
      tarih: invoice.tarih || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      faturaTipi: 'SATIS',
      malHizmetListe: [{
        name: invoice.aciklama || 'Hizmet Bedeli',
        quantity: 1,
        unit: 'ADET',
        unitPrice: invoice.tutar,
        price: invoice.tutar,
        vatRate: invoice.kdvOrani || 20,
        vatAmount: (invoice.tutar * (invoice.kdvOrani || 20)) / 100,
        totalAmount: invoice.tutar + (invoice.tutar * (invoice.kdvOrani || 20)) / 100
      }]
    };
    const result = await createInvoiceAndGetHTML(credentials.username, credentials.password, gibInvoice, { sign: false });
    res.json({ success: true, message: 'Taslak fatura portala başarıyla gönderildi.', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Fatura oluşturma hatası: ' + error.message });
  }
});

// Static files (Ephermal on Vercel)
app.use('/uploads', express.static(uploadsDir));

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;