const htmlContent = `
<table width='800px' table-layout='fixed' id='budgetContainerTable'>
<tbody><tr><td valign='top' align='right'>
<table><tbody>
<tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Mal Hizmet Toplam Tutarı</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>20.000,00 TL</td></tr>
<tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Toplam İskonto</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>0,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KV. STOPAJI(%15)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 3.000,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KDV(%20)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 4.000,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Hesaplanan KDV Tevkifat(%30)</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'> 1.200,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi İşlem Tutarı</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>20.000,00TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi İşlem Üzerinden Hes. KDV</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>4.000,00TL</td></tr>
<tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Vergiler Dahil Toplam Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>24.000,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Ödenecek Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>19.800,00 TL</td></tr>
</tbody></table></td></tr></tbody></table>
`;

const parseAmount = (str) => {
  if (!str) return 0;
  // Sadece sayı, virgül ve nokta kalsın
  let clean = str.replace(/[^\d\.,]/g, '');
  if (!clean) return 0;
  
  if (clean.includes(',') && clean.includes('.')) {
    // Hangisi daha sonda?
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      // 1.200,00
      clean = clean.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // 1,200.00
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // 1200,00
    clean = clean.replace(/,/g, '.');
  }
  return parseFloat(clean) || 0;
};

const rows = [];
const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
let trMatch;
while ((trMatch = trRegex.exec(htmlContent)) !== null) {
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

const extractAmount = (keywords, excludeKeywords = []) => {
  for (const tds of rows) {
    const labelCell = tds[tds.length - 2];
    const amountCell = tds[tds.length - 1];
    
    // Check if labelCell matches keywords
    const matchesKeyword = keywords.some(k => new RegExp(k, 'i').test(labelCell));
    const matchesExclude = excludeKeywords.some(k => new RegExp(k, 'i').test(labelCell));
    
    if (matchesKeyword && !matchesExclude) {
      return parseAmount(amountCell);
    }
  }
  return 0;
};

console.log('Tutar:', extractAmount(['Ödenecek Tutar', 'Genel Toplam']));
console.log('Matrah:', extractAmount(['Mal Hizmet Toplam', 'Tevkifata Tabi İşlem Tutarı']));
console.log('KDV:', extractAmount(['Hesaplanan KDV'], ['Tevkifat', 'Tevkifata Tabi', 'İade']));
console.log('Tevkifat:', extractAmount(['KDV Tevkifat']));
console.log('Stopaj:', extractAmount(['STOPAJ']));

