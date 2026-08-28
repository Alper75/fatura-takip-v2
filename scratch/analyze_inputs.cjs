const fs = require('fs');
const transcriptPath = 'C:\\Users\\Alper\\.gemini\\antigravity-ide\\brain\\a4146eb5-c3c3-4be3-9796-9f7bff78df46\\.system_generated\\logs\\transcript_full.jsonl';

const content = fs.readFileSync(transcriptPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (line.includes('"type":"USER_INPUT"') && line.includes('fisDetayFormArray')) {
    const parsed = JSON.parse(line);
    const text = parsed.content || '';
    
    // Find all <input in text and print unique names/ids/classes
    const inputMatches = text.match(/<input[^>]+>/g) || [];
    console.log('Total input tags found:', inputMatches.length);
    console.log('Sample inputs:');
    inputMatches.slice(0, 30).forEach(inp => console.log(inp));
    
    // Find table id or tr id
    const trMatches = text.match(/<tr[^>]+>/g) || [];
    console.log('Sample TR tags:');
    trMatches.slice(0, 20).forEach(tr => console.log(tr));
  }
}
