const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
const lines = fs.readFileSync(popupPath, 'utf8').split('\n');

for (let i = Math.max(0, lines.length - 80); i < lines.length; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}
