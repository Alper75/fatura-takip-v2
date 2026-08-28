import soap from 'soap';

async function testUyumsoftPaginationLogic() {
  console.log('Testing Uyumsoft Voucher Pagination loop logic...');
  const voucherClient = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  
  // WSDL Inspection of attributes
  const d = voucherClient.describe().VoucherIntegration.BasicHttpBinding_IVoucherIntegration.QueryVoucherList;
  console.log('QueryVoucherList Output description:', d.output);
}

testUyumsoftPaginationLogic();
