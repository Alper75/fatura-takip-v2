const htmlContent = `<table width='800px' table-layout='fixed' id='budgetContainerTable'><tbody><tr><td valign='top' align='right'><table><tbody><tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Mal Hizmet Toplam Tutar</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>20.000,00 TL</td></tr><tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Toplam skonto</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>0,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KV. STOPAJI(%15)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 3.000,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KDV(%20)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 4.000,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Hesaplanan KDV Tevkifat(%30)</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'> 1.200,00 TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi Ylem Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>20.000,00TL</td></tr><tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi Ylem ozerinden Hes. KDV</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>4.000,00TL</td></tr><tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Vergiler Dahil Toplam Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>24.000,00 TL</td></tr><tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>-denecek Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>19.800,00 TL</td></tr></tbody></table></td></tr></tbody></table>`;

let debugRegexMatches = {};
const extractAmount = (label) => {
  const regex = new RegExp(`(?:\\s*${label}\\s*)[\\s\\S]*?<\\/td>\\s*<td[^>]*>([^<]+)<\\/td>`, 'i');
  const match = htmlContent.match(regex);
  
  let lastNumber = 'NOT_FOUND';
  
  if (match && match[1]) {
     const numMatch = match[1].match(/[^\d]*([\d\.,]+)/);
     if (numMatch && numMatch[1]) {
       lastNumber = numMatch[1];
     }
  } else {
     const inlineRegex = new RegExp(`(?:\\s*${label}\\s*)[^\d]*([\d\.,]+)`, 'i');
     const inlineMatch = htmlContent.match(inlineRegex);
     if (inlineMatch && inlineMatch[1]) {
        lastNumber = inlineMatch[1];
     }
  }

  debugRegexMatches[label] = lastNumber;

  if (lastNumber !== 'NOT_FOUND') {
    let str = lastNumber.trim();
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else if (str.includes(',')) {
      str = str.replace(/,/g, '.');
    }
    return parseFloat(str) || 0;
  }
  return 0;
};

console.log('Tutar:', extractAmount('denecek\\s*Tutar|Genel\\s*Toplam'));
console.log('Matrah:', extractAmount('Mal\\s*Hizmet\\s*Toplam\\s*Tutar[ıi]|Tevkifata\\s*Tabi\\s*İşlem\\s*Tutar[ıi]'));
console.log('KDV:', extractAmount('Hesaplanan\\s*KDV(?!\\s*Tevkifat)'));
console.log('Tevkifat:', extractAmount('KDV\\s*Tevkifat'));
console.log('Stopaj:', extractAmount('STOPAJ'));
console.log(debugRegexMatches);
