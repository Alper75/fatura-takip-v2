const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../1.1.24_0/luca-app-content-script-basic.js');
let content = fs.readFileSync(scriptPath, 'utf8');

// Find the target snippet
const targetSearch = "(e.e_document_type||e.printed_document_type)&&function(e,t){";
const found = content.indexOf(targetSearch);
console.log('Target found at index:', found);

if (found > -1) {
  const snippet = content.substring(found - 100, found + 400);
  console.log('Surrounding code:\n', snippet);
}
