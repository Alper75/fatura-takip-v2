import { client } from '../api/db.js';

async function testGemini() {
  try {
    const keyInfo = await client.execute("SELECT * FROM company_settings WHERE setting_key = 'gemini_api_key'");
    const apiKey = keyInfo.rows[0]?.setting_value;
    
    if (!apiKey) {
      console.log('No API Key found in DB');
      return;
    }
    
    const modelInfo = await client.execute("SELECT * FROM company_settings WHERE setting_key = 'gemini_model'");
    const model = modelInfo.rows[0]?.setting_value || 'gemini-1.5-flash';
    
    console.log('Using Model:', model);
    console.log('API Key starts with:', apiKey.substring(0, 5) + '...');
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello" }] }]
      })
    });
    
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testGemini();
