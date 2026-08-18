import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

async function parseWSDL() {
  const { data } = await axios.get('https://efatura.uyumsoft.com.tr/Services/Integration?wsdl');
  console.log('WSDL Length:', data.length);
  // Just print the lines containing GetInboxInvoiceListResult
  const lines = data.split('\n');
  for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('GetInboxInvoiceList')) {
       console.log(lines[i].trim());
    }
  }
}
parseWSDL();
