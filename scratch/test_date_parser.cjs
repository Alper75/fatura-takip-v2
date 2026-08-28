const parseTurkishDate = (val) => {
  if (!val) return new Date().toISOString().split('T')[0];
  
  if (typeof val === 'number') {
    const parsedExcelDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    return parsedExcelDate.toISOString().split('T')[0];
  }
  
  let str = String(val).trim().split(' ')[0];
  
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const match = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  
  // YYYY-MM-DD
  const matchIso = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (matchIso) {
    const year = matchIso[1];
    const month = matchIso[2].padStart(2, '0');
    const day = matchIso[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return str;
};

console.log('01.07.2026 08:22:00 ->', parseTurkishDate('01.07.2026 08:22:00'));
console.log('31.07.2026 09:22:00 ->', parseTurkishDate('31.07.2026 09:22:00'));
console.log('06.07.2026 ->', parseTurkishDate('06.07.2026'));
console.log('2026-07-01 ->', parseTurkishDate('2026-07-01'));
