const fs = require('fs');

// 1. Update App.tsx
let appStr = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
if (!appStr.includes('AkilliOgrenme')) {
  appStr = appStr.replace(
    "import { SirketDosyalari } from './sections/SirketDosyalari';",
    "import { SirketDosyalari } from './sections/SirketDosyalari';\nimport AkilliOgrenme from './sections/AkilliOgrenme';"
  );
}

// Add route case
if (!appStr.includes("case 'akilli-ogrenme':")) {
  appStr = appStr.replace(
    "case 'entegrator-ayarlari':",
    "case 'akilli-ogrenme':\n      return <AkilliOgrenme />;\n    case 'entegrator-ayarlari':"
  );
}
fs.writeFileSync('src/App.tsx', appStr);

// 2. Update Sidebar.tsx
let sidebarStr = fs.readFileSync('src/sections/Sidebar.tsx', 'utf8');
if (!sidebarStr.includes('akilli-ogrenme')) {
  const ayarlarNav = `{ id: 'luca-ayarlari', label: 'Luca Ayarları', icon: Settings },`;
  const yapayZekaNav = `{ id: 'akilli-ogrenme', label: 'Akıllı Öğrenme (AI)', icon: BrainCircuit },\n        { id: 'luca-ayarlari', label: 'Luca Ayarları', icon: Settings },`;
  
  sidebarStr = sidebarStr.replace(ayarlarNav, yapayZekaNav);
  
  // Need to import BrainCircuit if not already
  if (!sidebarStr.includes('BrainCircuit')) {
    sidebarStr = sidebarStr.replace(
      "Settings, LogOut",
      "Settings, LogOut, BrainCircuit"
    );
  }
}
fs.writeFileSync('src/sections/Sidebar.tsx', sidebarStr);

console.log("Routing completed");
