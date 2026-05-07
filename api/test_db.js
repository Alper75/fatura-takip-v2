import { createClient } from '@libsql/client';
import 'dotenv/config';

const url = process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function test() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS company_folders_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        parent_id INTEGER,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES company_folders_test(id) ON DELETE CASCADE
      );
    `);
    console.log('company_folders_test success');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS company_files_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        folder_id INTEGER,
        name TEXT NOT NULL,
        size INTEGER,
        type TEXT,
        file_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES company_folders_test(id) ON DELETE CASCADE
      );
    `);
    console.log('company_files_test success');

  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

test();
