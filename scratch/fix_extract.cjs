const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

const regex = /parsedData\.kdvTutari = extractAmount\('Hesaplanan\\\\s\*KDV\(\?!\\\\s\*Tevkifat\)'\);.*?\n\s*parsedData\.tevkifatTutari = extractAmount\('KDV\\\\s\*Tevkifat'\);\n\s*parsedData\.stopajTutari = extractAmount\('STOPAJ'\);/s;

const replacement = `      parsedData.tutar = extractAmount(['Ödenecek Tutar', 'Genel Toplam']);
      parsedData.matrah = extractAmount(['Mal Hizmet Toplam', 'Tevkifata Tabi İşlem Tutarı']);
      parsedData.kdvTutari = extractAmount(['Hesaplanan KDV'], ['Tevkifat', 'Tevkifata Tabi', 'İade']);
      parsedData.tevkifatTutari = extractAmount(['KDV Tevkifat']);
      parsedData.stopajTutari = extractAmount(['STOPAJ']);`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('api/index.js', code);
  console.log('Fixed successfully');
} else {
  console.log('Regex did not match');
}
