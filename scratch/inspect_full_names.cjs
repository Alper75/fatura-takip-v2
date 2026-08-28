const fs = require('fs');
const transcriptPath = 'C:\\Users\\Alper\\.gemini\\antigravity-ide\\brain\\a4146eb5-c3c3-4be3-9796-9f7bff78df46\\.system_generated\\logs\\transcript_full.jsonl';

const content = fs.readFileSync(transcriptPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (line.includes('"type":"USER_INPUT"') && line.includes('fisDetayFormArray')) {
    const parsed = JSON.parse(line);
    const text = parsed.content || '';
    
    // Search for any name attribute
    const names = text.match(/name="[^"]+"/g) || [];
    console.log('All name attributes found in user HTML:');
    const uniqueNames = [...new Set(names)];
    console.log(uniqueNames);
    
    // Search for any id attribute
    const ids = text.match(/id="[^"]+"/g) || [];
    console.log('All id attributes found in user HTML:');
    const uniqueIds = [...new Set(ids)];
    console.log(uniqueIds.slice(0, 50));
    
    // Let's see what is after hpTable
    const hpIdx = text.indexOf('hpTable');
    if (hpIdx !== -1) {
      console.log('After hpTable (next 4000 chars):');
      console.log(text.substring(hpIdx, hpIdx + 4000));
    }
  }
}
