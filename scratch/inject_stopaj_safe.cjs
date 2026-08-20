const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

// We only want to target the occurrences that are inside the fetchInvoiceDetails functions.
// We can do this by splitting the code by "const fetchInvoiceDetails" and modifying only the chunks.

let chunks = code.split('const fetchInvoiceDetails = async (doc) => {');

// The first chunk is everything before the first fetchInvoiceDetails
for (let i = 1; i < chunks.length; i++) {
  let chunk = chunks[i];

  // Apply the replacements to this chunk
  const decTarget = `let kdvTutari = 0;
        let kdvOrani = 0;
        let oivTutari = 0;`;
  const decRep = `let kdvTutari = 0;
        let kdvOrani = 0;
        let oivTutari = 0;
        let stopajTutari = 0;
        let stopajOrani = 0;
        let tevkifatTutari = 0;
        let tevkifatOrani = 0;`;
  chunk = chunk.replace(decTarget, decRep);

  const loopTarget = `if (taxCode === '0015' || taxCode === '15' || taxCode === 15 || !taxCode) {
              kdvTutari += amount;
              kdvOrani = percent; 
            } else {
              oivTutari += amount;
            }`;
  const loopRep = `if (taxCode === '0015' || taxCode === '15' || taxCode === 15 || !taxCode) {
              kdvTutari += amount;
              kdvOrani = percent; 
            } else if (taxCode === '0003' || String(taxCode).includes('Stopaj')) {
              stopajTutari += amount;
              stopajOrani = percent;
            } else {
              oivTutari += amount;
            }`;
  chunk = chunk.replace(loopTarget, loopRep);

  const withhTarget = `const lines = inv['InvoiceLine'];`;
  const withhRep = `const withholdingTaxTotal = inv['WithholdingTaxTotal'];
        const withhTotalArray = Array.isArray(withholdingTaxTotal) ? withholdingTaxTotal : (withholdingTaxTotal ? [withholdingTaxTotal] : []);
        for (const wt of withhTotalArray) {
          const subtotals = wt['TaxSubtotal'];
          if (!subtotals) continue;
          const subArr = Array.isArray(subtotals) ? subtotals : [subtotals];
          for (const sub of subArr) {
             const taxCat = sub['TaxCategory'];
             const taxScheme = taxCat?.['TaxScheme']?.['TaxTypeCode']?.['#text'] || taxCat?.['TaxScheme']?.['TaxTypeCode'];
             const taxCode = getText(taxScheme);
             const percent = parseFloat(getText(sub['Percent'])) || parseFloat(getText(taxCat?.['Percent'])) || 0;
             const amount = parseFloat(getText(sub['TaxAmount'])) || 0;
             
             if (taxCode === '0003' || String(taxCode).includes('Stopaj')) {
                stopajTutari += amount;
                stopajOrani = percent;
             } else {
                tevkifatTutari += amount;
                tevkifatOrani = percent;
             }
          }
        }
        
        const lines = inv['InvoiceLine'];`;
  chunk = chunk.replace(withhTarget, withhRep);

  const retTarget = `          kdvTutari,
          oivTutari,
          faturaAciklama`;
  const retRep = `          kdvTutari,
          oivTutari,
          stopajOrani,
          stopajTutari,
          tevkifatOrani,
          tevkifatTutari,
          faturaAciklama`;
  chunk = chunk.replace(retTarget, retRep);

  chunks[i] = chunk;
}

code = chunks.join('const fetchInvoiceDetails = async (doc) => {');

fs.writeFileSync('api/index.js', code, 'utf8');
console.log('Done replacing api/index.js (safe version)');
