import { ElogoClient } from './api/services/elogoClient.js';
import { readFileSync } from 'fs';

async function run() {
  const elogo = new ElogoClient();
  await elogo.login();
  
  // fetch recent invoices
  const invoices = await elogo.getDocumentList('RECV', { limit: 200 });
  if (invoices && invoices.data && invoices.data.document) {
    const docs = Array.isArray(invoices.data.document) ? invoices.data.document : [invoices.data.document];
    const vodafoneDocs = docs.filter(d => {
       const party = d.document?.Invoice?.AccountingSupplierParty?.Party;
       const name = party?.PartyName?.Name?.['#text'] || party?.PartyName?.Name || party?.Person?.FirstName;
       return name && name.toLowerCase().includes('vodaf');
    });
    
    if (vodafoneDocs.length > 0) {
       for (const vodafoneDoc of vodafoneDocs) {
         console.log('Found Vodafone doc:', vodafoneDoc.documentUuid);
         const docRes = await elogo.getDocument(vodafoneDoc.documentUuid);
         const inv = docRes.data?.document?.document?.Invoice;
         const taxTotal = inv['TaxTotal'];
         console.log(JSON.stringify(taxTotal, null, 2));
       }
    } else {
       console.log('No vodafone invoice found in last 200.');
    }
  } else {
    console.log("Could not fetch invoices", invoices);
  }
}

run().catch(console.error);
