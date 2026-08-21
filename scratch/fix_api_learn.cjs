const fs = require('fs');
let apiCode = fs.readFileSync('api/index.js', 'utf8');

const startStr = '// Process Excel/JSON files';
const endStr = '  `;';

const startIndex = apiCode.indexOf(startStr);
// Find the first endStr AFTER startIndex
const endIndex = apiCode.indexOf(endStr, startIndex) + endStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  const replaceStr = `// Process Excel/JSON files by converting them to text properly
      const base64ToText = (b64) => {
        if (!b64) return '';
        try {
          if (b64.includes('application/json')) {
            return Buffer.from(b64.split(',')[1] || b64, 'base64').toString('utf8');
          } else if (b64.includes('application/vnd') || b64.includes('spreadsheetml') || b64.includes('excel')) {
            const b64Data = b64.split(',')[1] || b64;
            const workbook = xlsx.read(b64Data, {type: 'base64'});
            let result = '';
            workbook.SheetNames.forEach(sheetName => {
              result += xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]) + '\\n';
            });
            return result;
          } else {
            return Buffer.from(b64.split(',')[1] || b64, 'base64').toString('utf8');
          }
        } catch (e) {
          console.error('Base64 parse error:', e);
          return b64.substring(0, 2000);
        }
      };

      const muavinText = base64ToText(muavinBase64).substring(0, 300000); // 300K chars is well within Gemini 1.5 limits
      const faturalarText = base64ToText(faturalarBase64).substring(0, 300000);

      const prompt = \`Sen kıdemli bir mali müşavir ve veri analistisin. Sana bir firmanın geçmiş dönem "Muavin Defter" dökümü ve "Fatura Listesi (veya Banka Listesi)" verilerini vereceğim.
  Amacın, geçmiş işlemlere bakarak deterministik muhasebe kodu atama kuralları çıkarmaktır.
  
  Verilen kural tipi: \${kuralTipi} (fatura veya banka)
  
  ÇIKTI FORMATI:
  Sadece JSON dizisi döndür. Başka hiçbir açıklama yazma.
  Örnek Çıktı:
  [
    { "anahtar_kelime": "YEMEKSEPETİ", "muhasebe_kodu": "770.01.001", "kural_adi": "Yemek Giderleri" },
    { "anahtar_kelime": "GARANTİ EFT", "muhasebe_kodu": "102.01", "kural_adi": "Banka Hareketi" }
  ]
  
  KURALLAR:
  1. Kurallar mantıklı ve spesifik olmalıdır. "A.Ş." gibi çok genel kelimeler kullanma.
  2. Sadece en çok tekrar eden ve en emin olduğun kuralları çıkar (max 20 adet).
  
  VERİLER:
  Muavin Verisi (İlk 300.000 karakter):
  \${muavinText}
  
  Dış Veri (İlk 300.000 karakter):
  \${faturalarText}
  \`;`;

  const newCode = apiCode.substring(0, startIndex) + replaceStr + apiCode.substring(endIndex);
  fs.writeFileSync('api/index.js', newCode);
  console.log('api/index.js updated successfully!');
} else {
  console.log('Could not find start/end markers!');
}
