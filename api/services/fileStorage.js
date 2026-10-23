import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const uploadsDir = path.resolve(__dirname, '..', 'uploads');

// Otomatik klasörleri hazırla
const folders = ['faturalar', 'fisler', 'dekontlar'];
for (const f of folders) {
  const p = path.join(uploadsDir, f);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

/**
 * Base64 veriyi sunucu diskine kaydeder ve erişim URL'ini (/uploads/...) döner.
 * Eğer veri zaten '/uploads/...' ile başlıyorsa veya URL ise doğrudan döner.
 */
export function saveBase64File(dataUriOrBase64, originalName = 'belge.pdf', folder = 'faturalar') {
  if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') return null;

  // Zaten URL ise tekrar kaydetme
  if (dataUriOrBase64.startsWith('/uploads/') || dataUriOrBase64.startsWith('http://') || dataUriOrBase64.startsWith('https://')) {
    return dataUriOrBase64;
  }

  try {
    let base64Data = dataUriOrBase64;
    let ext = 'pdf';

    const match = dataUriOrBase64.match(/^data:([a-zA-Z0-9\/+-]+)(?:;[^,]*)?;base64,(.+)$/s);
    if (match) {
      const mime = match[1].toLowerCase();
      base64Data = match[2];
      if (mime.includes('pdf')) ext = 'pdf';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('png')) ext = 'png';
      else if (mime.includes('xml')) ext = 'xml';
      else if (mime.includes('webp')) ext = 'webp';
    } else if (originalName && originalName.includes('.')) {
      ext = originalName.split('.').pop().toLowerCase();
    }

    const cleanBaseName = (originalName || `belge.${ext}`)
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .replace(new RegExp(`\\.${ext}$`, 'i'), '');

    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${cleanBaseName}.${ext}`;
    const targetDir = path.join(uploadsDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fullPath = path.join(targetDir, uniqueFileName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(fullPath, buffer);

    console.log(`[FileStorage] Dosya sunucu diskine kaydedildi: /uploads/${folder}/${uniqueFileName} (${buffer.length} byte)`);
    return `/uploads/${folder}/${uniqueFileName}`;
  } catch (error) {
    console.error('[FileStorage] Dosya kaydetme hatası:', error.message);
    return dataUriOrBase64; // Hata durumunda veriyi kaybetmemek için orijinalini dön
  }
}

/**
 * Buffer veriyi doğrudan sunucu diskine kaydeder.
 */
export function saveBufferFile(buffer, fileName = 'belge.pdf', folder = 'faturalar') {
  if (!buffer || !Buffer.isBuffer(buffer)) return null;

  try {
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'pdf';
    const cleanBaseName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(new RegExp(`\\.${ext}$`, 'i'), '');
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${cleanBaseName}.${ext}`;

    const targetDir = path.join(uploadsDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fullPath = path.join(targetDir, uniqueFileName);
    fs.writeFileSync(fullPath, buffer);

    console.log(`[FileStorage] Buffer sunucu diskine kaydedildi: /uploads/${folder}/${uniqueFileName} (${buffer.length} byte)`);
    return `/uploads/${folder}/${uniqueFileName}`;
  } catch (error) {
    console.error('[FileStorage] Buffer kaydetme hatası:', error.message);
    return null;
  }
}

/**
 * Metin/HTML içeriğini sunucu diskine kaydeder (Örn. GİB fatura HTML önbelleği)
 */
export function saveTextFile(content, fileName, folder = 'faturalar') {
  if (!content) return null;
  try {
    const targetDir = path.join(uploadsDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, content, 'utf8');
    return `/uploads/${folder}/${fileName}`;
  } catch (error) {
    console.error('[FileStorage] Metin dosyası kaydetme hatası:', error.message);
    return null;
  }
}

/**
 * Sunucu diskinde kayıtlı metin dosyasını okur
 */
export function getTextFileIfExists(fileName, folder = 'faturalar') {
  try {
    const fullPath = path.join(uploadsDir, folder, fileName);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
  } catch (e) {}
  return null;
}
