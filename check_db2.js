import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://fatura-alper75.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ5NTAwMDgsImlkIjoiMDE5ZDQzNDItZmMwMS03MDE0LTkwMmUtYWI2ODlhM2E1ZTNhIiwicmlkIjoiMTQxMjQwNzItZjFhNS00MGY2LThiZDItMjAxOTg5YWQwNDc3In0.Sf5y6Bq-WBJGdjiqnjUn2JaBYkI6PfiObzWOZTa0rmB7HTtmwqT_4PPUb24ObXOIRqhmVkzx1i0SZdtykL8PCA'
});

async function check() {
  try {
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
    console.log('company_files created successfully');
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
