import soap from 'soap';

async function inspectUyumsoftWsdl() {
  const client = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/Integration?wsdl');
  console.log('--- Uyumsoft Integration Methods ---');
  console.log(JSON.stringify(client.describe().Integration.BasicHttpBinding_IIntegration, null, 2));

  const voucherClient = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  console.log('--- Uyumsoft VoucherIntegration Methods ---');
  console.log(JSON.stringify(voucherClient.describe().VoucherIntegration.BasicHttpBinding_IVoucherIntegration, null, 2));
}

inspectUyumsoftWsdl();
