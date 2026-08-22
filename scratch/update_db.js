import { client } from '../api/db.js';

async function update() {
  await client.execute("UPDATE company_settings SET setting_value = 'gemini-1.5-flash' WHERE setting_key = 'gemini_model' AND setting_value = 'gemini-2.5-flash'");
  console.log('DB Updated');
}
update();
