import 'dotenv/config';
import { client } from '../api/db.js';
import { ElogoClient } from '../api/services/elogoClient.js';
import AdmZip from 'adm-zip';

async function testPdf2() {
  const companyId = 6;
  const settingsRes = await client.execute({
    sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
    args: [companyId]
  });
  const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
  
  const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
  const docDataRes = await elogo.getDocumentPdf('f29859df-4962-4de3-bfcc-c027b2ca3296');
  
  const base64Data = docDataRes.data.document.binaryData.Value;
  const buffer = Buffer.from(base64Data, 'base64');
  
  console.log("Buffer size:", buffer.length);
  console.log("First bytes:", buffer[0].toString(16), buffer[1].toString(16), buffer[2].toString(16), buffer[3].toString(16));
  
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
     console.log("It's a ZIP");
     const zip = new AdmZip(buffer);
     console.log("Entries:", zip.getEntries().map(e => e.entryName));
  }
}

testPdf2();
