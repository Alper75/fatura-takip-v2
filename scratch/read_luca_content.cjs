const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../../luca_extension/luca_content.js');
if (fs.existsSync(p)) {
  console.log(fs.readFileSync(p, 'utf8'));
}
