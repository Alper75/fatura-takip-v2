const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("case 'akilli-ogrenme':")) {
  code = code.replace(
    "case 'sirket-dosyalari':\n            return <SirketDosyalari />;",
    "case 'sirket-dosyalari':\n            return <SirketDosyalari />;\n          case 'akilli-ogrenme':\n            return <AkilliOgrenme />;"
  );
  fs.writeFileSync('src/App.tsx', code);
  console.log("App.tsx fixed");
} else {
  console.log("Already fixed");
}
