const htmlContent = `<table width='800px' table-layout='fixed' id='budgetContainerTable'><tbody><tr><td valign='top' align='right'><table><tbody><tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Mal Hizmet Toplam Tutarı</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>20.000,00 TL</td></tr><tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Toplam İskonto</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>0,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KV. STOPAJI(%15)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 3.000,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KDV(%20)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 4.000,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Hesaplanan KDV Tevkifat(%30)</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'> 1.200,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi İşlem Tutarı</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>20.000,00TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi İşlem Üzerinden Hes. KDV</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>4.000,00TL</td></tr><tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Vergiler Dahil Toplam Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>24.000,00 TL</td></tr><tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Ödenecek Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>19.800,00 TL</td></tr></tbody></table></td></tr></tbody></table>`;

const extractAmount = (label) => {
  const rowRegex = new RegExp(`<tr[^>]*>[\\s\\S]*?(?:${label})[\\s\\S]*?<\\/tr>`, 'i');
  const rowMatch = htmlContent.match(rowRegex);
  if (!rowMatch) return 0;
  
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let lastNumber = 'NOT_FOUND';
  let tdMatch;
  while ((tdMatch = tdRegex.exec(rowMatch[0])) !== null) {
    const numMatch = tdMatch[1].match(/[^\d]*([\d\.,]+)/);
    if (numMatch && numMatch[1]) lastNumber = numMatch[1];
  }
  
  if (lastNumber !== 'NOT_FOUND') {
    let str = lastNumber.trim();
    if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(/,/g, '.');
    else if (str.includes(',')) str = str.replace(/,/g, '.');
    return parseFloat(str) || 0;
  }
  return 0;
};

console.log('Tutar:', extractAmount('denecek\\s*Tutar|Genel\\s*Toplam'));
console.log('Matrah:', extractAmount('Mal\\s*Hizmet\\s*Toplam\\s*Tutar[ıi]|Tevkifata\\s*Tabi\\s*İşlem\\s*Tutar[ıi]'));
console.log('KDV:', extractAmount('Hesaplanan\\s*KDV(?!\\s*Tevkifat)'));
console.log('Tevkifat:', extractAmount('KDV\\s*Tevkifat'));
console.log('Stopaj:', extractAmount('STOPAJ'));
