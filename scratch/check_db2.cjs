const db = require('better-sqlite3')('api/fatura.db'); 
console.log(JSON.stringify(db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='table'`).all(), null, 2));
