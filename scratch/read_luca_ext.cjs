const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

['fatura_content.js', 'luca_content.js', 'popup.js', 'popup.html'].forEach(file => {
  const p = path.join(extDir, file);
  if (fs.existsSync(p)) {
    console.log(`\n=================== ${file} ===================`);
    console.log(fs.readFileSync(p, 'utf8'));
  }
});
