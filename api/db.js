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

    // Column sync
    const tablesToUpdate = ['cariler','cari_hareketler','satis_faturalari','alis_faturalari','cek_senetler','banka_hesaplari','masraf_kurallari','kesilecek_faturalar','gider_kategorileri'];
    for (const table of tablesToUpdate) {
        try {
          const info = await client.execute(`PRAGMA table_info(${table})`);
          if (!info.rows.some(col => col.name === 'company_id')) {
            await client.execute(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER DEFAULT 1`);
          }
        } catch (e) {}
    }

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
  } catch (err) {
    console.error('Error initializing Turso schema:', err);
    throw err;
  }
}
