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
    position TEXT,
    department TEXT,
    iban TEXT,
    salary REAL,
    annual_leave_days INTEGER DEFAULT 14,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
  );

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
`);

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

module.exports = db;
