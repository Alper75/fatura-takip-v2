const htmlContent = `
<tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Mal Hizmet Toplam Tutarı</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>20.000,00 TL</td></tr>
<tr align='right'><td></td><td width='200px' align='right' class='lineTableBudgetTd'><span style='font-weight:bold; '>Toplam İskonto</span></td><td align='right' style='width:81px; ' class='lineTableBudgetTd'>0,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KV. STOPAJI(%15)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 3.000,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KDV(%20)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 4.000,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Hesaplanan KDV Tevkifat(%30)</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'> 1.200,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi İşlem Tutarı</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>20.000,00TL</td></tr>
<tr align='right'><td></td><td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Tevkifata Tabi İşlem Üzerinden Hes. KDV</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>4.000,00TL</td></tr>
<tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Vergiler Dahil Toplam Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>24.000,00 TL</td></tr>
<tr align='right'><td></td><td align='right' width='200px' class='lineTableBudgetTd'><span style='font-weight:bold; '>Ödenecek Tutar</span></td><td align='right' style='width:82px; ' class='lineTableBudgetTd'>19.800,00 TL</td></tr>
`;

const extractAmountOLD = (label) => {
  const rowRegex = new RegExp(`<tr[^>]*>[\\s\\S]*?(?:${label})[\\s\\S]*?<\\/tr>`, 'i');
  const rowMatch = htmlContent.match(rowRegex);
  if (!rowMatch) return 0;

  const rowHtml = rowMatch[0];
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let lastNumber = 'NOT_FOUND';
  
  let tdMatch;
  while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
    const tdContent = tdMatch[1];
    const numMatch = tdContent.match(/[^\d]*([\d\.,]+)/);
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

console.log("OLD KDV:", extractAmountOLD('Hesaplanan\\s*KDV(?!\\s*Tevkifat)'));
console.log("OLD STOPAJ:", extractAmountOLD('STOPAJ'));
