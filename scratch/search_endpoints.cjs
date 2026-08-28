const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../1.1.24_0');
const files = fs.readdirSync(dir);

files.forEach(f => {
  if (f.endsWith('.js')) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const matches = content.match(/[a-zA-Z0-9_\-\.\/]{3,}\.do[^\s"'`\(\)]*/g) || [];
    if (matches.length > 0) {
      console.log(`=== ${f} ===`);
      console.log([...new Set(matches)]);
    }
  }
});
