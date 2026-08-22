import { createClient } from '@libsql/client';
import 'dotenv/config';

async function test() {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  const client = url ? createClient({
    url: url,
    authToken: authToken,
  }) : null;
  
  try {
    const res = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='company_settings'");
    console.log(res.rows[0].sql);
  } catch (error) {
    console.error('Error:', error);
  }
}
test();
