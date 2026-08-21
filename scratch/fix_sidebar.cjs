const fs = require('fs');
let code = fs.readFileSync('src/sections/Sidebar.tsx', 'utf8');

const aiItem = `    {
      id: 'akilli-ogrenme',
      label: 'Akıllı Öğrenme (AI)',
      icon: BrainCircuit,
      onClick: () => setCurrentView('akilli-ogrenme' as any),
      view: 'akilli-ogrenme',
      adminOnly: true
    },
`;

if (!code.includes("id: 'akilli-ogrenme'")) {
  // Inject before luca-ayarlari
  code = code.replace(
    "    {\n      id: 'luca-ayarlari',",
    aiItem + "    {\n      id: 'luca-ayarlari',"
  );
  
  // Need to import BrainCircuit if not imported
  if (!code.includes("BrainCircuit")) {
    code = code.replace(
      "import { \n  LayoutDashboard, \n  Users, \n  FileText, \n  CreditCard, \n  Settings, \n  LogOut, \n  Receipt, \n  Landmark, \n  Briefcase, \n  Package, \n  FilePlus, \n  Calculator,\n  FileSignature,\n  ClipboardList\n} from 'lucide-react';",
      "import { \n  LayoutDashboard, \n  Users, \n  FileText, \n  CreditCard, \n  Settings, \n  LogOut, \n  Receipt, \n  Landmark, \n  Briefcase, \n  Package, \n  FilePlus, \n  Calculator,\n  FileSignature,\n  ClipboardList,\n  BrainCircuit\n} from 'lucide-react';"
    );
  }
  
  fs.writeFileSync('src/sections/Sidebar.tsx', code);
  console.log("Sidebar updated");
} else {
  console.log("Already updated");
}
