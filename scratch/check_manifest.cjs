const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');
const manifestPath = path.join(extDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('MANIFEST:', JSON.stringify(manifest, null, 2));
