import soap from 'soap';

async function testSoap() {
  try {
    const url = 'https://efatura-test.uyumsoft.com.tr/Services/Integration?wsdl';
    const client = await soap.createClientAsync(url);
    
    // Set up a mock security
    const wsSecurity = new soap.WSSecurity('dummy_user', 'dummy_pass', {
      hasTimeStamp: false,
      hasTokenCreated: false
    });
    client.setSecurity(wsSecurity);

    const args = {
      query: {
        CreateStartDate: '2026-07-19T00:00:00',
        CreateEndDate: '2026-08-18T23:59:59',
        PageIndex: 0,
        PageSize: 100
      }
    };

    client.on('request', (xml) => {
        console.log('REQUEST XML:\n', xml);
    });

    try {
      await client.GetInboxInvoiceListAsync(args);
    } catch (err) {
      console.log('Error caught (expected):', err.message);
      if (err.root && err.root.Envelope) {
         console.log(JSON.stringify(err.root.Envelope.Body.Fault, null, 2));
      }
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSoap();
