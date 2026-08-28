const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../1.1.24_0/luca-app-content-script-basic.js');
let content = fs.readFileSync(scriptPath, 'utf8');

const found = content.indexOf("(e.e_document_type||e.printed_document_type)&&function(e,t){");
console.log('Snippet:\n', content.substring(found, found + 600));
