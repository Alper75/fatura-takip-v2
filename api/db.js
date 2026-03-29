const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Vercel environment check - /tmp is the only writable directory
const isVercel = process.env.VERCEL;
const dbDir = isVercel ? '/tmp' : __dirname;
const dbPath = path.resolve(dbDir, 'personnel.db');

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error('SQLITE INIT ERROR:', err);
  throw err; // Re-throw to be caught by index.js
}

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tc TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'personnel')) NOT NULL DEFAULT 'personnel',
    must_change_password BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    start_date DATE,
    end_date DATE,
    position TEXT,
    department TEXT,
    iban TEXT,
    salary REAL,
    annual_leave_days INTEGER DEFAULT 14,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS pointage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    overtime_hours REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(personnel_id, date),
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'PENDING',
    description TEXT,
    document_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );
`);

try {
  db.exec(`ALTER TABLE leaves ADD COLUMN document_path TEXT;`);
} catch (e) {
  // column might already exist, ignore
}

db.exec(`

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    serial_number TEXT,
    given_date DATE,
    return_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trainings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    date DATE,
    expiry_date DATE,
    certificate_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    base_salary REAL,
    bonuses REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_salary REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(personnel_id, month, year),
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    date DATE NOT NULL,
    status TEXT DEFAULT 'PENDING',
    description TEXT,
    receipt_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cariler (
    id TEXT PRIMARY KEY,
    tip TEXT NOT NULL,
    unvan TEXT NOT NULL,
    vkn_tckn TEXT,
    vergi_dairesi TEXT,
    adres TEXT,
    telefon TEXT,
    eposta TEXT,
    olusturma_tarihi TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cari_hareketler (
    id TEXT PRIMARY KEY,
    cari_id TEXT NOT NULL,
    tarih TEXT NOT NULL,
    islem_turu TEXT NOT NULL,
    tutar REAL NOT NULL,
    aciklama TEXT,
    bagli_fatura_id TEXT,
    banka_id TEXT,
    dekont_dosya TEXT,
    olusturma_tarihi TEXT NOT NULL,
    FOREIGN KEY (cari_id) REFERENCES cariler(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS satis_faturalari (
    id TEXT PRIMARY KEY,
    tc_vkn TEXT,
    ad TEXT,
    soyad TEXT,
    adres TEXT,
    kdv_orani REAL,
    alinan_ucret REAL,
    matrah REAL,
    kdv_tutari REAL,
    tevkifat_orani TEXT,
    tevkifat_tutari REAL,
    stopaj_orani TEXT,
    stopaj_tutari REAL,
    pdf_dosya TEXT,
    pdf_dosya_adi TEXT,
    fatura_tarihi TEXT,
    odeme_tarihi TEXT,
    odeme_durumu TEXT DEFAULT 'odenmedi',
    odeme_dekontu TEXT,
    odeme_dekontu_adi TEXT,
    cari_id TEXT,
    vade_tarihi TEXT,
    aciklama TEXT,
    olusturma_tarihi TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alis_faturalari (
    id TEXT PRIMARY KEY,
    fatura_no TEXT,
    fatura_tarihi TEXT,
    tedarikci_adi TEXT,
    tedarikci_vkn TEXT,
    mal_hizmet_adi TEXT,
    toplam_tutar REAL,
    kdv_orani REAL,
    kdv_tutari REAL,
    matrah REAL,
    tevkifat_orani TEXT,
    tevkifat_tutari REAL,
    stopaj_orani TEXT,
    stopaj_tutari REAL,
    pdf_dosya TEXT,
    pdf_dosya_adi TEXT,
    odeme_tarihi TEXT,
    odeme_durumu TEXT DEFAULT 'odenmedi',
    odeme_dekontu TEXT,
    odeme_dekontu_adi TEXT,
    cari_id TEXT,
    vade_tarihi TEXT,
    aciklama TEXT,
    olusturma_tarihi TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cek_senetler (
    id TEXT PRIMARY KEY,
    tip TEXT NOT NULL,
    islem_tipi TEXT NOT NULL,
    cari_id TEXT,
    belge_no TEXT,
    tutar REAL,
    vade_tarihi TEXT,
    verilis_tarihi TEXT,
    durum TEXT DEFAULT 'bekliyor',
    aciklama TEXT
  );

  CREATE TABLE IF NOT EXISTS banka_hesaplari (
    id TEXT PRIMARY KEY,
    hesap_adi TEXT NOT NULL,
    banka_adi TEXT NOT NULL,
    iban TEXT,
    hesap_no TEXT,
    kart_no TEXT,
    doviz_turu TEXT DEFAULT 'TRY',
    guncel_bakiye REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS masraf_kurallari (
    id TEXT PRIMARY KEY,
    anahtar_kelime TEXT NOT NULL,
    islem_turu TEXT NOT NULL,
    aciklama TEXT
  );

  CREATE TABLE IF NOT EXISTS kesilecek_faturalar (
    id TEXT PRIMARY KEY,
    ad TEXT NOT NULL,
    soyad TEXT,
    vkn_tckn TEXT,
    vergi_dairesi TEXT,
    adres TEXT,
    il TEXT,
    ilce TEXT,
    tutar REAL,
    kdv_dahil INTEGER DEFAULT 1,
    kdv_orani REAL,
    fatura_tarihi TEXT,
    aciklama TEXT,
    olusturma_tarihi TEXT NOT NULL,
    durum TEXT DEFAULT 'bekliyor',
    cari_id TEXT
  );

  CREATE TABLE IF NOT EXISTS gider_kategorileri (
    id TEXT PRIMARY KEY,
    ad TEXT NOT NULL
  );
`);

// Add kategori_id column to cari_hareketler if not exists (Migration)
try {
  db.exec("ALTER TABLE cari_hareketler ADD COLUMN kategori_id TEXT");
} catch (e) {}

// Add status column to personnel if not exists (Migration)
try {
  db.exec("ALTER TABLE personnel ADD COLUMN status TEXT DEFAULT 'Active'");
} catch (e) {}

try {
  db.exec("ALTER TABLE personnel ADD COLUMN end_date DATE");
} catch (e) {}

try {
  db.exec("ALTER TABLE personnel ADD COLUMN puantaj_menu_active BOOLEAN DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE pointage ADD COLUMN is_locked BOOLEAN DEFAULT 0");
} catch (e) {}

// Create uploads directory if it doesn't exist (Only if not on Vercel or use /tmp)
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initial admin user if not exists
const adminCount = db.prepare("SELECT count(*) as count FROM users WHERE role = ?").get('admin').count;
if (adminCount === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (tc, password, role, must_change_password) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, 'admin', 0);
  console.log('Default admin user created: admin / admin123');
}

// Initial default categories
try {
  const categories = [
    {id: 'cat_genel', ad: 'Genel Gider'},
    {id: 'cat_kira', ad: 'Kira Ödemesi'},
    {id: 'cat_maas', ad: 'Maaş Ödemesi'},
    {id: 'cat_vergi', ad: 'Vergi Ödemeleri'},
    {id: 'cat_banka', ad: 'Banka Masrafı'},
    {id: 'cat_ssk', ad: 'SSK/Bağkur Ödemesi'},
    {id: 'cat_yemek', ad: 'Yemek/Mutfak'},
    {id: 'cat_ulasim', ad: 'Ulaşım/Akaryakıt'}
  ];
  const insertCat = db.prepare("INSERT OR IGNORE INTO gider_kategorileri (id, ad) VALUES (?, ?)");
  categories.forEach(c => insertCat.run(c.id, c.ad));
} catch(e) { console.error('Error inserting default categories', e); }

// Add default cariler for system expenses/transfers
try {
  db.prepare("INSERT OR IGNORE INTO cariler (id, tip, unvan, vkn_tckn, vergi_dairesi, adres, telefon, eposta, olusturma_tarihi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run('', 'sistem', 'Genel Gider (Sistem)', '', '', '', '', '', '2025-01-01');
  db.prepare("INSERT OR IGNORE INTO cariler (id, tip, unvan, vkn_tckn, vergi_dairesi, adres, telefon, eposta, olusturma_tarihi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run('sistem', 'sistem', 'Sistem (Banka vs)', '', '', '', '', '', '2025-01-01');
  db.prepare("INSERT OR IGNORE INTO cariler (id, tip, unvan, vkn_tckn, vergi_dairesi, adres, telefon, eposta, olusturma_tarihi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run('genel-cari', 'sistem', 'Genel Cari', '', '', '', '', '', '2025-01-01');
} catch(e) { console.error('Error inserting default caris', e); }

module.exports = db;
