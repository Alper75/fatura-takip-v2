import express from 'express';
import xlsx from 'xlsx';
import { client } from '../db.js';
import { authMiddleware, adminMiddleware, bcrypt } from '../auth.js';
import { upload, n } from '../utils/shared.js';

const router = express.Router();

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

router.get('/api/admin/personnel', authMiddleware, adminMiddleware, async (req, res) => {
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

router.post('/api/admin/personnel', authMiddleware, adminMiddleware, async (req, res) => {
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
        Number(userResult.lastInsertRowid), n(first_name), n(last_name), n(email), n(phone), 
        n(position), n(department), n(salary), calculatedLeave, 'Active', 
        n(start_date), n(end_date), puantaj_menu_active ? 1 : 0, req.user.companyId
      ]
    });
    res.json({ success: true, message: 'Personel başarıyla oluşturuldu.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/api/admin/personnel/bulk-upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
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
router.delete('/api/admin/personnel/:id', authMiddleware, adminMiddleware, async (req, res) => {
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
router.put('/api/admin/personnel/:id', authMiddleware, adminMiddleware, async (req, res) => {
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
router.get('/api/admin/leaves', authMiddleware, adminMiddleware, async (req, res) => {
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

router.post('/api/personnel/leaves', authMiddleware, upload.single('document'), async (req, res) => {
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

router.put('/api/admin/leaves/:id', authMiddleware, adminMiddleware, async (req, res) => {
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
router.get('/api/admin/requests', authMiddleware, adminMiddleware, async (req, res) => {
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

router.post('/api/personnel/requests', authMiddleware, upload.single('receipt'), async (req, res) => {
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

router.put('/api/admin/requests/:id', authMiddleware, adminMiddleware, async (req, res) => {
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
router.get('/api/personnel/leaves', authMiddleware, async (req, res) => {
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

router.get('/api/personnel/requests', authMiddleware, async (req, res) => {
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

router.get('/api/personnel/pointage', authMiddleware, async (req, res) => {
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

router.post('/api/pointage', authMiddleware, async (req, res) => {
  let { personnel_id, date, status, overtime_hours } = req.body;
  try {
    // Eğer personel kendisi giriyorsa, personnel_id'yi kendi id'si yap
    if (req.user.role === 'personnel') {
      const rsP = await client.execute({
        sql: 'SELECT id FROM personnel WHERE user_id = ? AND company_id = ?',
        args: [req.user.id, req.user.companyId]
      });
      if (!rsP.rows[0]) {
        return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });
      }
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

router.post('/api/admin/pointage/bulk-lock', authMiddleware, adminMiddleware, async (req, res) => {
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

router.post('/api/admin/pointage/bulk-lock-all', authMiddleware, adminMiddleware, async (req, res) => {
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

router.get('/api/announcements', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM announcements WHERE company_id = ? ORDER BY created_at DESC LIMIT 10',
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/api/admin/pointage', authMiddleware, adminMiddleware, async (req, res) => {
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

router.get('/api/admin/pointage/template', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: "SELECT id, first_name, last_name FROM personnel WHERE status = 'Active' AND company_id = ?",
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/api/admin/pointage/bulk-upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
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
// --- CARİLER ---
// ============================================================

export default router;
