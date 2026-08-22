const xml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soap:Body><Login xmlns="http://tempuri.org/"><login><appStr xmlns="http://schemas.datacontract.org/2004/07/eFaturaWebService">fatura-takip-v2</appStr><passWord xmlns="http://schemas.datacontract.org/2004/07/eFaturaWebService">7575Alper.7575</passWord><source xmlns="http://schemas.datacontract.org/2004/07/eFaturaWebService">fatura-takip</source><userName xmlns="http://schemas.datacontract.org/2004/07/eFaturaWebService">7340640131ad</userName><version xmlns="http://schemas.datacontract.org/2004/07/eFaturaWebService">1.0</version></login></Login></soap:Body></soap:Envelope>`;

async function test() {
  const res = await fetch('https://pb.elogo.com.tr/PostBoxService.svc', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://tempuri.org/IPostBoxService/Login"',
      'User-Agent': 'node-soap/1.10.0'
    },
    body: xml
  });
  console.log(res.status, res.statusText);
  console.log(await res.text());
}
test();
