require('dotenv').config();
const { initDb, client } = require('./api/db');

async function test() {
  console.log('Initializing DB on Turso...');
  try {
    await initDb();
    console.log('DB Initialized Successfully.');
    
    const rs = await client.execute('SELECT * FROM users');
    console.log('Users found:', rs.rows.length);
    rs.rows.forEach(u => console.log(`- ${u.tc} (${u.role})`));
    
    process.exit(0);
  } catch (err) {
    console.error('Initialization Failed:', err);
    process.exit(1);
  }
}

test();
