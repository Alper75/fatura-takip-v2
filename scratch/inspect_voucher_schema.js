import soap from 'soap';

async function testQueryVoucher() {
  const client = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  const d = client.describe().VoucherIntegration.BasicHttpBinding_IVoucherIntegration.QueryVoucherList;
  console.log('QueryVoucherList Input description:');
  console.dir(d, { depth: 10 });
}

testQueryVoucher();
