import * as XLSX from 'xlsx';

function parseCsvDirectly(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  
  // Determine delimiter: semicolon ';' or comma ',' or tab '\t'
  const headerLine = lines[0];
  let delimiter = ';';
  if (headerLine.includes(';') && (headerLine.split(';').length > headerLine.split(',').length)) {
    delimiter = ';';
  } else if (headerLine.includes(',')) {
    delimiter = ',';
  } else if (headerLine.includes('\t')) {
    delimiter = '\t';
  }

  // Simple CSV parser supporting quotes
  const parseLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(headerLine).map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 0 || values.every(v => v === '')) continue;
    const rowObj = {};
    headers.forEach((header, idx) => {
      if (header) {
        rowObj[header] = (values[idx] || '').replace(/^["']|["']$/g, '').trim();
      }
    });
    rows.push(rowObj);
  }

  return rows;
}

const sampleCsv = `Makbuz No;Doküman No;Belge Tarihi;Oluşturulma Tarihi;Alıcı VKN/TCKN;Alıcı;Ödenecek Tutar;Toplam Vergi;Para Birimi;Toplam KDV Matrah;Toplam KDV;Toplam Stopaj Matrah;Toplam Stopaj;Toplam Tevkifat Tutarı;Brüt Toplam;Net Ücret;Makbuz Durumu;
SMM2026000000272;7a9a18f9-68d0-4d13-8ed1-5f30b2844acb;01.07.2026 08:22:00;01.07.2026 08:23:24;'3020556222;DOGA SİGORTA A.Ş.;1401,22;560,48;TRY;1401,22;280,24;1401,22;280,24;0,00;1401,22;1120,98;İmzalandı;
SMM2026000000314;be65e676-6ab8-460d-a20c-140d8108864a;31.07.2026 09:22:00;31.07.2026 09:22:12;'7620269371;SEREN ASFALT NAKLİYE İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ;2802,44;467,07;TRY;2335,37;467,07;0,00;0,00;0,00;2335,37;2335,37;İmzalandı;`;

const parsed = parseCsvDirectly(sampleCsv);
console.log('Result of direct CSV parser:');
console.log(parsed.map(r => ({
  faturaNo: r['Makbuz No'],
  belgeTarihi: r['Belge Tarihi'],
  alici: r['Alıcı'],
  tutar: r['Ödenecek Tutar']
})));
