import soap from 'soap';

async function testSoapSerialization() {
  const voucherClient = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  
  const bDate = '2026-07-01T00:00:00';
  const eDate = '2026-07-31T23:59:59';

  // Test Case A: plain context with DocumentStartDate
  const argsA = {
    context: {
      DocumentStartDate: bDate,
      DocumentEndDate: eDate
    }
  };

  voucherClient.on('request', (xml) => {
    console.log('=== GENERATED SOAP XML ===\n', xml);
  });

  try {
    await voucherClient.QueryVoucherListAsync(argsA);
  } catch (err) {
    console.log('Error caught (expected if unauthenticated, but check XML):', err.message);
  }
}

testSoapSerialization();
