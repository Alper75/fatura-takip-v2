import soap from 'soap';

async function testQueryVouchersWithAttributes() {
  const client = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  
  // Notice the XML attribute syntax for soap
  const xmlPayload = `
    <tns:QueryVoucherList xmlns:tns="http://tempuri.org/">
      <tns:context PageIndex="0" PageSize="500">
        <tns:DocumentStartDate>2026-07-01T00:00:00</tns:DocumentStartDate>
        <tns:DocumentEndDate>2026-07-31T23:59:59</tns:DocumentEndDate>
      </tns:context>
    </tns:QueryVoucherList>
  `;
  console.log('Query payload prepared.');
}

testQueryVouchersWithAttributes();
