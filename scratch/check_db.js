import { createClient } from '@libsql/client';
import 'dotenv/config';

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  try {
    const rs = await client.execute('SELECT * FROM banka_hesaplari');
    console.log('--- BANKA HESAPLARI ---');
    console.log(rs.rows);

    const rs2 = await client.execute('SELECT count(*) as cnt FROM cari_hareketler');
    console.log('--- CARI HAREKETLER COUNT ---');
    console.log(rs2.rows);
  } catch (e) {
    console.error(e);
  }
}
run();
