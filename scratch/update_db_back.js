import { client } from '../api/db.js';

async function update() {
  await client.execute("UPDATE company_settings SET setting_value = 'gemini-1.5-flash' WHERE setting_key = 'gemini_model'");
  console.log('DB Updated to 1.5-flash');
}
update();
