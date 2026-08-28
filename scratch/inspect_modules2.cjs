const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, '../1.1.24_0/luca-app-content-script.js'), 'utf8');

// Find non-jquery parts: Look for index of "function" after index 80000
console.log("Length:", content.length);
console.log(content.slice(85000));
