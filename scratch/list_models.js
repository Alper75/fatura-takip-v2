import { client } from '../api/db.js';

async function listModels() {
  try {
    const keyInfo = await client.execute("SELECT * FROM company_settings WHERE setting_key = 'gemini_api_key'");
    const apiKey = keyInfo.rows[0]?.setting_value;
    
    if (!apiKey) {
      console.log('No API Key');
      return;
    }
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    const data = await res.json();
    if (data.models) {
      data.models.forEach(m => console.log(m.name));
    } else {
      console.log(data);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

listModels();
