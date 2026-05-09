import { createClient } from '@libsql/client';
import 'dotenv/config';
import bcrypt from 'bcryptjs';

const url = process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = url ? createClient({
  url: url,
  authToken: authToken,
}) : null;

export async function initDb() {
  console.log('Initializing Turso Database Schema...');
  
  if (!client) {
    console.error('Cannot initialize database: client is null.');
    return;
  }

  try {
    // Şirketler (Companies)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tax_no TEXT,
        address TEXT,
        email TEXT,
        company_type TEXT DEFAULT 'BİLANÇO',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Kullanıcılar (Users)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tc TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'personnel', 'super_admin')) NOT NULL DEFAULT 'personnel',
        must_change_password BOOLEAN DEFAULT 1,
        company_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      );
    `);

    // ... (All other tables)
    await client.execute(`CREATE TABLE IF NOT EXISTS gib_credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER UNIQUE NOT NULL, username TEXT NOT NULL, password TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS personnel (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, company_id INTEGER NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT, phone TEXT, position TEXT, department TEXT, salary REAL, annual_leave_days INTEGER DEFAULT 14, status TEXT DEFAULT 'Active', start_date DATE, end_date DATE, puantaj_menu_active BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS leaves (id INTEGER PRIMARY KEY AUTOINCREMENT, personnel_id INTEGER NOT NULL, company_id INTEGER NOT NULL, type TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, status TEXT DEFAULT 'PENDING', description TEXT, document_path TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS pointage (id INTEGER PRIMARY KEY AUTOINCREMENT, personnel_id INTEGER NOT NULL, company_id INTEGER NOT NULL, date DATE NOT NULL, status TEXT NOT NULL, overtime_hours REAL DEFAULT 0, is_locked BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(personnel_id, date), FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, personnel_id INTEGER NOT NULL, company_id INTEGER NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, date DATE NOT NULL, status TEXT DEFAULT 'PENDING', description TEXT, receipt_path TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, type TEXT DEFAULT 'General', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS luca_hesap_plani (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, kod TEXT NOT NULL, ad TEXT NOT NULL, tur TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE, UNIQUE(company_id, kod));`);
    
    // Teklifler (Quotations)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS teklifler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teklif_no TEXT NOT NULL,
        tarih DATE NOT NULL,
        vade_tarihi DATE,
        cari_id INTEGER,
        musteri_adi TEXT,
        musteri_vkn TEXT,
        musteri_vergi_dairesi TEXT,
        musteri_adres TEXT,
        musteri_eposta TEXT,
        musteri_telefon TEXT,
        toplam_tutar REAL DEFAULT 0,
        durum TEXT DEFAULT 'Bekliyor',
        notlar TEXT,
        onay_token TEXT UNIQUE,
        company_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cari_id) REFERENCES cariler(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Teklif Kalemleri (Quotation Items)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS teklif_kalemleri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teklif_id INTEGER NOT NULL,
        urun_id INTEGER,
        urun_adi TEXT NOT NULL,
        miktar REAL DEFAULT 1,
        birim TEXT DEFAULT 'Adet',
        birim_fiyat REAL DEFAULT 0,
        iskonto_orani REAL DEFAULT 0,
        iskonto_tutari REAL DEFAULT 0,
        kdv_orani INTEGER DEFAULT 20,
        toplam_tutar REAL DEFAULT 0,
        FOREIGN KEY (teklif_id) REFERENCES teklifler(id) ON DELETE CASCADE
      );
    `);

    // Siparişler (Orders)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS siparisler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siparis_no TEXT NOT NULL,
        teklif_id INTEGER,
        tarih DATE NOT NULL,
        cari_id INTEGER,
        musteri_adi TEXT,
        toplam_tutar REAL DEFAULT 0,
        durum TEXT DEFAULT 'Bekliyor',
        company_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teklif_id) REFERENCES teklifler(id) ON DELETE SET NULL,
        FOREIGN KEY (cari_id) REFERENCES cariler(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Sipariş Kalemleri (Order Items)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS siparis_kalemleri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siparis_id INTEGER NOT NULL,
        urun_id INTEGER,
        urun_adi TEXT NOT NULL,
        miktar REAL DEFAULT 1,
        birim TEXT DEFAULT 'Adet',
        birim_fiyat REAL DEFAULT 0,
        iskonto_orani REAL DEFAULT 0,
        iskonto_tutari REAL DEFAULT 0,
        kdv_orani INTEGER DEFAULT 20,
        toplam_tutar REAL DEFAULT 0,
        FOREIGN KEY (siparis_id) REFERENCES siparisler(id) ON DELETE CASCADE
      );
    `);

    // --- STOK MODÜLÜ TABLOLARI ---

    // Şirket Dosya Klasörleri
    await client.execute(`
      CREATE TABLE IF NOT EXISTS company_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        parent_id INTEGER,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES company_folders(id) ON DELETE CASCADE
      );
    `);

    // Şirket Dosyaları
    await client.execute(`
      CREATE TABLE IF NOT EXISTS company_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        folder_id INTEGER,
        name TEXT NOT NULL,
        size INTEGER,
        type TEXT,
        file_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES company_folders(id) ON DELETE CASCADE
      );
    `);
    
    // Firma Ayarları
    await client.execute(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(company_id, setting_key),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Şirket Araçları (Binek/Ticari)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS company_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        plate TEXT NOT NULL,
        type TEXT CHECK(type IN ('passenger', 'commercial')) NOT NULL DEFAULT 'passenger',
        brand_model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Stok Kategorileri
    await client.execute(`
      CREATE TABLE IF NOT EXISTS stok_kategoriler (
        id TEXT PRIMARY KEY,
        ad TEXT NOT NULL,
        company_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Stok Ürünler
    await client.execute(`
      CREATE TABLE IF NOT EXISTS stok_urunler (
        id TEXT PRIMARY KEY,
        stok_kodu TEXT NOT NULL,
        barkod TEXT,
        urun_adi TEXT NOT NULL,
        kategori_id TEXT,
        ana_birim TEXT DEFAULT 'Adet',
        minimum_stok REAL DEFAULT 0,
        maksimum_stok REAL,
        lot_takibi BOOLEAN DEFAULT 0,
        son_kullanma_tarihli BOOLEAN DEFAULT 0,
        aktif BOOLEAN DEFAULT 1,
        birim_fiyat REAL DEFAULT 0,
        aciklama TEXT,
        company_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kategori_id) REFERENCES stok_kategoriler(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Stok Depolar
    await client.execute(`
      CREATE TABLE IF NOT EXISTS stok_depolar (
        id TEXT PRIMARY KEY,
        kod TEXT NOT NULL,
        ad TEXT NOT NULL,
        varsayilan BOOLEAN DEFAULT 0,
        aktif BOOLEAN DEFAULT 1,
        adres TEXT,
        company_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Stok Hareketler
    await client.execute(`
      CREATE TABLE IF NOT EXISTS stok_hareketler (
        id TEXT PRIMARY KEY,
        urun_id TEXT NOT NULL,
        depo_id TEXT NOT NULL,
        tip TEXT NOT NULL, -- GIRIS, CIKIS, TRANSFER_GIRIS, TRANSFER_CIKIS, SAYIM_GIRIS, SAYIM_CIKIS
        miktar REAL NOT NULL,
        birim_fiyat REAL DEFAULT 0,
        tutar REAL DEFAULT 0,
        tarih DATETIME NOT NULL,
        aciklama TEXT,
        referans_no TEXT,
        lot_no TEXT,
        son_kullanma_tarihi DATETIME,
        bagli_fatura_id TEXT,
        iptal BOOLEAN DEFAULT 0,
        company_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (urun_id) REFERENCES stok_urunler(id) ON DELETE CASCADE,
        FOREIGN KEY (depo_id) REFERENCES stok_depolar(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Mutabakatlar
    await client.execute(`
      CREATE TABLE IF NOT EXISTS mutabakatlar (
        id TEXT PRIMARY KEY,
        company_id INTEGER NOT NULL,
        cari_id TEXT,
        donem TEXT NOT NULL,
        tip TEXT NOT NULL,
        borc REAL DEFAULT 0,
        alacak REAL DEFAULT 0,
        bakiye REAL DEFAULT 0,
        durum TEXT DEFAULT 'Bekliyor',
        token TEXT UNIQUE NOT NULL,
        gonderim_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
        yanit_tarihi DATETIME,
        aciklama TEXT,
        kullanici_muavin_path TEXT,
        karsi_muavin_path TEXT,
        ai_analiz_sonucu TEXT,
        olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );
    `);

    // Column sync
    const tablesToUpdate = [
      'cariler','cari_hareketler','satis_faturalari','alis_faturalari',
      'cek_senetler','banka_hesaplari','masraf_kurallari','kesilecek_faturalar',
      'gider_kategorileri', 'stok_kategoriler', 'stok_urunler', 'stok_depolar', 'stok_hareketler'
    ];
    for (const table of tablesToUpdate) {
        try {
          const info = await client.execute(`PRAGMA table_info(${table})`);
          if (!info.rows.some(col => col.name === 'company_id')) {
            await client.execute(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER DEFAULT 1`);
          }
          if (table === 'cariler' && !info.rows.some(col => col.name === 'muhasebe_kodu')) {
            await client.execute(`ALTER TABLE cariler ADD COLUMN muhasebe_kodu TEXT`);
          }
          if (table === 'cari_hareketler' && !info.rows.some(col => col.name === 'muhasebe_kodu')) {
            await client.execute(`ALTER TABLE cari_hareketler ADD COLUMN muhasebe_kodu TEXT`);
          }
          // Stok Hareketleri Ek Sütunlar
          if (table === 'stok_hareketler') {
            if (!info.rows.some(col => col.name === 'lot_no')) {
              await client.execute(`ALTER TABLE stok_hareketler ADD COLUMN lot_no TEXT`);
            }
            if (!info.rows.some(col => col.name === 'son_kullanma_tarihi')) {
              await client.execute(`ALTER TABLE stok_hareketler ADD COLUMN son_kullanma_tarihi DATETIME`);
            }
          }
        } catch (e) {}
    }

    // Teklif & Sipariş Kalemleri İskonto columns
    try {
      let ti = await client.execute('PRAGMA table_info(teklif_kalemleri)');
      if (!ti.rows.some(c => c.name === 'iskonto_orani')) {
        await client.execute('ALTER TABLE teklif_kalemleri ADD COLUMN iskonto_orani REAL DEFAULT 0');
        await client.execute('ALTER TABLE teklif_kalemleri ADD COLUMN iskonto_tutari REAL DEFAULT 0');
      }
      let si = await client.execute('PRAGMA table_info(siparis_kalemleri)');
      if (!si.rows.some(c => c.name === 'iskonto_orani')) {
        await client.execute('ALTER TABLE siparis_kalemleri ADD COLUMN iskonto_orani REAL DEFAULT 0');
        await client.execute('ALTER TABLE siparis_kalemleri ADD COLUMN iskonto_tutari REAL DEFAULT 0');
      }
    } catch(e) { console.error('Error syncing iskonto columns', e) }


    // Companies table sync (for new column company_type)
    const compInfo = await client.execute(`PRAGMA table_info(companies)`);
    if (!compInfo.rows.some(col => col.name === 'company_type')) {
      await client.execute(`ALTER TABLE companies ADD COLUMN company_type TEXT DEFAULT 'BİLANÇO'`);
    }

    // Satis_faturalari sync for fatura_no, tevkifat_kodu, stopaj_kodu
    try {
      const sfInfo = await client.execute(`PRAGMA table_info(satis_faturalari)`);
      if (!sfInfo.rows.some(col => col.name === 'fatura_no')) {
        await client.execute(`ALTER TABLE satis_faturalari ADD COLUMN fatura_no TEXT`);
      }
      if (!sfInfo.rows.some(col => col.name === 'tevkifat_kodu')) {
        await client.execute(`ALTER TABLE satis_faturalari ADD COLUMN tevkifat_kodu TEXT`);
      }
      if (!sfInfo.rows.some(col => col.name === 'stopaj_kodu')) {
        await client.execute(`ALTER TABLE satis_faturalari ADD COLUMN stopaj_kodu TEXT`);
      }
      if (!sfInfo.rows.some(col => col.name === 'muhasebe_kodu')) {
        await client.execute(`ALTER TABLE satis_faturalari ADD COLUMN muhasebe_kodu TEXT`);
      }
    } catch (e) {}

    // Alis_faturalari sync for muhasebe_kodu
    try {
      const afInfo = await client.execute(`PRAGMA table_info(alis_faturalari)`);
      if (!afInfo.rows.some(col => col.name === 'muhasebe_kodu')) {
        await client.execute(`ALTER TABLE alis_faturalari ADD COLUMN muhasebe_kodu TEXT`);
      }
      if (!afInfo.rows.some(col => col.name === 'urun_id')) {
        await client.execute(`ALTER TABLE alis_faturalari ADD COLUMN urun_id TEXT`);
      }
      if (!afInfo.rows.some(col => col.name === 'depo_id')) {
        await client.execute(`ALTER TABLE alis_faturalari ADD COLUMN depo_id TEXT`);
      }
      if (!afInfo.rows.some(col => col.name === 'vehicle_plate')) {
        await client.execute(`ALTER TABLE alis_faturalari ADD COLUMN vehicle_plate TEXT`);
      }
    } catch (e) {}

    // Mutabakatlar - store file as base64 in DB to survive server restarts
    try {
      const mutInfo = await client.execute(`PRAGMA table_info(mutabakatlar)`);
      if (!mutInfo.rows.some(col => col.name === 'karsi_muavin_data')) {
        await client.execute(`ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_data TEXT`);
      }
      if (!mutInfo.rows.some(col => col.name === 'karsi_muavin_filename')) {
        await client.execute(`ALTER TABLE mutabakatlar ADD COLUMN karsi_muavin_filename TEXT`);
      }
      if (!mutInfo.rows.some(col => col.name === 'kullanici_muavin_data')) {
        await client.execute(`ALTER TABLE mutabakatlar ADD COLUMN kullanici_muavin_data TEXT`);
      }
    } catch (e) { console.error('mutabakatlar column sync error:', e); }

    // Satis_faturalari sync for urun_id, depo_id
    try {
      const sfInfo2 = await client.execute(`PRAGMA table_info(satis_faturalari)`);
      if (!sfInfo2.rows.some(col => col.name === 'urun_id')) {
        await client.execute(`ALTER TABLE satis_faturalari ADD COLUMN urun_id TEXT`);
      }
      if (!sfInfo2.rows.some(col => col.name === 'depo_id')) {
        await client.execute(`ALTER TABLE satis_faturalari ADD COLUMN depo_id TEXT`);
      }
    } catch (e) {}

    // Default User & Company logic
    const compCheck = await client.execute('SELECT COUNT(*) as count FROM companies');
    if (Number(compCheck.rows[0].count) === 0) {
        await client.execute("INSERT INTO companies (id, name, status) VALUES (1, 'Varsayılan Şirket', 'active')");
    }
    
    const superAdminCheck = await client.execute({ sql: 'SELECT COUNT(*) as count FROM users WHERE role = ?', args: ['super_admin'] });
    if (Number(superAdminCheck.rows[0].count) === 0) {
        const superPassword = bcrypt.hashSync('123456', 10);
        await client.execute({ sql: "INSERT INTO users (tc, password, role, must_change_password) VALUES ('superadmin', ?, 'super_admin', 0)", args: [superPassword] });
        console.log('Default superadmin user created.');
    }

    console.log('Turso Database schema initialized successfully.');
    
    // Luca Tablosu İçin Ekstra Doğrulama
    try {
      const lucaRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='luca_hesap_plani'");
      if (lucaRes.rows.length === 0) {
        console.warn('CRITICAL: luca_hesap_plani table was not created during init!');
      } else {
        console.log('Verified: luca_hesap_plani table is ready.');
      }
    } catch (e) {
      console.error('Check luca table error:', e);
    }

  } catch (err) {
    console.error('Error initializing Turso schema:', err);
    throw err;
  }
}
