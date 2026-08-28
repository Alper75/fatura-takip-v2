const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// Read existing files
const contentPath = path.join(extDir, 'luca_content.js');
const popupJsPath = path.join(extDir, 'popup.js');
const popupHtmlPath = path.join(extDir, 'popup.html');

console.log('Writing updates to luca_extension...');
