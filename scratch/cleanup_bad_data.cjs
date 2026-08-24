const { client } = require('../api/db.js');

async function main() {
  // Stopaj oranı 100 veya tevkifat oranı anormal olan faturaları bul
  const rs = await client.execute("SELECT id, fatura_no, matrah, kdv_tutari, stopaj_orani, stopaj_tutari, tevkifat_orani, tevkifat_tutari, alinan_ucret FROM satis_faturalari WHERE stopaj_orani = '100' OR tevkifat_orani LIKE '%10000%'");
  console.log('Hatalı faturalar:', JSON.stringify(rs.rows, null, 2));
  
  for (const row of rs.rows) {
    console.log(`Siliniyor: ${row.id} (${row.fatura_no})`);
    await client.execute({ sql: 'DELETE FROM satis_faturalari WHERE id = ?', args: [row.id] });
  }
  
  console.log('Toplam silinen:', rs.rows.length);
}

main().catch(console.error);
