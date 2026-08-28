const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../1.1.24_0');

['luca-app-content-script.js', 'luca-app-content-script-basic.js', 'luca-login-content-script.js'].forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  // Skip jQuery by searching for custom logic
  console.log(`\n=================== ${f} ===================`);
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  // Let's print the last 2000 characters
  console.log(content.slice(-2500));
});
