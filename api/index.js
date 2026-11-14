import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { telegramBotService } from './services/telegramBot.js';
import { autoInvoiceFetcher } from './services/autoInvoiceFetcher.js';
import { runBase64DiskMigration } from './services/migrateBase64Files.js';
import { client, initDb } from './db.js';
import { uploadsDir } from './utils/shared.js';

import authRoutes from './routes/authRoutes.js';
import hrRoutes from './routes/hrRoutes.js';
import cariBankRoutes from './routes/cariBankRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import integratorRoutes from './routes/integratorRoutes.js';
import stokRoutes from './routes/stokRoutes.js';
import teklifSiparisRoutes from './routes/teklifSiparisRoutes.js';
import mutabakatRoutes from './routes/mutabakatRoutes.js';
import lucaAiCompanyRoutes from './routes/lucaAiCompanyRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We now call initDb() automatically to ensure the new 'status' column is added.
initDb()
  .then(() => {
    autoInvoiceFetcher.startScheduler();
  })
  .catch(e => console.error('Startup DB Init Error:', e));

// BigInt Serialization Fix for LibSQL
BigInt.prototype.toJSON = function() { return this.toString(); };

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Global Error Catch for Startup Failures
app.use((req, res, next) => {
  if (!client) {
    return res.status(500).json({
      success: false,
      message: 'Vercel Ayarı Eksik: TURSO_URL tanımlı değil.',
      error: 'Lütfen Vercel Dashboard > Project Settings > Environment Variables kısmından TURSO_URL ve TURSO_AUTH_TOKEN eklediğinizden ve projenizi "Redeploy" ettiğinizden emin olun.'
    });
  }
  next();
});

// Modular API Routers
app.use(authRoutes);
app.use(hrRoutes);
app.use(cariBankRoutes);
app.use(invoiceRoutes);
app.use(integratorRoutes);
app.use(stokRoutes);
app.use(teklifSiparisRoutes);
app.use(mutabakatRoutes);
app.use(lucaAiCompanyRoutes);

app.use('/uploads', express.static(uploadsDir));

// Frontend Production build dosyalarını sun (Google Cloud / Standalone için)
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    // Eksik .js / .css / /assets/ dosyaları için index.html döndürme (MIME hatasını önle)
    if (req.path.startsWith('/assets/') || /\.(js|css|map|woff2?|png|jpe?g|svg|ico)$/i.test(req.path)) {
      return res.status(404).send('Asset not found');
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Vercel serverless ortamında dinlemez, Google Cloud / Local ortamda dinler
const PORT = process.env.PORT || 5000;
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('--------------------------------------------------');
    console.log(`🚀 FATURA APP ÇALIŞIYOR: http://0.0.0.0:${PORT}`);
    console.log('--------------------------------------------------');

    // Sunucu ayağa kalktığında aktif Telegram Bot'u otomatik başlat
    (async () => {
      try {
        const rs = await client.execute({
          sql: `SELECT company_id, setting_key, setting_value FROM company_settings 
                WHERE setting_key IN ('telegram_bot_token', 'telegram_bot_enabled', 'telegram_allowed_chat_ids', 'telegram_target_mode') 
                ORDER BY company_id DESC`
        });
        const compMap = {};
        for (const row of rs.rows) {
          if (!compMap[row.company_id]) compMap[row.company_id] = {};
          compMap[row.company_id][row.setting_key] = row.setting_value;
        }
        for (const [compId, cfg] of Object.entries(compMap)) {
          if (cfg.telegram_bot_enabled === 'true' && cfg.telegram_bot_token) {
            const allowedArr = cfg.telegram_allowed_chat_ids ? cfg.telegram_allowed_chat_ids.split(',').map(s => s.trim()).filter(Boolean) : [];
            await telegramBotService.start(Number(compId), cfg.telegram_bot_token, {
              allowedChatIds: allowedArr,
              targetMode: cfg.telegram_target_mode || 'alis_faturasi'
            });
            console.log(`[TelegramBot] Sunucu başlangıcında Bot otomatik başlatıldı (Company ID: ${compId})`);
            break;
          }
        }
      } catch (err) {
        console.warn('[TelegramBot] Otomatik başlatma uyarısı:', err.message);
      }
    })();

    // Sunucu ayağa kalktıktan 2 saniye sonra arka planda Base64 migration'ı çalıştır
    setTimeout(() => {
      runBase64DiskMigration({ logProgress: true }).catch(err => {
        console.error('[Base64Migration] Otomatik taşıma hatası:', err.message);
      });
    }, 2000);
  });
}

export default app;
