const htmlContent = `<td align='right' width='211px' class='lineTableBudgetTd'><span style='font-weight:bold;'>Hesaplanan KDV(%20)</span></td><td align='right' style='width:82px;' class='lineTableBudgetTd'> 4.000,00 TL</td>`;
const regex = /(?:Hesaplanan\s*KDV)[\s\S]*?<\/td>\s*<td[^>]*>[^\d]*([\d\.,]+)[\s\S]*?<\/td>/i;
const match = htmlContent.match(regex);
console.log(match ? match[1] : 'NOT FOUND');
