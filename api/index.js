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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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
      ORDER BY p.first_name ASC
    `).all();
    res.json({ success: true, personnel: personnelList });
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
    const userResult = db.prepare('INSERT INTO users (tc, password, role) VALUES (?, ?, ?)').run(tc, defaultPassword, 'personnel');
    
    // If annual_leave_days is not provided, calculate it
    const calculatedLeave = annual_leave_days || calculateAnnualLeave(start_date);

    db.prepare(`
      INSERT INTO personnel (
        user_id, first_name, last_name, email, phone, 
        position, department, salary, annual_leave_days, 
        status, start_date, end_date, puantaj_menu_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userResult.lastInsertRowid, first_name, last_name, email, phone, 
      position, department, salary, calculatedLeave, 'Active', 
      start_date, end_date, puantaj_menu_active ? 1 : 0
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
  const { first_name, last_name, email, phone, position, department, salary, annual_leave_days, status, start_date, end_date, puantaj_menu_active } = req.body;
  try {
    db.prepare(`
      UPDATE personnel SET 
        first_name = ?, last_name = ?, email = ?, phone = ?, 
        position = ?, department = ?, salary = ?, annual_leave_days = ?, status = ?,
        start_date = ?, end_date = ?, puantaj_menu_active = ?
      WHERE id = ?
    `).run(
      n(first_name), n(last_name), n(email), n(phone), 
      n(position), n(department), n(salary), n(annual_leave_days), 
      status || 'Active', n(start_date), n(end_date), (puantaj_menu_active === true || puantaj_menu_active == 1) ? 1 : 0, 
      id
    );
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

app.post('/api/personnel/leaves', authMiddleware, upload.single('document'), (req, res) => {
  const { type, start_date, end_date, description } = req.body;
  const document_path = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    db.prepare('INSERT INTO leaves (personnel_id, type, start_date, end_date, description, document_path) VALUES (?, ?, ?, ?, ?, ?)').run(
      p.id, n(type), n(start_date), n(end_date), n(description), n(document_path)
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

    if (status === 'APPROVED' && leave.status !== 'APPROVED') {
      // Yıllık izinden düş (sadece yıllık izin ise)
      if (leave.type === 'Annual' || leave.type === 'Annual Leave') {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        db.prepare('UPDATE personnel SET annual_leave_days = annual_leave_days - ? WHERE id = ?').run(diffDays, leave.personnel_id);
      }

      // PUANTAJA OTOMATİK İŞLE
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const statusMapping = {
        'Annual': 'Annual Leave',
        'Annual Leave': 'Annual Leave',
        'Unpaid': 'Unpaid Leave',
        'Unpaid Leave': 'Unpaid Leave',
        'Sickness': 'Sickness',
        'Maternity': 'Annual Leave' // Doğum izni için ayrı statü yoksa yıllık izin rengi
      };
      const ptStatus = statusMapping[leave.type] || 'Annual Leave';

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        db.prepare(`
          INSERT INTO pointage (personnel_id, date, status, overtime_hours)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(personnel_id, date) DO UPDATE SET status = excluded.status
        `).run(leave.personnel_id, dateStr, ptStatus);
      }
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

app.post('/api/personnel/requests', authMiddleware, upload.single('receipt'), (req, res) => {
  const { type, amount, date, description } = req.body;
  const receipt_path = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    
    db.prepare('INSERT INTO requests (personnel_id, type, amount, date, description, receipt_path) VALUES (?, ?, ?, ?, ?, ?)').run(
      p.id, n(type), n(amount), n(date), n(description), n(receipt_path)
    );
    res.json({ success: true, message: 'Masraf talebi iletildi.' });
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
// Personnel Self Routes
app.get('/api/personnel/leaves', authMiddleware, (req, res) => {
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    const list = db.prepare('SELECT * FROM leaves WHERE personnel_id = ? ORDER BY created_at DESC').all(p.id);
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/personnel/requests', authMiddleware, (req, res) => {
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    const list = db.prepare('SELECT * FROM requests WHERE personnel_id = ? ORDER BY created_at DESC').all(p.id);
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/personnel/pointage', authMiddleware, (req, res) => {
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
    const list = db.prepare('SELECT * FROM pointage WHERE personnel_id = ?').all(p.id);
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/pointage', authMiddleware, (req, res) => {
  let { personnel_id, date, status, overtime_hours } = req.body;
  try {
    // Eğer personel kendisi giriyorsa, personnel_id'yi kendi id'si yap
    if (req.user.role === 'personnel') {
      const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
      personnel_id = p.id;
    }

    // Kilit kontrolü (Personel ise)
    if (req.user.role === 'personnel') {
      const existing = db.prepare('SELECT is_locked FROM pointage WHERE personnel_id = ? AND date = ?').get(personnel_id, date);
      if (existing && existing.is_locked) {
        return res.status(403).json({ success: false, message: 'Bu tarih kilitli olduğu için değişiklik yapılamaz.' });
      }
    }

    const upsert = db.prepare(`
      INSERT INTO pointage (personnel_id, date, status, overtime_hours, is_locked)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(personnel_id, date) DO UPDATE SET
        status = excluded.status,
        overtime_hours = excluded.overtime_hours,
        is_locked = CASE WHEN ? = 'admin' THEN excluded.is_locked ELSE pointage.is_locked END
    `);
    
    // Admin üzerinden geliyorsa kilitleme yetkisi verelim (şuanlık statik 0, UI'dan admin kilitlerse 1 olacak)
    const isLocked = (req.user.role === 'admin' && req.body.is_locked) ? 1 : 0;
    
    upsert.run(personnel_id, n(date), n(status), n(overtime_hours) || 0, isLocked, req.user.role);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/admin/pointage/bulk-lock', authMiddleware, adminMiddleware, (req, res) => {
  const { personnel_id, year, month, lock_status } = req.body;
  if (!personnel_id || !year || !month) return res.status(400).json({ success: false, message: 'Eksik parametre (personnel_id, year veya month).' });
  
  try {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-31`;
    
    // SQLite: Bulk Update, and handle cases where no records exist if needed (Upsert not needed for bulk lock, usually)
    const result = db.prepare(`
      UPDATE pointage 
      SET is_locked = ? 
      WHERE personnel_id = ? AND date BETWEEN ? AND ?
    `).run(lock_status ? 1 : 0, personnel_id, startDate, endDate);
    
    res.json({ success: true, message: `Puantaj kayıtları ${lock_status ? 'kilitlendi' : 'kilidi açıldı'}. (${result.changes} gün güncellendi)` });
  } catch (error) { 
    console.error('BULK LOCK ERROR:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + error.message }); 
  }
});

app.post('/api/admin/pointage/bulk-lock-all', authMiddleware, adminMiddleware, (req, res) => {
  const { year, month, lock_status } = req.body;
  if (!year || !month) return res.status(400).json({ success: false, message: 'Eksik parametre (year veya month).' });
  
  try {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-31`;
    
    const result = db.prepare(`
      UPDATE pointage 
      SET is_locked = ? 
      WHERE date BETWEEN ? AND ?
    `).run(lock_status ? 1 : 0, startDate, endDate);
    
    res.json({ success: true, message: `Tüm personellerin puantaj kayıtları ${lock_status ? 'kilitlendi' : 'kilidi açıldı'}. (${result.changes} gün güncellendi)` });
  } catch (error) { 
    console.error('BULK LOCK ALL ERROR:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + error.message }); 
  }
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

// ============================================================
// --- YARDIMCI METOD ---
// JSON.stringify undefined değerleri yoksaydığı için, req.body'den gelen undefined'ları null'a çevirir
// SQLite TypeError fırlatmasını (Bind parameter is undefined) engeller.
const n = (val) => val === undefined ? null : val;

// ============================================================
// --- CARİLER ---
// ============================================================
app.get('/api/cariler', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM cariler ORDER BY olusturma_tarihi DESC').all();
    const mapped = list.map(r => ({ id: r.id, tip: r.tip, unvan: r.unvan, vknTckn: r.vkn_tckn, vergiDairesi: r.vergi_dairesi, adres: r.adres, telefon: r.telefon, eposta: r.eposta, olusturmaTarihi: r.olusturma_tarihi }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/cariler', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('INSERT INTO cariler (id,tip,unvan,vkn_tckn,vergi_dairesi,adres,telefon,eposta,olusturma_tarihi) VALUES (?,?,?,?,?,?,?,?,?)').run(n(f.id), n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), n(f.olusturmaTarihi));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/cariler/:id', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('UPDATE cariler SET tip=?,unvan=?,vkn_tckn=?,vergi_dairesi=?,adres=?,telefon=?,eposta=? WHERE id=?').run(n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/cariler/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM cariler WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.get('/api/cari-hareketler', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM cari_hareketler ORDER BY tarih DESC').all();
    const mapped = list.map(r => ({ 
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
app.post('/api/cari-hareketler', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('INSERT INTO cari_hareketler (id,cari_id,tarih,islem_turu,tutar,aciklama,bagli_fatura_id,banka_id,dekont_dosya,olusturma_tarihi,kategori_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(n(f.id), n(f.cariId), n(f.tarih), n(f.islemTuru), n(f.tutar), n(f.aciklama), n(f.bagliFaturaId), n(f.bankaId), n(f.dekontDosya), n(f.olusturmaTarihi), n(f.kategoriId));
    
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
         db.prepare('UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ?').run(degisim, f.bankaId);
       }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/cari-hareketler/:id', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('UPDATE cari_hareketler SET cari_id=?,tarih=?,islem_turu=?,tutar=?,aciklama=?,bagli_fatura_id=?,banka_id=?,dekont_dosya=?,kategori_id=? WHERE id=?').run(n(f.cariId), n(f.tarih), n(f.islemTuru), n(f.tutar), n(f.aciklama), n(f.bagliFaturaId), n(f.bankaId), n(f.dekontDosya), n(f.kategoriId), req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/cari-hareketler/:id', authMiddleware, (req, res) => {
  try { 
    const h = db.prepare('SELECT * FROM cari_hareketler WHERE id = ?').get(req.params.id);
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
         db.prepare('UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ?').run(degisim, h.banka_id);
       }
    }
    db.prepare('DELETE FROM cari_hareketler WHERE id=?').run(req.params.id); 
    res.json({ success: true }); 
  }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- SATIŞ FATURALARI ---
// ============================================================
app.get('/api/satis-faturalari', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM satis_faturalari ORDER BY olusturma_tarihi DESC').all();
    const mapped = list.map(r => ({ id: r.id, tcVkn: r.tc_vkn, ad: r.ad, soyad: r.soyad, adres: r.adres, kdvOrani: r.kdv_orani, alinanUcret: r.alinan_ucret, matrah: r.matrah, kdvTutari: r.kdv_tutari, tevkifatOrani: r.tevkifat_orani, tevkifatTutari: r.tevkifat_tutari, stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, pdfDosya: r.pdf_dosya, pdfDosyaAdi: r.pdf_dosya_adi, faturaTarihi: r.fatura_tarihi, odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, odemeDekontu: r.odeme_dekontu, odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, vadeTarihi: r.vade_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/satis-faturalari', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('INSERT INTO satis_faturalari (id,tc_vkn,ad,soyad,adres,kdv_orani,alinan_ucret,matrah,kdv_tutari,tevkifat_orani,tevkifat_tutari,stopaj_orani,stopaj_tutari,pdf_dosya,pdf_dosya_adi,fatura_tarihi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(n(f.id),n(f.tcVkn),n(f.ad),n(f.soyad),n(f.adres),n(f.kdvOrani),n(f.alinanUcret),n(f.matrah),n(f.kdvTutari),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.stopajOrani),n(f.stopajTutari),n(f.pdfDosya),n(f.pdfDosyaAdi),n(f.faturaTarihi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/satis-faturalari/:id', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('UPDATE satis_faturalari SET odeme_tarihi=?,odeme_durumu=?,odeme_dekontu=?,odeme_dekontu_adi=?,pdf_dosya=?,pdf_dosya_adi=? WHERE id=?').run(n(f.odemeTarihi),n(f.odemeDurumu),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.pdfDosya),n(f.pdfDosyaAdi),req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/satis-faturalari/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM satis_faturalari WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- ALIŞ FATURALARI ---
// ============================================================
app.get('/api/alis-faturalari', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM alis_faturalari ORDER BY olusturma_tarihi DESC').all();
    const mapped = list.map(r => ({ id: r.id, faturaNo: r.fatura_no, faturaTarihi: r.fatura_tarihi, tedarikciAdi: r.tedarikci_adi, tedarikciVkn: r.tedarikci_vkn, malHizmetAdi: r.mal_hizmet_adi, toplamTutar: r.toplam_tutar, kdvOrani: r.kdv_orani, kdvTutari: r.kdv_tutari, matrah: r.matrah, tevkifatOrani: r.tevkifat_orani, tevkifatTutari: r.tevkifat_tutari, stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, pdfDosya: r.pdf_dosya, pdfDosyaAdi: r.pdf_dosya_adi, odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, odemeDekontu: r.odeme_dekontu, odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, vadeTarihi: r.vade_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/alis-faturalari', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('INSERT INTO alis_faturalari (id,fatura_no,fatura_tarihi,tedarikci_adi,tedarikci_vkn,mal_hizmet_adi,toplam_tutar,kdv_orani,kdv_tutari,matrah,tevkifat_orani,tevkifat_tutari,stopaj_orani,stopaj_tutari,pdf_dosya,pdf_dosya_adi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(n(f.id),n(f.faturaNo),n(f.faturaTarihi),n(f.tedarikciAdi),n(f.tedarikciVkn),n(f.malHizmetAdi),n(f.toplamTutar),n(f.kdvOrani),n(f.kdvTutari),n(f.matrah),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.stopajOrani),n(f.stopajTutari),n(f.pdfDosya),n(f.pdfDosyaAdi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/alis-faturalari/:id', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('UPDATE alis_faturalari SET odeme_tarihi=?,odeme_durumu=?,odeme_dekontu=?,odeme_dekontu_adi=?,pdf_dosya=?,pdf_dosya_adi=? WHERE id=?').run(n(f.odemeTarihi),n(f.odemeDurumu),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.pdfDosya),n(f.pdfDosyaAdi),req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/alis-faturalari/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM alis_faturalari WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- CEK SENET, BANKA, KESILECEK ---
// ============================================================
app.get('/api/cek-senetler', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM cek_senetler ORDER BY vade_tarihi ASC').all();
    const mapped = list.map(r => ({ id: r.id, tip: r.tip, islemTipi: r.islem_tipi, cariId: r.cari_id, belgeNo: r.belge_no, tutar: r.tutar, vadeTarihi: r.vade_tarihi, verilisTarihi: r.verilis_tarihi, durum: r.durum, aciklama: r.aciklama }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/cek-senetler', authMiddleware, (req, res) => {
  const c = req.body;
  try {
    db.prepare('INSERT INTO cek_senetler (id,tip,islem_tipi,cari_id,belge_no,tutar,vade_tarihi,verilis_tarihi,durum,aciklama) VALUES (?,?,?,?,?,?,?,?,?,?)').run(n(c.id),n(c.tip),n(c.islemTipi),n(c.cariId),n(c.belgeNo),n(c.tutar),n(c.vadeTarihi),n(c.verilisTarihi),c.durum||'bekliyor',n(c.aciklama));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/cek-senetler/:id', authMiddleware, (req, res) => {
  const c = req.body;
  try {
    db.prepare('UPDATE cek_senetler SET tip=?,islem_tipi=?,cari_id=?,belge_no=?,tutar=?,vade_tarihi=?,verilis_tarihi=?,durum=?,aciklama=? WHERE id=?').run(n(c.tip),n(c.islemTipi),n(c.cariId),n(c.belgeNo),n(c.tutar),n(c.vadeTarihi),n(c.verilisTarihi),n(c.durum),n(c.aciklama),req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/cek-senetler/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM cek_senetler WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.get('/api/banka-hesaplari', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM banka_hesaplari').all();
    const mapped = list.map(r => ({ id: r.id, hesapAdi: r.hesap_adi, bankaAdi: r.banka_adi, iban: r.iban, hesapNo: r.hesap_no, kartNo: r.kart_no, dovizTuru: r.doviz_turu, guncelBakiye: r.guncel_bakiye }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/banka-hesaplari', authMiddleware, (req, res) => {
  const b = req.body;
  try {
    db.prepare('INSERT INTO banka_hesaplari (id,hesap_adi,banka_adi,iban,hesap_no,kart_no,doviz_turu,guncel_bakiye) VALUES (?,?,?,?,?,?,?,?)').run(n(b.id),n(b.hesapAdi),n(b.bankaAdi),n(b.iban),n(b.hesapNo),n(b.kartNo),n(b.dovizTuru)||'TRY',n(b.guncelBakiye)||0);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/banka-hesaplari/:id', authMiddleware, (req, res) => {
  const b = req.body;
  try {
    db.prepare('UPDATE banka_hesaplari SET hesap_adi=?,banka_adi=?,iban=?,hesap_no=?,kart_no=?,doviz_turu=?,guncel_bakiye=? WHERE id=?').run(n(b.hesapAdi),n(b.bankaAdi),n(b.iban),n(b.hesapNo),n(b.kartNo),n(b.dovizTuru),n(b.guncelBakiye),req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/banka-hesaplari/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM banka_hesaplari WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- MASRAF KURALLARI ---
// ============================================================
app.get('/api/masraf-kurallari', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM masraf_kurallari').all();
    const mapped = list.map(r => ({ id: r.id, anahtarKelime: r.anahtar_kelime, islemTuru: r.islem_turu, aciklama: r.aciklama }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/masraf-kurallari', authMiddleware, (req, res) => {
  const m = req.body;
  try {
    db.prepare('INSERT INTO masraf_kurallari (id,anahtar_kelime,islem_turu,aciklama) VALUES (?,?,?,?)').run(n(m.id),n(m.anahtarKelime),n(m.islemTuru),n(m.aciklama));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/masraf-kurallari/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM masraf_kurallari WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/kesilecek-faturalar', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM kesilecek_faturalar ORDER BY olusturma_tarihi DESC').all();
    const mapped = list.map(r => ({ id: r.id, ad: r.ad, soyad: r.soyad, vknTckn: r.vkn_tckn, vergiDairesi: r.vergi_dairesi, adres: r.adres, il: r.il, ilce: r.ilce, tutar: r.tutar, kdvDahil: !!r.kdv_dahil, kdvOrani: r.kdv_orani, faturaTarihi: r.fatura_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi, durum: r.durum, cariId: r.cari_id }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/kesilecek-faturalar', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('INSERT INTO kesilecek_faturalar (id,ad,soyad,vkn_tckn,vergi_dairesi,adres,il,ilce,tutar,kdv_dahil,kdv_orani,fatura_tarihi,aciklama,olusturma_tarihi,durum,cari_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(n(f.id),n(f.ad),n(f.soyad),n(f.vknTckn),n(f.vergiDairesi),n(f.adres),n(f.il),n(f.ilce),n(f.tutar),f.kdvDahil?1:0,n(f.kdvOrani),n(f.faturaTarihi),n(f.aciklama),n(f.olusturmaTarihi),n(f.durum)||'bekliyor',n(f.cariId));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/kesilecek-faturalar/:id', authMiddleware, (req, res) => {
  const f = req.body;
  try {
    db.prepare('UPDATE kesilecek_faturalar SET ad=?,soyad=?,vkn_tckn=?,vergi_dairesi=?,adres=?,il=?,ilce=?,tutar=?,kdv_dahil=?,kdv_orani=?,fatura_tarihi=?,aciklama=?,durum=?,cari_id=? WHERE id=?').run(n(f.ad),n(f.soyad),n(f.vknTckn),n(f.vergiDairesi),n(f.adres),n(f.il),n(f.ilce),n(f.tutar),f.kdvDahil?1:0,n(f.kdvOrani),n(f.faturaTarihi),n(f.aciklama),n(f.durum),n(f.cariId),req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/kesilecek-faturalar/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM kesilecek_faturalar WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ============================================================
// --- GİDER KATEGORİLERİ ---
// ============================================================
app.get('/api/gider-kategorileri', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM gider_kategorileri ORDER BY ad ASC').all();
    res.json({ success: true, data: list });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/gider-kategorileri', authMiddleware, (req, res) => {
  const k = req.body;
  try {
    db.prepare('INSERT INTO gider_kategorileri (id, ad) VALUES (?, ?)').run(n(k.id), n(k.ad));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/gider-kategorileri/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM gider_kategorileri WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
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
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;