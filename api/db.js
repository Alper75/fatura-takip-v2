const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let client;
if (url) {
  client = createClient({
    url: url,
    authToken: authToken,
  });
} else {
  console.error('CRITICAL: TURSO_URL is not defined in environment variables.');
  // We don't throw here to prevent top-level crash on Vercel
  client = null; 
}

// Since Turso is async, we export the client and a utility to run the initial schema setup
async function initDb() {
  console.log('Initializing Turso Database Schema...');
  
  try {
    // Users Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tc TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'personnel', 'super_admin')) NOT NULL DEFAULT 'personnel',
        must_change_password BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Personnel Table
    await client.execute(`
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
        puantaj_menu_active BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Pointage Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS pointage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnel_id INTEGER NOT NULL,
        date DATE NOT NULL,
        status TEXT NOT NULL,
        overtime_hours REAL DEFAULT 0,
        is_locked BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(personnel_id, date),
        FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
      );
    `);

    // Leaves Table
    await client.execute(`
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

    // Documents Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnel_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
      );
    `);

    // Assets Table
    await client.execute(`
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
    `);

    // Trainings Table
    await client.execute(`
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
    `);

    // Payroll Table
    await client.execute(`
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
    `);

    // Requests Table
    await client.execute(`
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
    `);

    // Announcements Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Cariler Table
    await client.execute(`
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
    `);

    // Cari Hareketler Table
    await client.execute(`
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
        kategori_id TEXT,
        olusturma_tarihi TEXT NOT NULL,
        FOREIGN KEY (cari_id) REFERENCES cariler(id) ON DELETE CASCADE
      );
    `);

    // Satis Faturalari Table
    await client.execute(`
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
    `);

    // Alis Faturalari Table
    await client.execute(`
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
        fatura_tarihi_raw TEXT,
        odeme_tarihi TEXT,
        odeme_durumu TEXT DEFAULT 'odenmedi',
        odeme_dekontu TEXT,
        odeme_dekontu_adi TEXT,
        cari_id TEXT,
        vade_tarihi TEXT,
        aciklama TEXT,
        olusturma_tarihi TEXT NOT NULL
      );
    `);

    // Cek Senetler Table
    await client.execute(`
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
    `);

    // Banka Hesaplari Table
    await client.execute(`
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
    `);

    // Masraf Kurallari Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS masraf_kurallari (
        id TEXT PRIMARY KEY,
        anahtar_kelime TEXT NOT NULL,
        islem_turu TEXT NOT NULL,
        aciklama TEXT
      );
    `);

    // Kesilecek Faturalar Table
    await client.execute(`
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
    `);

    // Gider Kategorileri Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS gider_kategorileri (
        id TEXT PRIMARY KEY,
        ad TEXT NOT NULL
      );
    `);

    // Companies Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tax_no TEXT,
        address TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure Default Company exists
    const compCheck = await client.execute('SELECT COUNT(*) as count FROM companies');
    if (Number(compCheck.rows[0].count) === 0) {
        console.log('Creating default company...');
        await client.execute({
            sql: 'INSERT INTO companies (id, name, status) VALUES (?, ?, ?)',
            args: [1, 'Varsayılan Şirket', 'active']
        });
    }

    // Check for status column in companies
    try {
        const compInfo = await client.execute('PRAGMA table_info(companies)');
        const hasStatus = compInfo.rows.some(col => col.name === 'status');
        if (!hasStatus) {
            console.log('Adding status column to companies...');
            await client.execute("ALTER TABLE companies ADD COLUMN status TEXT DEFAULT 'active'");
        }
    } catch (e) {
        console.warn(`Could not add status to companies: ${e.message}`);
    }

    // Add company_id to all tables if not exists
    const tablesToUpdate = [
      'users', 'personnel', 'pointage', 'leaves', 'documents', 
      'assets', 'trainings', 'payroll', 'requests', 'announcements', 
      'cariler', 'cari_hareketler', 'satis_faturalari', 'alis_faturalari', 
      'cek_senetler', 'banka_hesaplari', 'masraf_kurallari', 
      'kesilecek_faturalar', 'gider_kategorileri'
    ];

    for (const table of tablesToUpdate) {
        try {
          // Check if company_id already exists to avoid errors
          const info = await client.execute(`PRAGMA table_info(${table})`);
          const hasCompanyId = info.rows.some(col => col.name === 'company_id');
          if (!hasCompanyId) {
            console.log(`Adding company_id to ${table}...`);
            await client.execute(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER DEFAULT 1`);
          }
        } catch (e) {
          console.warn(`Could not add company_id to ${table}: ${e.message}`);
        }
    }

    console.log('Turso Database schema initialized successfully.');

    // Add default admin user if not exists
    const bcrypt = require('bcryptjs');
    const rs = await client.execute('SELECT COUNT(*) as count FROM users');
    if (Number(rs.rows[0].count) === 0) {
        console.log('No users found. Creating default admin...');
        const adminPassword = bcrypt.hashSync('admin', 10);
        await client.execute({
            sql: 'INSERT INTO users (tc, password, role, must_change_password, company_id) VALUES (?, ?, ?, ?, ?)',
            args: ['admin', adminPassword, 'admin', 0, 1]
        });
        console.log('Default admin created (TC: admin, PW: admin).');
    }
  } catch (err) {
    console.error('Error initializing Turso schema:', err);
    throw err;
  }
}

module.exports = { client, initDb };
