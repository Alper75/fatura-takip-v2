require('dotenv').config();
const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const path = require('path');

const localDbPath = path.join(__dirname, 'api', 'personnel.db');
const localDb = new Database(localDbPath);

const url = process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function migrate() {
    console.log('--- MIGRATION STARTED ---');
    
    const tables = [
        'users', 'personnel', 'pointage', 'leaves', 'documents', 
        'assets', 'trainings', 'payroll', 'requests', 'announcements', 
        'cariler', 'cari_hareketler', 'satis_faturalari', 'alis_faturalari', 
        'cek_senetler', 'banka_hesaplari', 'masraf_kurallari', 
        'kesilecek_faturalar', 'gider_kategorileri'
    ];

    for (const table of tables) {
        process.stdout.write(`Migrating ${table}... `);
        try {
            const rows = localDb.prepare(`SELECT * FROM ${table}`).all();
            if (rows.length === 0) {
                console.log('0 rows found. Skipping.');
                continue;
            }

            // For each table, we'll try to insert rows into Turso.
            // Using batch for efficiency if rows are many, but let's do sequential for robustness in first pass.
            // Or simple batch per table.
            
            for (const row of rows) {
                const keys = Object.keys(row);
                const columns = keys.join(', ');
                const placeholders = keys.map(() => '?').join(', ');
                const values = keys.map(k => row[k]);

                // We use INSERT OR IGNORE to avoid duplicate key errors if rerun
                await client.execute({
                    sql: `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${placeholders})`,
                    args: values
                });
            }
            console.log(`${rows.length} rows migrated.`);
        } catch (err) {
            console.log(`ERROR: ${err.message}`);
        }
    }
    
    console.log('--- MIGRATION COMPLETED ---');
    process.exit(0);
}

migrate();
