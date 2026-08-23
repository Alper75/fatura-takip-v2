import { client } from '../api/db.js';

async function update() {
  await client.execute("UPDATE company_settings SET setting_value = 'gemini-3.6-flash' WHERE setting_key = 'gemini_model'");
  console.log('DB Updated to 3.6-flash');
}
update();
