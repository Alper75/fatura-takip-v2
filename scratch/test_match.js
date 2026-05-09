const normalizeString = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/i/g, 'I')
    .replace(/ı/g, 'I')
    .replace(/ğ/g, 'G')
    .replace(/ü/g, 'U')
    .replace(/ş/g, 'S')
    .replace(/ö/g, 'O')
    .replace(/ç/g, 'C')
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .trim();
};

const cariler = [
  { id: 1, unvan: 'Özdemir Ticaret A.Ş.' },
  { id: 2, unvan: 'Ahmet Yılmaz' },
  { id: 3, unvan: 'Çiçek Sepeti İnternet Hizmetleri A.Ş.' },
  { id: 4, unvan: 'Arçelik Pazarlama A.Ş.' }
];

const aciklamalar = [
  'HAVALE OZDEMIR TIC',
  'GELEN AHMET YILMAZ KIRA',
  'CICEK SEPETI INT HIZ AS',
  'ARCELIK PAZ ODEME'
];

aciklamalar.forEach(aciklama => {
  const cleanDesc = normalizeString(aciklama);
  console.log("TEST:", cleanDesc);
  for (const cari of cariler) {
      const rawU = normalizeString(cari.unvan);
      if (!rawU) continue;
      
      if (cleanDesc.includes(rawU)) {
        console.log("  MATCH EXACT:", rawU);
        continue;
      }

      const cleanedU = rawU
        .replace(/\s+A\.?S\.?(\s|$)/g, ' ')
        .replace(/\s+ANONIM SIRKETI(\s|$)/g, ' ')
        .replace(/\s+LTD\.?\s*STI\.?(\s|$)/g, ' ')
        .replace(/\s+LIMITED SIRKETI(\s|$)/g, ' ')
        .replace(/\s+SAN\.?\s*VE\s*TIC\.?(\s|$)/g, ' ')
        .replace(/\s+SANAYI VE TICARET(\s|$)/g, ' ')
        .replace(/\s+SAN\.?\s*TIC\.?(\s|$)/g, ' ')
        .replace(/\s+SANAYI(\s|$)/g, ' ')
        .replace(/\s+TICARET(\s|$)/g, ' ')
        .replace(/\s+SAN\.?(\s|$)/g, ' ')
        .replace(/\s+TIC\.?(\s|$)/g, ' ')
        .replace(/\s+STI\.?(\s|$)/g, ' ')
        .trim();

      if (cleanedU.length >= 4 && cleanDesc.includes(cleanedU)) {
        console.log("  MATCH CLEANED:", cleanedU, "for", rawU);
        continue;
      }
      
      const words = cleanedU.split(' ');
      if (words.length >= 2) {
        const firstTwoWords = words[0] + ' ' + words[1];
        if (firstTwoWords.length >= 5 && cleanDesc.includes(firstTwoWords)) {
           console.log("  MATCH 2 WORDS:", firstTwoWords, "for", rawU);
           continue;
        }
      }
  }
});
