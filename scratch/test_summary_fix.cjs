// Test table parsing matching the user's screenshot
const htmlSample = `
<table>
  <tr>
    <td>1</td>
    <td>Talya Nisari X Dime Tribe</td>
    <td>1 Adet</td>
    <td>20.000 TL</td>
    <td>%0,00</td>
    <td>0,00 TL</td>
    <td>İskonto -</td>
    <td>%20,00</td>
    <td>4.000,00 TL</td>
    <td>KV. STOPAJI (%15,00)=3.000,00 TLKDV TEVKİFAT (%30,00)=1.200,00 TL</td>
    <td>20.000,00 TL</td>
  </tr>
</table>
<table id="budgetContainerTable">
  <tr><td></td><td>Mal Hizmet Toplam Tutarı</td><td>20.000,00 TL</td></tr>
  <tr><td></td><td>Toplam İskonto</td><td>0,00 TL</td></tr>
  <tr><td></td><td>Hesaplanan KV. STOPAJI(%15)</td><td>3.000,00 TL</td></tr>
  <tr><td></td><td>Hesaplanan KDV(%20)</td><td>4.000,00 TL</td></tr>
  <tr><td></td><td>Hesaplanan KDV Tevkifat(%30)</td><td>1.200,00 TL</td></tr>
  <tr><td></td><td>Tevkifata Tabi İşlem Tutarı</td><td>20.000,00TL</td></tr>
  <tr><td></td><td>Tevkifata Tabi İşlem Üzerinden Hes. KDV</td><td>4.000,00TL</td></tr>
  <tr><td></td><td>Vergiler Dahil Toplam Tutar</td><td>24.000,00 TL</td></tr>
  <tr><td></td><td>Ödenecek Tutar</td><td>19.800,00 TL</td></tr>
</table>
`;

const parseAmount = (str) => {
  if (!str) return 0;
  let clean = str.replace(/[^\d\.,]/g, '');
  if (!clean) return 0;
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(/,/g, '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(/,/g, '.');
  }
  return parseFloat(clean) || 0;
};

const rows = [];
const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
let trMatch;
while ((trMatch = trRegex.exec(htmlSample)) !== null) {
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const tds = [];
  let tdMatch;
  while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
    const text = tdMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text) tds.push(text);
  }
  if (tds.length >= 2) {
    rows.push(tds);
  }
}

// Summary rows are typically 2 or 3 cells (Label, Amount or Empty, Label, Amount)
// Kalem rows have 5-11 cells.
const summaryRows = rows.filter(r => r.length <= 4);

const extractAmount = (keywords, excludeKeywords = []) => {
  for (const tds of summaryRows) {
    const labelCell = tds[tds.length - 2];
    const amountCell = tds[tds.length - 1];
    const matchesKeyword = keywords.some(k => new RegExp(k, 'i').test(labelCell));
    const matchesExclude = excludeKeywords.some(k => new RegExp(k, 'i').test(labelCell));
    if (matchesKeyword && !matchesExclude) return parseAmount(amountCell);
  }
  // If not found in summaryRows, try all rows (excluding multi-tax columns)
  for (const tds of rows) {
    const labelCell = tds[tds.length - 2];
    const amountCell = tds[tds.length - 1];
    const matchesKeyword = keywords.some(k => new RegExp(k, 'i').test(labelCell));
    const matchesExclude = excludeKeywords.some(k => new RegExp(k, 'i').test(labelCell));
    if (matchesKeyword && !matchesExclude && !labelCell.includes('=')) return parseAmount(amountCell);
  }
  return 0;
};

console.log('Tutar:', extractAmount(['Ödenecek Tutar', 'Genel Toplam']));
console.log('Matrah:', extractAmount(['Mal Hizmet Toplam', 'Tevkifata Tabi İşlem Tutarı']));
console.log('KDV:', extractAmount(['Hesaplanan KDV'], ['Tevkifat', 'Tevkifata Tabi', 'İade']));
console.log('Tevkifat:', extractAmount(['KDV Tevkifat']));
console.log('Stopaj:', extractAmount(['STOPAJ', 'KV. STOPAJ']));
