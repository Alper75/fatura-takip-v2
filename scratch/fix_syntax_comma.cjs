const fs = require('fs');
const path = require('path');

const popupPath = path.resolve(__dirname, '../../luca_extension/popup.js');
let code = fs.readFileSync(popupPath, 'utf8');

// Replace the syntax error
code = code.replace(/return true;\s*\}\s*args:\s*\[mList\]/g, 'return true;\n                    },\n                    args: [mList]');

fs.writeFileSync(popupPath, code, 'utf8');

// Also test that popup.js is 100% valid JS syntax using node require/eval parse
try {
  new Function(fs.readFileSync(popupPath, 'utf8'));
  console.log('SYNTAX VALIDATION PASSED 100%!');
} catch (e) {
  console.error('SYNTAX ERROR:', e);
}
