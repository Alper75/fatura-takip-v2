const fatura = require('fatura');
console.log('Fatura keys:', Object.keys(fatura));
if (fatura.Invoice) console.log('Invoice class found');
if (fatura.createInvoiceAndGetHTML) console.log('createInvoiceAndGetHTML function found');
