import * as XLSX from 'xlsx';

// Test reading CSV with semicolon delimiter
const csvContent = `Makbuz No;Doküman No;Belge Tarihi;Oluşturulma Tarihi;Alıcı VKN/TCKN;Alıcı;Ödenecek Tutar;Toplam Vergi;Para Birimi;Toplam KDV Matrah;Toplam KDV;Toplam Stopaj Matrah;Toplam Stopaj;Toplam Tevkifat Tutarı;Brüt Toplam;Net Ücret;Makbuz Durumu;
SMM2026000000272;7a9a18f9-68d0-4d13-8ed1-5f30b2844acb;01.07.2026 08:22:00;01.07.2026 08:23:24;'3020556222;DOGA SİGORTA A.Ş.;1401,22;560,48;TRY;1401,22;280,24;1401,22;280,24;0,00;1401,22;1120,98;İmzalandı;
SMM2026000000314;be65e676-6ab8-460d-a20c-140d8108864a;31.07.2026 09:22:00;31.07.2026 09:22:12;'7620269371;SEREN ASFALT NAKLİYE İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ;2802,44;467,07;TRY;2335,37;467,07;0,00;0,00;0,00;2335,37;2335,37;İmzalandı;`;

const buf = Buffer.from(csvContent, 'utf8');

console.log('--- Test 1: XLSX.read with type: "buffer" ---');
const wb = XLSX.read(buf, { type: 'buffer', raw: false, cellDates: false });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
console.log('Parsed rows:', rows);
