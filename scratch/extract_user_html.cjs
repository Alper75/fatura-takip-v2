const fs = require('fs');
const transcriptPath = 'C:\\Users\\Alper\\.gemini\\antigravity-ide\\brain\\a4146eb5-c3c3-4be3-9796-9f7bff78df46\\.system_generated\\logs\\transcript_full.jsonl';

const content = fs.readFileSync(transcriptPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (line.includes('"type":"USER_INPUT"') && line.includes('fisDetayFormArray')) {
    const parsed = JSON.parse(line);
    const text = parsed.content || '';
    const idx = text.indexOf('Hesap Kodu *');
    if (idx !== -1) {
      console.log('--- FOUND USER HTML SNIPPET ---');
      console.log(text.substring(idx - 500, idx + 4000));
    } else {
      console.log('User input found, length:', text.length);
      const tableIdx = text.indexOf('<table');
      console.log(text.substring(tableIdx, tableIdx + 3000));
    }
  }
}
