import 'dotenv/config';
import { client } from '../api/db.js';
import { ElogoClient } from '../api/services/elogoClient.js';

async function testPdf() {
  const companyId = 6;
  const settingsRes = await client.execute({
    sql: 'SELECT setting_key, setting_value FROM company_settings WHERE company_id = ?',
    args: [companyId]
  });
  const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
  
  const elogo = new ElogoClient(settings.elogo_username, settings.elogo_password, settings.elogo_is_test === 'true');
  const docDataRes = await elogo.getDocumentPdf('f29859df-4962-4de3-bfcc-c027b2ca3296');
  
  console.log("PDF Response success:", docDataRes.success);
  if (!docDataRes.success) {
    console.log("Error:", docDataRes.message);
  } else {
    console.log("Got binaryData?");
    console.log(!!docDataRes.data?.document?.binaryData?.Value);
  }
}

testPdf();
