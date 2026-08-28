const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
console.log(fs.readFileSync(popupPath, 'utf8'));
