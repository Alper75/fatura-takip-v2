import soap from 'soap';

async function testSoap() {
  const url = 'https://efatura.uyumsoft.com.tr/Services/Integration?wsdl';
  const client = await soap.createClientAsync(url);
  const desc = client.describe();
  
  // Navigate to GetInboxInvoiceList
  const methodDesc = desc.Integration.BasicHttpBinding_IIntegration.GetInboxInvoiceList;
  console.log('GetInboxInvoiceList method description:');
  console.log(JSON.stringify(methodDesc, null, 2));
}

testSoap();
