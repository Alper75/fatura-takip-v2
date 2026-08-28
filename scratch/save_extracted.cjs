const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, '../1.1.24_0/luca-app-content-script.js'), 'utf8');

fs.writeFileSync(path.resolve(__dirname, 'atlas_extracted.js'), content.slice(85000));
console.log('Saved to scratch/atlas_extracted.js');
