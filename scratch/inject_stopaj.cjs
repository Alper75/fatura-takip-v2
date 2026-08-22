const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

// Replace the declaration block
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
code = code.split(decTarget).join(decRep);

// Replace the tax loop
const loopTarget = `if (taxCode === '0015' || taxCode === '15' || taxCode === 15 || !taxCode) {
              kdvTutari += amount;
              kdvOrani = percent; 
            } else {
              oivTutari += amount;
            }`;
const loopRep = `if (taxCode === '0015' || taxCode === '15' || taxCode === 15 || !taxCode) {
              kdvTutari += amount;
              kdvOrani = percent; 
            } else if (taxCode === '0003') {
              stopajTutari += amount;
              stopajOrani = percent;
            } else {
              oivTutari += amount;
            }`;
code = code.split(loopTarget).join(loopRep);

// Inject WithholdingTaxTotal after TaxTotal loop
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
code = code.split(withhTarget).join(withhRep);

// Update return block
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
code = code.split(retTarget).join(retRep);

// There is one edge case in uyumsoft/gelen-faturalar which uses `kdv1, kdv10, kdv20` etc. but we're targeting fetchInvoiceDetails specifically, which uses `kdvTutari` etc.

fs.writeFileSync('api/index.js', code, 'utf8');
console.log('Done replacing api/index.js');
