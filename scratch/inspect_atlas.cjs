const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../1.1.24_0');
const files = fs.readdirSync(dir);

files.forEach(f => {
  if (f.endsWith('.js')) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log(`=== ${f} (${content.length} chars) ===`);
    // Find strings
    const matches = content.match(/https?:\/\/[^\s"'`]+|\/[a-zA-Z0-9_\-\.]+\.do[^\s"'`]*|[a-zA-Z0-9_]+(?=\s*:\s*function|\s*=\s*function|\s*\([^)]*\)\s*=>)/g) || [];
    console.log(`Found ${matches.length} matches. Unique samples:`, [...new Set(matches)].slice(0, 30));
  }
});
