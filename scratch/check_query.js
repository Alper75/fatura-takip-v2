import 'dotenv/config';
import { client } from '../api/db.js';
import { ElogoClient } from '../api/services/elogoClient.js';
import { XMLParser } from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import fs from 'fs';

async function test() {
  const companyId = 6;
  const settingsRes = await client.execute({
    sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
    args: [companyId]
  });
  const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
  
  const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
  const docDataRes = await elogo.getDocumentData('f29859df-4962-4de3-bfcc-c027b2ca3296');
  
  if (!docDataRes.success) {
    console.log("Failed to get doc data", docDataRes);
    return;
  }
  
  const base64Data = docDataRes.data.document.binaryData.Value;
  const buffer = Buffer.from(base64Data, 'base64');
  
  let xmlString = '';
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) { // ZIP
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const xmlEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.xml'));
    if (xmlEntry) {
      xmlString = xmlEntry.getData().toString('utf8');
    }
  } else {
    xmlString = buffer.toString('utf8');
  }
  
  fs.writeFileSync('test_invoice.xml', xmlString);
  
  const ublParser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const parsed = ublParser.parse(xmlString);
  const inv = parsed.Invoice;
  
  console.log("TaxTotal structure:");
  console.dir(inv.TaxTotal, { depth: null });
}

test();
