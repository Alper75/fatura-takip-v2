import 'dotenv/config';
import { initDb } from './api/db.js';

async function sync() {
    console.log('Connecting to Turso and initializing schema (ESM)...');
    try {
        await initDb();
        console.log('SUCCESS: Turso database updated with new schema and superadmin.');
        process.exit(0);
    } catch (error) {
        console.error('FAILURE: Error updating Turso:', error);
        process.exit(1);
    }
}

sync();
