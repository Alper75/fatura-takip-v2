import { client } from '../api/db.js';

async function testGemini() {
  try {
    const keyInfo = await client.execute("SELECT * FROM company_settings WHERE setting_key = 'gemini_api_key'");
    const apiKey = keyInfo.rows[0]?.setting_value;
    
    if (!apiKey) return;
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Extract this to JSON: name is John, age is 30. Use keys 'name' and 'age'." }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}
testGemini();
