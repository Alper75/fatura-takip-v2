import { client } from './api/db.js';

async function run() {
  const res = await client.execute(`SELECT * FROM alis_faturalari WHERE tedarikci_adi LIKE '%VODAFONE%' ORDER BY fatura_tarihi DESC LIMIT 5`);
  console.log(res.rows);
}

run();
