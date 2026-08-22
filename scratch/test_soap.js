import soap from 'soap';

async function test() {
  const client = await soap.createClientAsync('https://pb-demo.elogo.com.tr/PostboxService.svc?singlewsdl');
  const description = client.describe();
  const binding = Object.keys(description.PostBoxService)[0];
  console.log(JSON.stringify(description.PostBoxService[binding].GetDocumentData, null, 2));
}
test();
