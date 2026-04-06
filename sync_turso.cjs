require('dotenv').config();
const { initDb } = require('./api/db.cjs');

async function sync() {
    console.log('Connecting to Turso and initializing schema...');
    try {
        await initDb();
        console.log('SUCCESS: Turso database updated with new schema and superadmin.');
    } catch (error) {
        console.error('FAILURE: Error updating Turso:', error);
        process.exit(1);
    }
}

sync();
