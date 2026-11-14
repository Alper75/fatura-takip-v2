import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// api/utils/shared.js -> api/uploads
const apiDir = path.resolve(__dirname, '..');
const isVercel = process.env.VERCEL;
export const uploadsDir = isVercel ? '/tmp/uploads' : path.join(apiDir, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

export const upload = multer({ storage });

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
});

// JSON.stringify undefined değerleri yoksaydığı için, req.body'den gelen undefined'ları null'a çevirir
// SQLite TypeError fırlatmasını (Bind parameter is undefined) engeller.
export const n = (val) => {
  if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) return null;
  return val;
};
