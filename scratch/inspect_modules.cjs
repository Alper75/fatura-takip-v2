const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, '../1.1.24_0/luca-app-content-script.js'), 'utf8');

// find all webpack modules in luca-app-content-script.js
const moduleRegex = /(\d+:\s*function\([^\)]*\)\s*\{[\s\S]*?\}\s*,\s*(?=\d+:|\]\))/g;
let match;
while ((match = moduleRegex.exec(content)) !== null) {
  console.log('--- MODULE ---');
  console.log(match[0].slice(0, 500));
}
