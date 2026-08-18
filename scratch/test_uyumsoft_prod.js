import soap from 'soap';

async function testSoap() {
  try {
    const url = 'https://efatura.uyumsoft.com.tr/Services/Integration?wsdl';
    const client = await soap.createClientAsync(url, {
        ignoredNamespaces: {
            namespaces: ['targetNamespace', 'typedNamespace'],
            override: true
        }
    });
    
    if (client.wsdl) {
        const defaultXmlns = client.wsdl.xmlnsInEnvelope || '';
        let addXmlns = '';
        if (!defaultXmlns.includes('xmlns:ns1=')) addXmlns += ' xmlns:ns1="http://www.w3.org/2001/XMLSchema"';
        if (!defaultXmlns.includes('xmlns:ns2=')) addXmlns += ' xmlns:ns2="http://schemas.microsoft.com/2003/10/Serialization/"';
        client.wsdl.xmlnsInEnvelope = defaultXmlns + addXmlns;
    }

    const wsSecurity = new soap.WSSecurity('SerifEmir_WebServis', 'dummy_pass', {
      hasTimeStamp: false,
      hasTokenCreated: false
    });
    client.setSecurity(wsSecurity);

    let beginDate = '2026-07-19T00:00:00Z';
    let endDate = '2026-08-18T23:59:59Z';
    const args = {
        query: {
          CreateStartDate: beginDate.split('T')[0] + 'T00:00:00',
          CreateEndDate: endDate.split('T')[0] + 'T23:59:59',
          PageIndex: 0,
          PageSize: 100
        }
    };

    client.on('request', (xml) => {
        console.log('REQUEST XML:\n', xml);
    });
    
    client.on('response', (xml, response) => {
        console.log('RESPONSE STATUS:', response.status);
    });

    try {
      await client.GetInboxInvoiceListAsync(args);
      console.log('Success!');
    } catch (err) {
      console.log('Error caught (expected):', err.message);
      if (err.root && err.root.Envelope) {
         console.log('SOAP Fault:', JSON.stringify(err.root.Envelope.Body.Fault, null, 2));
      } else if (err.response) {
         console.log('Response body:', err.response.data);
      }
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSoap();
