import soap from 'soap';

async function inspectUyumsoftWsdl() {
  const client = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/Integration?wsdl');
  const d = client.describe().Integration.BasicHttpBinding_IIntegration;
  console.log('GetInboxInvoiceList input:', d.GetInboxInvoiceList.input);
  console.log('GetOutboxInvoiceList input:', d.GetOutboxInvoiceList.input);

  const voucherClient = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl');
  const vd = voucherClient.describe().VoucherIntegration.BasicHttpBinding_IVoucherIntegration;
  console.log('QueryVoucherList input:', vd.QueryVoucherList.input);
  console.log('QueryInboxVoucherList input:', vd.QueryInboxVoucherList?.input);
}

inspectUyumsoftWsdl();
