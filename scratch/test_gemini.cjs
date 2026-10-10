const apiKey = 'AIzaSyDOAnAKwOlBR4uWpEn8IYvZcHGx3XCI1UY';

async function test() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      contents: [{ parts: [{ text: 'Return JSON: {"status": "ok"}' }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });
  const d = await res.json();
  console.log('Gemini 2.0 Flash Response:');
  console.log(JSON.stringify(d, null, 2));

  const res38 = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      contents: [{ parts: [{ text: 'Return JSON: {"status": "ok"}' }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });
  const d38 = await res38.json();
  console.log('Gemini 3.8 Flash Response:');
  console.log(JSON.stringify(d38, null, 2));
}

test().catch(console.error);
