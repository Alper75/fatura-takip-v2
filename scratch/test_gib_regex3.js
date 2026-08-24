const htmlContent = `
<tr align="right"><td></td><td align="right" width="200px" class="lineTableBudgetTd"><span style="font-weight:bold; ">&#214;denecek Tutar</span></td><td align="right" style="width:82px; " class="lineTableBudgetTd">19.800,00 TL</td></tr>
<tr align="right">
  <td></td>
  <td align="right"><span style="font-weight:bold;">Hesaplanan KDV(%20)</span></td>
  <td>% 20</td>
  <td align="right">4.000,00 TL</td>
</tr>
`;

const extractAmountByRow = (labelRegexStr) => {
  const rowRegex = new RegExp(`<tr[^>]*>[\\s\\S]*?(?:${labelRegexStr})[\\s\\S]*?<\\/tr>`, 'i');
  const rowMatch = htmlContent.match(rowRegex);
  if (!rowMatch) return 'NOT_FOUND';

  const rowHtml = rowMatch[0];
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let lastNumber = 'NOT_FOUND';
  
  let tdMatch;
  while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
    const tdContent = tdMatch[1];
    // try to find a number in this td
    const numMatch = tdContent.match(/[^\d]*([\d\.,]+)/);
    if (numMatch && numMatch[1]) {
      // make sure it's not just a single digit like "20" if there's a larger amount, 
      // actually we just take the LAST valid number we see in the row!
      lastNumber = numMatch[1];
    }
  }
  return lastNumber;
};

console.log('Tutar:', extractAmountByRow('denecek\\s*Tutar|Genel\\s*Toplam'));
console.log('KDV:', extractAmountByRow('Hesaplanan\\s*KDV'));
