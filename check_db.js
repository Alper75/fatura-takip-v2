import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://fatura-alper75.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ5NTAwMDgsImlkIjoiMDE5ZDQzNDItZmMwMS03MDE0LTkwMmUtYWI2ODlhM2E1ZTNhIiwicmlkIjoiMTQxMjQwNzItZjFhNS00MGY2LThiZDItMjAxOTg5YWQwNDc3In0.Sf5y6Bq-WBJGdjiqnjUn2JaBYkI6PfiObzWOZTa0rmB7HTtmwqT_4PPUb24ObXOIRqhmVkzx1i0SZdtykL8PCA'
});

async function check() {
  try {
    const folders = await client.execute('SELECT * FROM company_folders');
    console.log('Folders:', folders.rows);
    
    const files = await client.execute('SELECT id, name, folder_id, size FROM company_files');
    console.log('Files:', files.rows);
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
