import { client } from '../api/db.js';

async function check() {
  const info = await client.execute("SELECT * FROM company_settings WHERE setting_key = 'gemini_model'");
  console.log(info.rows);
}
check();
