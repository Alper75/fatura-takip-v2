const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
const code = fs.readFileSync(popupPath, 'utf8');

const lines = code.split('\n');
console.log('Total lines:', lines.length);
lines.forEach((l, i) => {
  if (i >= 240) console.log((i+1) + ': ' + l);
});
