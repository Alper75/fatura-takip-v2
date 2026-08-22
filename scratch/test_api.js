import jwt from 'jsonwebtoken';
import 'dotenv/config';

const token = jwt.sign(
  { id: 1, tc: 'admin', role: 'super_admin', companyId: 1 },
  process.env.JWT_SECRET || 'gizli_anahtar',
  { expiresIn: '24h' }
);

async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/elogo/gelen-faturalar', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(await res.text());
  } catch (error) {
    console.error('Error:', error);
  }
}
test();
