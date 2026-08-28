import soap from 'soap';

async function testCreationSartDate() {
  const voucherClient = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  
  voucherClient.on('request', (xml) => {
    console.log('=== GENERATED XML ===\n', xml);
  });

  const bDate = '2026-07-01T00:00:00';
  const eDate = '2026-07-31T23:59:59';

  console.log('--- Test CreationSartDate ---');
  try {
    await voucherClient.QueryVoucherListAsync({
      context: {
        attributes: {
          PageIndex: 0,
          PageSize: 500
        },
        CreationSartDate: bDate,
        CreationEndDate: eDate
      }
    });
  } catch (err) {
    console.log('CreationSartDate error:', err.message);
  }
}

testCreationSartDate();
