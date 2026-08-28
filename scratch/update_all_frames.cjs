const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');
const popupPath = path.join(extDir, 'popup.js');

let popupCode = fs.readFileSync(popupPath, 'utf8');

// Ensure allFrames: true in executeScript calls
popupCode = popupCode.replace(/target:\s*\{\s*tabId:\s*tab\.id\s*\}/g, 'target: { tabId: tab.id, allFrames: true }');

fs.writeFileSync(popupPath, popupCode, 'utf8');
console.log('popup.js updated with allFrames: true support!');
