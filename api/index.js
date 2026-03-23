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

let db, generateToken, authMiddleware, adminMiddleware, bcrypt;

try {
  // Internal Modules (Vercel scope)
  db = require('./db');
  const auth = require('./auth');
  generateToken = auth.generateToken;
  authMiddleware = auth.authMiddleware;
  adminMiddleware = auth.adminMiddleware;
  bcrypt = auth.bcrypt;
} catch (err) {
  console.error('DB/AUTH LOAD ERROR:', err);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Global Error Catch for Startup Failures
app.use((req, res, next) => {
  if (!db) {
    return res.status(500).json({ 
      success: false, 
      message: 'Database initialization failed. This is likely due to better-sqlite3 native module issues on Vercel.',
      error: process.env.NODE_ENV === 'development' ? 'DB was null' : undefined
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

app.post('/api/admin/personnel', authMiddleware, adminMiddleware, async (req, res) => {
  const { tc, first_name, last_name, email, phone, position, department, salary, annual_leave_days, start_date, end_date } = req.body;
  if (!tc || !first_name || !last_name) {
    return res.status(400).json({ success: false, message: 'TC, isim ve soyisim gereklidir.' });
  }
  try {
    const defaultPassword = bcrypt.hashSync('123456', 10);
    const userResult = db.prepare('INSERT INTO users (tc, password, role) VALUES (?, ?, ?)').run(tc, defaultPassword, 'personnel');
    
    // If annual_leave_days is not provided, calculate it
    const calculatedLeave = annual_leave_days || calculateAnnualLeave(start_date);

    db.prepare('INSERT INTO personnel (user_id, first_name, last_name, email, phone, position, department, salary, annual_leave_days, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      userResult.lastInsertRowid, first_name, last_name, email, phone, position, department, salary, calculatedLeave, 'Active', start_date, end_date
    );
    res.json({ success: true, message: 'Personel başarıyla oluşturuldu.' });
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
    
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (tc, password, role) VALUES (?, ?, ?)');
    const insertPersonnel = db.prepare('INSERT INTO personnel (user_id, first_name, last_name, email, phone, position, department, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const defaultPassword = bcrypt.hashSync('123456', 10);

    const findField = (row, fields) => {
      const key = Object.keys(row).find(k => fields.some(f => k.toLowerCase() === f.toLowerCase()));
      return key ? row[key] : null;
    };

    let count = 0;
    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const tc = findField(row, ['TC', 'TCKN', 'Kimlik', 'tc_no']);
        const ad = findField(row, ['Ad', 'İsim', 'First Name', 'firstName']);
        const soyad = findField(row, ['Soyad', 'Last Name', 'lastName']);
        
        if (!tc || !ad || !soyad) continue;

        const userResult = insertUser.run(tc.toString(), defaultPassword, 'personnel');
        if (userResult.changes > 0) {
          insertPersonnel.run(
            userResult.lastInsertRowid, 
            ad, soyad, 
            findField(row, ['Email', 'E-posta', 'Mail']), 
            findField(row, ['Telefon', 'Phone', 'Tel']), 
            findField(row, ['Pozisyon', 'Position', 'Görev']), 
            findField(row, ['Departman', 'Department', 'Bölüm']), 
            findField(row, ['Maaş', 'Maas', 'Salary'])
          );
          count++;
        }
      }
    });
    
    transaction(data);
    res.json({ success: true, message: `${count} yeni personel başarıyla eklendi.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Excel işleme hatası: ' + error.message });
  }
});

// Delete personnel (admin)
app.delete('/api/admin/personnel/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  try {
    const p = db.prepare('SELECT user_id FROM personnel WHERE id = ?').get(id);
    if (p && p.user_id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(p.user_id);
    }
    db.prepare('DELETE FROM personnel WHERE id = ?').run(id);
    res.json({ success: true, message: 'Personel silindi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Update personnel (admin) - MOVED & CONSOLIDATED
app.put('/api/admin/personnel/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, phone, position, department, salary, annual_leave_days, status, start_date, end_date } = req.body;
  try {
    db.prepare(`
      UPDATE personnel SET 
        first_name = ?, last_name = ?, email = ?, phone = ?, 
        position = ?, department = ?, salary = ?, annual_leave_days = ?, status = ?,
        start_date = ?, end_date = ?
      WHERE id = ?
    `).run(first_name, last_name, email, phone, position, department, salary, annual_leave_days, status || 'Active', start_date, end_date, id);
    res.json({ success: true, message: 'Personel güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// --- LEAVES ---
app.get('/api/admin/leaves', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const list = db.prepare(`
      SELECT l.*, p.first_name, p.last_name 
      FROM leaves l 
      JOIN personnel p ON l.personnel_id = p.id
      ORDER BY l.created_at DESC
    `).all();
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/personnel/leaves', authMiddleware, (req, res) => {
  const { type, start_date, end_date, description } = req.body;
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    db.prepare('INSERT INTO leaves (personnel_id, type, start_date, end_date, description) VALUES (?, ?, ?, ?, ?)').run(
      p.id, type, start_date, end_date, description
    );
    res.json({ success: true, message: 'İzin talebi iletildi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/admin/leaves/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED', 'REJECTED'
  try {
    const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
    if (!leave) return res.status(404).json({ success: false, message: 'İzin kaydı bulunamadı.' });

    // Eğer onaylanıyorsa yıllık izinden düş
    if (status === 'APPROVED' && leave.status !== 'APPROVED' && leave.type === 'Annual Leave') {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      db.prepare('UPDATE personnel SET annual_leave_days = annual_leave_days - ? WHERE id = ?').run(diffDays, leave.personnel_id);
    }

    db.prepare('UPDATE leaves SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true, message: 'Talep güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// --- REQUESTS (Expenses/Advances) ---
app.get('/api/admin/requests', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const list = db.prepare(`
      SELECT r.*, p.first_name, p.last_name 
      FROM requests r 
      JOIN personnel p ON r.personnel_id = p.id
      ORDER BY r.created_at DESC
    `).all();
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/admin/requests/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true, message: 'Talep güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// This route was a duplicate of 216, removed and kept only one with extended logic above.

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

app.get('/api/admin/pointage', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const list = db.prepare(`
      SELECT po.*, p.first_name, p.last_name 
      FROM pointage po
      JOIN personnel p ON po.personnel_id = p.id
      ORDER BY po.date DESC
    `).all();
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/admin/pointage/template', authMiddleware, adminMiddleware, (req, res) => {
  const personnel = db.prepare('SELECT id, first_name, last_name FROM personnel WHERE status = "Active"').all();
  const data = personnel.map(p => ({
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

app.post('/api/admin/pointage/bulk-upload', authMiddleware, adminMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Excel dosyası gereklidir.' });
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const upsert = db.prepare(`
      INSERT INTO pointage (personnel_id, date, status, overtime_hours)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(personnel_id, date) DO UPDATE SET
        status = excluded.status,
        overtime_hours = excluded.overtime_hours
    `);

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const pid = row.ID || row.id || row.Id;
        const date = row.Tarih || row.date || row.Date;
        const status = row.Durum || row.status || row.Status;
        const ot = row['Fazla Mesai'] || row.overtime || 0;
        if (pid && date && status) {
          upsert.run(pid, date, status, ot);
        }
      }
    });
    transaction(data);
    res.json({ success: true, message: `${data.length} puantaj kaydı işlendi.` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/personnel/requests', authMiddleware, upload.single('file'), (req, res) => {
  const { type, amount, date, description } = req.body;
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    const receipt_path = req.file ? req.file.path : null;
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