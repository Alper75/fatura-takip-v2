import soap from 'soap';

async function testAttributes() {
  const voucherClient = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  
  voucherClient.on('request', (xml) => {
    console.log('=== GENERATED XML ===\n', xml);
  });

  const bDate = '2026-07-01T00:00:00';
  const eDate = '2026-07-31T23:59:59';

  console.log('--- Test 1: attributes property ---');
  try {
    await voucherClient.QueryVoucherListAsync({
      context: {
        attributes: {
          PageIndex: 0,
          PageSize: 500
        },
        DocumentStartDate: bDate,
        DocumentEndDate: eDate
      }
    });
  } catch (err) {
    console.log('Test 1 error:', err.message);
  }
}

testAttributes();
