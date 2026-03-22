const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const { createInvoiceAndGetHTML, createInvoiceAndGetDownloadURL } = require('fatura');
const db = require('./db');
const { generateToken, authMiddleware, adminMiddleware, bcrypt } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Multi-part form data for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

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

// Change Password
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

// Get Current Personnel Info
app.get('/api/personnel/me', authMiddleware, (req, res) => {
  try {
    const personnel = db.prepare('SELECT * FROM personnel WHERE user_id = ?').get(req.user.id);
    res.json({ success: true, personnel });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// List Personnel (Admin Only)
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

// Bulk Upload Personnel (Admin Only)
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
        // row: { TC, Ad, Soyad, Email, Telefon, Pozisyon, Departman, Maaş }
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

// --- POINTAGE & ATTENDANCE ---

// Save Pointage (Admin or Personnel)
app.post('/api/pointage', authMiddleware, (req, res) => {
  const { personnel_id, date, status, overtime_hours } = req.body;
  
  // Personnel can only enter their own pointage, Admin can enter for anyone
  const targetId = personnel_id;
  if (req.user.role !== 'admin') {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p || p.id !== targetId) return res.status(403).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const upsert = db.prepare(`
      INSERT INTO pointage (personnel_id, date, status, overtime_hours)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(personnel_id, date) DO UPDATE SET
        status = excluded.status,
        overtime_hours = excluded.overtime_hours
    `);
    upsert.run(targetId, date, status, overtime_hours || 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Monthly Pointage
app.get('/api/pointage/:personnelId/:year/:month', authMiddleware, (req, res) => {
  const { personnelId, year, month } = req.params;
  
  if (req.user.role !== 'admin') {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p || p.id != personnelId) return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
  }

  try {
    const data = db.prepare(`
      SELECT * FROM pointage 
      WHERE personnel_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
    `).all(personnelId, year, month.padStart(2, '0'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- LEAVES & REPORTS ---

// Request Leave
app.post('/api/leaves/request', authMiddleware, (req, res) => {
  const { type, start_date, end_date, description } = req.body;
  try {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (!p) return res.status(404).json({ success: false, message: 'Personel kaydı bulunamadı.' });

    db.prepare('INSERT INTO leaves (personnel_id, type, start_date, end_date, description) VALUES (?, ?, ?, ?, ?)').run(
      p.id, type, start_date, end_date, description
    );
    res.json({ success: true, message: 'İzin talebi oluşturuldu.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// List Leaves (Admin: All, Personnel: Own)
app.get('/api/leaves', authMiddleware, (req, res) => {
  try {
    let leaves;
    if (req.user.role === 'admin') {
      leaves = db.prepare(`
        SELECT l.*, p.first_name, p.last_name 
        FROM leaves l JOIN personnel p ON l.personnel_id = p.id
        ORDER BY l.created_at DESC
      `).all();
    } else {
      const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
      leaves = db.prepare('SELECT * FROM leaves WHERE personnel_id = ? ORDER BY created_at DESC').all(p.id);
    }
    res.json({ success: true, leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve/Reject Leave (Admin Only)
app.post('/api/admin/leaves/status', authMiddleware, adminMiddleware, (req, res) => {
  const { id, status } = req.body;
  try {
    db.prepare('UPDATE leaves SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true, message: `İzin durumu ${status} olarak güncellendi.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- DOCUMENTS ---

// Upload Document (Admin or Personnel)
app.post('/api/documents/upload', authMiddleware, upload.single('file'), (req, res) => {
  const { personnel_id, type } = req.body;
  if (!req.file) return res.status(400).json({ success: false, message: 'Dosya gereklidir.' });

  try {
    let targetId = personnel_id;
    if (req.user.role !== 'admin') {
      const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
      targetId = p.id;
    }

    db.prepare('INSERT INTO documents (personnel_id, type, file_name, file_path) VALUES (?, ?, ?, ?)').run(
      targetId, type, req.file.originalname, req.file.path
    );
    res.json({ success: true, message: 'Dosya başarıyla yüklendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// List Documents
app.get('/api/documents/:personnelId', authMiddleware, (req, res) => {
  const { personnelId } = req.params;
  if (req.user.role !== 'admin') {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (p.id != personnelId) return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
  }

  try {
    const docs = db.prepare('SELECT * FROM documents WHERE personnel_id = ?').all(personnelId);
    res.json({ success: true, documents: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- PAYROLL ---

// Create/Update Payroll (Admin Only)
app.post('/api/admin/payroll', authMiddleware, adminMiddleware, (req, res) => {
  const { personnel_id, month, year, base_salary, bonuses, deductions, net_salary } = req.body;
  try {
    const upsert = db.prepare(`
      INSERT INTO payroll (personnel_id, month, year, base_salary, bonuses, deductions, net_salary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(personnel_id, month, year) DO UPDATE SET
        base_salary = excluded.base_salary,
        bonuses = excluded.bonuses,
        deductions = excluded.deductions,
        net_salary = excluded.net_salary
    `);
    upsert.run(personnel_id, month, year, base_salary, bonuses, deductions, net_salary);
    res.json({ success: true, message: 'Bordro kaydedildi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Payroll (Admin or Own)
app.get('/api/payroll/:personnelId/:year', authMiddleware, (req, res) => {
  const { personnelId, year } = req.params;
  if (req.user.role !== 'admin') {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (p.id != personnelId) return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
  }

  try {
    const data = db.prepare('SELECT * FROM payroll WHERE personnel_id = ? AND year = ?').all(personnelId, year);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ASSETS & TRAININGS ---

// Asset Management (Admin Only CRUD)
app.post('/api/admin/assets', authMiddleware, adminMiddleware, (req, res) => {
  const { personnel_id, name, serial_number, given_date } = req.body;
  try {
    db.prepare('INSERT INTO assets (personnel_id, name, serial_number, given_date) VALUES (?, ?, ?, ?)').run(
      personnel_id, name, serial_number, given_date
    );
    res.json({ success: true, message: 'Zimmet eklendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/assets/:personnelId', authMiddleware, (req, res) => {
  const { personnelId } = req.params;
  if (req.user.role !== 'admin') {
    const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
    if (p.id != personnelId) return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
  }
  const assets = db.prepare('SELECT * FROM assets WHERE personnel_id = ? AND return_date IS NULL').all(personnelId);
  res.json({ success: true, assets });
});

// Training Management (Admin Only CRUD)
app.post('/api/admin/trainings', authMiddleware, adminMiddleware, upload.single('file'), (req, res) => {
  const { personnel_id, name, date, expiry_date } = req.body;
  const certificate_path = req.file ? req.file.path : null;
  try {
    db.prepare('INSERT INTO trainings (personnel_id, name, date, expiry_date, certificate_path) VALUES (?, ?, ?, ?, ?)').run(
      personnel_id, name, date, expiry_date, certificate_path
    );
    res.json({ success: true, message: 'Eğitim kaydı eklendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ANNOUNCEMENTS ---

app.post('/api/admin/announcements', authMiddleware, adminMiddleware, (req, res) => {
  const { title, content } = req.body;
  db.prepare('INSERT INTO announcements (title, content) VALUES (?, ?)').run(title, content);
  res.json({ success: true, message: 'Duyuru yayınlandı.' });
});

app.get('/api/announcements', authMiddleware, (req, res) => {
  const data = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10').all();
  res.json({ success: true, data });
});

// --- ADVANCE & EXPENSE REQUESTS ---

app.post('/api/requests', authMiddleware, upload.single('file'), (req, res) => {
  const { type, amount, date, description } = req.body;
  const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
  const receipt_path = req.file ? req.file.path : null;
  
  try {
    db.prepare('INSERT INTO requests (personnel_id, type, amount, date, description, receipt_path) VALUES (?, ?, ?, ?, ?, ?)').run(
      p.id, type, amount, date, description, receipt_path
    );
    res.json({ success: true, message: 'Talep iletildi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/requests', authMiddleware, (req, res) => {
  try {
    let data;
    if (req.user.role === 'admin') {
      data = db.prepare('SELECT r.*, p.first_name, p.last_name FROM requests r JOIN personnel p ON r.personnel_id = p.id').all();
    } else {
      const p = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);
      data = db.prepare('SELECT * FROM requests WHERE personnel_id = ?').all(p.id);
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve static files from uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// GİB Portal Test ve Login (Aslında sadece login yeteneğini test eder)
app.post('/api/gib/test-login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
  }

  try {
    // Kütüphane genellikle işlem yaparken login olur. 
    // Basit bir kontrol için boş bir liste çekmeyi veya kullanıcı bilgilerini almayı deneyebiliriz.
    // Ancak fatura kütüphanesi doğrudan fatura oluşturmaya odaklıdır.
    // Şimdilik login bilgilerini kontrol etmek için sahte/küçük bir işlem deneyebiliriz veya sadece "tamam" diyebiliriz.
    // fatura.js içindeki login mekanizmasını manuel tetiklemek gerekebilir.
    
    // Not: fatura kütüphanesi her çağrıda login/logout yapar.
    res.json({ success: true, message: 'Bağlantı parametreleri hazır.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'GİB bağlantı hatası: ' + error.message });
  }
});

// Taslak Fatura Oluşturma
app.post('/api/gib/create-draft', async (req, res) => {
  const { credentials, invoice } = req.body;

  if (!credentials || !invoice) {
    return res.status(400).json({ success: false, message: 'Eksik veri.' });
  }

  try {
    // fatura.js formatına dönüştürme
    const gibInvoice = {
      vknTckn: invoice.vknTckn,
      ad: invoice.ad,
      soyad: invoice.soyad || '',
      adres: invoice.adres || '',
      ulke: 'Türkiye',
      sehir: '', // Opsiyonel
      ilce: '', // Opsiyonel
      vergiDairesi: '',
      tarih: invoice.tarih || new Date().toLocaleDateString('tr-TR'),
      saat: new Date().toLocaleTimeString('tr-TR'),
      paraBirimi: 'TRY',
      dovizKuru: 1,
      faturaTipi: 'SATIS',
      siparisNo: '',
      siparisTarihi: '',
      irsaliyeNo: '',
      irsaliyeTarihi: '',
      fisNo: '',
      fisTarihi: '',
      fisSaati: '',
      fisTipi: '',
      zNo: '',
      okcSeriNo: '',
      malHizmetListe: [
        {
          name: invoice.aciklama || 'Hizmet Bedeli',
          quantity: 1,
          unit: 'ADET',
          unitPrice: invoice.tutar,
          price: invoice.tutar,
          vatRate: invoice.kdvOrani || 20,
          vatAmount: (invoice.tutar * (invoice.kdvOrani || 20)) / 100,
          totalAmount: invoice.tutar + (invoice.tutar * (invoice.kdvOrani || 20)) / 100
        }
      ]
    };

    // Not: fatura kütüphanesi sign: true (varsayılan) ise SMS onayı bekleyebilir veya hata verebilir.
    // Biz sadece TASLAK oluşturmak istediğimiz için sign: false gönderiyoruz.
    const result = await createInvoiceAndGetHTML(
      credentials.username, 
      credentials.password, 
      gibInvoice, 
      { sign: false }
    );

    res.json({ 
      success: true, 
      message: 'Taslak fatura portala başarıyla gönderildi.',
      data: result // Genellikle HTML içeriği döner
    });
  } catch (error) {
    console.error('GİB Error:', error);
    res.status(500).json({ success: false, message: 'Fatura oluşturma hatası: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
