const fs = require('fs');

const fixFile = (path) => {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/\\`/g, '`');
  content = content.replace(/\\\$/g, '$');
  fs.writeFileSync(path, content);
  console.log('Fixed', path);
};

fixFile('src/sections/AkilliOgrenme.tsx');
fixFile('src/sections/BankaEkstreListesi.tsx');
