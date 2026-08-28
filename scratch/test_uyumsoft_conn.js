import soap from 'soap';

async function testUyumsoft() {
  console.log('Testing Uyumsoft Test WSDL: https://efatura-test.uyumsoft.com.tr/Services/Integration?wsdl');
  try {
    const client = await soap.createClientAsync('https://efatura-test.uyumsoft.com.tr/Services/Integration?wsdl', { timeout: 10000 });
    console.log('Test WSDL Connected successfully!');
  } catch (err) {
    console.error('Test WSDL Connection error:', err.message);
  }

  console.log('\nTesting Uyumsoft Prod WSDL: https://efatura.uyumsoft.com.tr/Services/Integration?wsdl');
  try {
    const clientProd = await soap.createClientAsync('https://efatura.uyumsoft.com.tr/Services/Integration?wsdl', { timeout: 10000 });
    console.log('Prod WSDL Connected successfully!');
  } catch (err) {
    console.error('Prod WSDL Connection error:', err.message);
  }
}

testUyumsoft();
