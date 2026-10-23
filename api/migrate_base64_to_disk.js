import 'dotenv/config';
import { runBase64DiskMigration } from './services/migrateBase64Files.js';

runBase64DiskMigration({ logProgress: true })
  .then((res) => {
    console.log('Migration sonucu:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration hatası:', err);
    process.exit(1);
  });
