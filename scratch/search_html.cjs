const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:\\Users\\Alper\\.gemini\\antigravity-ide\\brain\\a4146eb5-c3c3-4be3-9796-9f7bff78df46\\.system_generated\\logs\\transcript_full.jsonl';

// Let's search for "fisDetayFormArray" in transcript_full.jsonl and extract lines around it
const content = fs.readFileSync(transcriptPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (line.includes('fisDetayFormArray')) {
    try {
      const parsed = JSON.parse(line);
      const text = parsed.content || JSON.stringify(parsed);
      const idx = text.indexOf('fisDetayFormArray');
      if (idx !== -1) {
        // Extract 3000 chars after fisDetayFormArray
        console.log('--- FOUND HTML SNIPPET ---');
        console.log(text.substring(idx, idx + 4000));
        break;
      }
    } catch (e) {}
  }
}
