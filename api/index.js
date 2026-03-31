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

const { client, initDb } = require('./db');
const { generateToken, authMiddleware, adminMiddleware, bcrypt } = require('./auth');

// Initialize Database Asynchronously
initDb().catch(err => console.error('DATABASE INIT ERROR:', err));

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Global Error Catch for Startup Failures
app.use((req, res, next) => {
  if (!client) {
    return res.status(500).json({ 
      success: false, 
      message: 'Database initialization failed. Turso client is not ready.',
      error: process.env.NODE_ENV === 'development' ? 'Client was null' : undefined
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
    const rs = await client.execute({
      sql: 'SELECT * FROM users WHERE tc = ?',
      args: [tc]
    });
    const user = rs.rows[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Geçersiz TC veya şifre.' });
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
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
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
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
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
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
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
const n = (val) => val === undefined ? null : val;

// ============================================================
// --- CARİLER ---
// ============================================================
app.get('/api/cariler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cariler WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, tip: r.tip, unvan: r.unvan, vknTckn: r.vkn_tckn, vergiDairesi: r.vergi_dairesi, adres: r.adres, telefon: r.telefon, eposta: r.eposta, olusturmaTarihi: r.olusturma_tarihi }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/cariler', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO cariler (id,tip,unvan,vkn_tckn,vergi_dairesi,adres,telefon,eposta,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id), n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), n(f.olusturmaTarihi), req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/cariler/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE cariler SET tip=?,unvan=?,vkn_tckn=?,vergi_dairesi=?,adres=?,telefon=?,eposta=? WHERE id=? AND company_id = ?',
      args: [n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), req.params.id, req.user.companyId]
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
    const rs = await client.execute('SELECT * FROM satis_faturalari ORDER BY olusturma_tarihi DESC');
    const mapped = rs.rows.map(r => ({ id: r.id, tcVkn: r.tc_vkn, ad: r.ad, soyad: r.soyad, adres: r.adres, kdvOrani: r.kdv_orani, alinanUcret: r.alinan_ucret, matrah: r.matrah, kdvTutari: r.kdv_tutari, tevkifatOrani: r.tevkifat_orani, tevkifatTutari: r.tevkifat_tutari, stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, pdfDosya: r.pdf_dosya, pdfDosyaAdi: r.pdf_dosya_adi, faturaTarihi: r.fatura_tarihi, odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, odemeDekontu: r.odeme_dekontu, odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, vadeTarihi: r.vade_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/satis-faturalari', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO satis_faturalari (id,tc_vkn,ad,soyad,adres,kdv_orani,alinan_ucret,matrah,kdv_tutari,tevkifat_orani,tevkifat_tutari,stopaj_orani,stopaj_tutari,pdf_dosya,pdf_dosya_adi,fatura_tarihi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.tcVkn),n(f.ad),n(f.soyad),n(f.adres),n(f.kdvOrani),n(f.alinanUcret),n(f.matrah),n(f.kdvTutari),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.stopajOrani),n(f.stopajTutari),n(f.pdfDosya),n(f.pdfDosyaAdi),n(f.faturaTarihi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi)]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/satis-faturalari/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE satis_faturalari SET odeme_tarihi=?,odeme_durumu=?,odeme_dekontu=?,odeme_dekontu_adi=?,pdf_dosya=?,pdf_dosya_adi=? WHERE id=? AND company_id = ?',
      args: [n(f.odemeTarihi),n(f.odemeDurumu),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.pdfDosya),n(f.pdfDosyaAdi),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/satis-faturalari/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM satis_faturalari WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
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
    const mapped = rs.rows.map(r => ({ id: r.id, faturaNo: r.fatura_no, faturaTarihi: r.fatura_tarihi, tedarikciAdi: r.tedarikci_adi, tedarikciVkn: r.tedarikci_vkn, malHizmetAdi: r.mal_hizmet_adi, toplamTutar: r.toplam_tutar, kdvOrani: r.kdv_orani, kdvTutari: r.kdv_tutari, matrah: r.matrah, tevkifatOrani: r.tevkifat_orani, tevkifatTutari: r.tevkifat_tutari, stopajOrani: r.stopaj_orani, stopajTutari: r.stopaj_tutari, pdfDosya: r.pdf_dosya, pdfDosyaAdi: r.pdf_dosya_adi, odemeTarihi: r.odeme_tarihi, odemeDurumu: r.odeme_durumu, odemeDekontu: r.odeme_dekontu, odemeDekontuAdi: r.odeme_dekontu_adi, cariId: r.cari_id, vadeTarihi: r.vade_tarihi, aciklama: r.aciklama, olusturmaTarihi: r.olusturma_tarihi }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/alis-faturalari', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO alis_faturalari (id,fatura_no,fatura_tarihi,tedarikci_adi,tedarikci_vkn,mal_hizmet_adi,toplam_tutar,kdv_orani,kdv_tutari,matrah,tevkifat_orani,tevkifat_tutari,stopaj_orani,stopaj_tutari,pdf_dosya,pdf_dosya_adi,odeme_tarihi,odeme_durumu,odeme_dekontu,odeme_dekontu_adi,cari_id,vade_tarihi,aciklama,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.faturaNo),n(f.faturaTarihi),n(f.tedarikciAdi),n(f.tedarikciVkn),n(f.malHizmetAdi),n(f.toplamTutar),n(f.kdvOrani),n(f.kdvTutari),n(f.matrah),n(f.tevkifatOrani),n(f.tevkifatTutari),n(f.stopajOrani),n(f.stopajTutari),n(f.pdfDosya),n(f.pdfDosyaAdi),n(f.odemeTarihi),n(f.odemeDurumu||'odenmedi'),n(f.odemeDekontu),n(f.odemeDekontuAdi),n(f.cariId),n(f.vadeTarihi),n(f.aciklama),n(f.olusturmaTarihi),req.user.companyId]
    });
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
    await client.execute({
      sql: 'DELETE FROM alis_faturalari WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
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
app.get('/api/super/companies', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute('SELECT * FROM companies ORDER BY name ASC');
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/super/companies', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, tax_no, address, email } = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO companies (name, tax_no, address, email) VALUES (?, ?, ?, ?)',
      args: [n(name), n(tax_no), n(address), n(email)]
    });
    res.json({ success: true, message: 'Şirket başarıyla oluşturuldu.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/super/companies/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, tax_no, address, email } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE companies SET name = ?, tax_no = ?, address = ?, email = ? WHERE id = ?',
      args: [n(name), n(tax_no), n(address), n(email), id]
    });
    res.json({ success: true, message: 'Şirket güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.delete('/api/super/companies/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  if (id === '1') return res.status(400).json({ success: false, message: 'Varsayılan şirket silinemez.' });
  try {
    await client.execute({
      sql: 'DELETE FROM companies WHERE id = ?',
      args: [id]
    });
    res.json({ success: true, message: 'Şirket silindi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
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