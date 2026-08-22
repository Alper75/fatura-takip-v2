const fs = require('fs');
let code = fs.readFileSync('src/sections/AkilliOgrenme.tsx', 'utf8');

if (!code.includes("import * as XLSX from 'xlsx';")) {
  code = code.replace("import { Label } from '@/components/ui/label';", "import { Label } from '@/components/ui/label';\nimport * as XLSX from 'xlsx';");
}

const parseExcelFunc = `
  const parseExcelForAI = async (file: File) => {
    toast.info(\`\${file.name} optimize ediliyor...\`);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Satırları dizi olarak al
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Sadece ilk 2000 satırı alıyoruz, yapay zekanın öğrenmesi için fazlasıyla yeterli
    // Ayrıca boş satırları siliyoruz
    const limitedRows = rows.slice(0, 2000);
    const compactRows = limitedRows.map(row => {
      if (Array.isArray(row)) {
        return row.filter(cell => cell != null && cell !== '').join(' | ');
      }
      return '';
    }).filter(r => r.length > 0);
    
    const jsonString = JSON.stringify(compactRows);
    const base64 = btoa(new TextEncoder().encode(jsonString).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    return \`data:application/json;base64,\${base64}\`;
  };
`;

if (!code.includes("parseExcelForAI")) {
  code = code.replace(
    "const parseMultipleXMLsForAI",
    parseExcelFunc + "\n  const parseMultipleXMLsForAI"
  );
}

// Modify handleLearn
const handleLearnTarget = `    try {
      const muavinBase64 = await fileToBase64(muavinFile);
      
      let faturalarBase64 = "";
      let faturalarFileName = "";

      // Eğer birden fazla XML varsa veya fatura tipi ise kendi parser'ımızı kullan
      if (kuralTipi === 'fatura' && digerFiles[0].name.toLowerCase().endsWith('.xml')) {
        toast.info(\`\${digerFiles.length} adet XML optimize ediliyor...\`);
        faturalarBase64 = await parseMultipleXMLsForAI(digerFiles);
        faturalarFileName = "toplu_faturalar_ozeti.json";
      } else {
        // Excel veya tek dosya ise standart
        faturalarBase64 = await fileToBase64(digerFiles[0]);
        faturalarFileName = digerFiles[0].name;
      }`;

const handleLearnReplace = `    try {
      // Excel parse logic for muavin (to avoid 413 Payload Too Large)
      const muavinBase64 = muavinFile.name.match(/\\.xls/) 
        ? await parseExcelForAI(muavinFile) 
        : await fileToBase64(muavinFile);
      
      let faturalarBase64 = "";
      let faturalarFileName = "";

      if (kuralTipi === 'fatura' && digerFiles[0].name.toLowerCase().endsWith('.xml')) {
        toast.info(\`\${digerFiles.length} adet XML optimize ediliyor...\`);
        faturalarBase64 = await parseMultipleXMLsForAI(digerFiles);
        faturalarFileName = "toplu_faturalar_ozeti.json";
      } else {
        // Dış veri de Excel ise optimize et
        faturalarBase64 = digerFiles[0].name.match(/\\.xls/)
           ? await parseExcelForAI(digerFiles[0])
           : await fileToBase64(digerFiles[0]);
        faturalarFileName = digerFiles[0].name.match(/\\.xls/) ? 'optimize_edilmis_ekstre.json' : digerFiles[0].name;
      }`;

if (!code.includes("muavinFile.name.match(/\\.xls/)")) {
  code = code.replace(handleLearnTarget, handleLearnReplace);
  fs.writeFileSync('src/sections/AkilliOgrenme.tsx', code);
  console.log("AkilliOgrenme.tsx updated to optimize Excel files!");
} else {
  console.log("Already optimized.");
}
