import { client } from '../api/db.js';

async function runMigration() {
  console.log('Running SQLite Column Migrations...');
  try {
    const afInfo = await client.execute('PRAGMA table_info(alis_faturalari)');
    console.log('alis_faturalari columns:', afInfo.rows.map(r => r.name));
    
    if (!afInfo.rows.some(col => col.name === 'gib_uuid')) {
      console.log('Adding gib_uuid to alis_faturalari...');
      await client.execute('ALTER TABLE alis_faturalari ADD COLUMN gib_uuid TEXT');
      console.log('Added gib_uuid to alis_faturalari successfully!');
    } else {
      console.log('gib_uuid already exists in alis_faturalari.');
    }

    const sfInfo = await client.execute('PRAGMA table_info(satis_faturalari)');
    if (!sfInfo.rows.some(col => col.name === 'gib_uuid')) {
      console.log('Adding gib_uuid to satis_faturalari...');
      await client.execute('ALTER TABLE satis_faturalari ADD COLUMN gib_uuid TEXT');
      console.log('Added gib_uuid to satis_faturalari successfully!');
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigration();
