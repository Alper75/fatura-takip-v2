import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '.gib_session_cache.json');

/**
 * GİB e-Arşiv Portal Oturum Yöneticisi
 * - Tek oturum kuralı olan GİB sisteminde aynı anda birden fazla login yapılmasını engeller.
 * - Token'ları hafızada ve diskte önbelleğe alarak art arda (toplu) fatura gönderimlerinde
 *   her faturada tekrar login/logout yapılmasının önüne geçer (oturum kilitlenmesini engeller).
 * - "Açık oturum / Güvenli çıkış yapmalısınız" hatası alındığında önceki token ile
 *   otomatik çıkış (self-healing logout) yapıp tekrar bağlanmayı dener.
 * - 90 saniye işlem yapılmadığında arka planda güvenli çıkış yaparak GİB hesabını açık bırakmaz.
 */
class GibSessionManager {
  constructor() {
    this.sessions = new Map(); // key: `${env}:${username}`, value: { token, createdAt, lastUsed, env, username, timer }
    this.inactivityTtlMs = 90 * 1000; // 90 saniye hareketsizlikte otomatik çıkış
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const data = JSON.parse(raw);
        const now = Date.now();
        for (const [key, item] of Object.entries(data)) {
          // 15 dakikadan yeni token'ları geri yükle
          if (item && item.token && (now - (item.createdAt || 0) < 15 * 60 * 1000)) {
            this.sessions.set(key, {
              token: item.token,
              createdAt: item.createdAt || now,
              lastUsed: item.lastUsed || now,
              env: item.env || 'PROD',
              username: item.username || '',
              timer: null
            });
          }
        }
      }
    } catch (e) {
      console.warn('[GibSessionManager] Cache okuma hatası:', e.message);
    }
  }

  saveToDisk() {
    try {
      const serializable = {};
      for (const [key, item] of this.sessions.entries()) {
        serializable[key] = {
          token: item.token,
          createdAt: item.createdAt,
          lastUsed: item.lastUsed,
          env: item.env,
          username: item.username
        };
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(serializable, null, 2), 'utf8');
    } catch (e) {
      console.warn('[GibSessionManager] Cache yazma hatası:', e.message);
    }
  }

  getKey(env, username) {
    return `${env || 'PROD'}:${String(username || '').trim()}`;
  }

  scheduleAutoLogout(client, key, username, token, env = 'PROD') {
    const existing = this.sessions.get(key);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(async () => {
      console.log(`[GibSessionManager] ${username} için ${this.inactivityTtlMs / 1000}s hareketsizlik doldu, güvenli çıkış yapılıyor...`);
      try {
        await this.forceLogout(client, username, env);
      } catch (err) {
        console.warn(`[GibSessionManager] Otomatik çıkış hatası (${username}):`, err.message);
      }
    }, this.inactivityTtlMs);

    if (timer.unref) timer.unref();

    if (existing) {
      existing.timer = timer;
    }
  }

  /**
   * Kullanıcı için geçerli bir token getirir veya login yapar.
   * Eğer oturum kilitli uyarısı alınırsa hafızadaki/diskteki eski token ile
   * çıkış yapıp tekrar login olmayı dener.
   */
  async getSessionToken(client, username, password, env = 'PROD') {
    const cleanUser = String(username || '').trim();
    const key = this.getKey(env, cleanUser);
    const existing = this.sessions.get(key);
    const now = Date.now();

    // 1. Zaten geçerli, aktif ve 10 dakikadan taze bir token varsa doğrudan kullan
    if (existing && existing.token && (now - existing.createdAt < 10 * 60 * 1000)) {
      existing.lastUsed = now;
      this.scheduleAutoLogout(client, key, cleanUser, existing.token, env);
      this.saveToDisk();
      return existing.token;
    }

    // 2. Yeni token al
    let token = null;
    try {
      token = await client.getToken(cleanUser, password);
    } catch (err) {
      const msg = String(err.message || '').toLowerCase();
      const isSessionConflict = msg.includes('güvenli çıkış') || 
                                msg.includes('birden fazla giriş') || 
                                msg.includes('açık oturum') || 
                                msg.includes('daha önce') ||
                                msg.includes('oturum bulunmaktadır');

      if (isSessionConflict) {
        console.warn(`[GibSessionManager] ${cleanUser} için oturum kilitli! Otomatik güvenli çıkış deneniyor...`);
        // Eğer daha önce kaydedilmiş bir token varsa onunla GİB'den çıkış yapmayı dene
        const oldToken = existing?.token;
        if (oldToken) {
          try {
            await client.logout(oldToken);
            console.log(`[GibSessionManager] Eski token (${oldToken.substring(0, 8)}...) ile çıkış iletildi. 1.5 sn bekleniyor...`);
            await new Promise(r => setTimeout(r, 1500));
            // Çıkıştan sonra login'i bir kez daha dene
            token = await client.getToken(cleanUser, password);
            console.log(`[GibSessionManager] Otomatik kurtarma başarılı! Yeni token alındı.`);
          } catch (retryErr) {
            console.warn('[GibSessionManager] Otomatik kurtarma retry başarısız:', retryErr.message);
          }
        }
      }

      if (!token) {
        if (isSessionConflict) {
          throw new Error('GİB sisteminde açık bir oturumunuz bulunmaktadır. Sistem otomatik güvenli çıkış yapmayı denedi fakat kilit devam ediyor olabilir. Lütfen ekrandaki "GİB Güvenli Çıkış Yap" butonuna tıklayın veya portala erişebilmek için yaklaşık 15 dakika bekleyin.');
        }
        throw err;
      }
    }

    // 3. Token'ı kaydet ve zamanlayıcıyı başlat
    this.sessions.set(key, {
      token,
      createdAt: now,
      lastUsed: now,
      env,
      username: cleanUser,
      timer: null
    });
    this.scheduleAutoLogout(client, key, cleanUser, token, env);
    this.saveToDisk();

    return token;
  }

  /**
   * Belirtilen kullanıcı için güvenli çıkış yapar ve token'ı temizler.
   */
  async forceLogout(client, username, env = 'PROD') {
    const cleanUser = String(username || '').trim();
    const key = this.getKey(env, cleanUser);
    const existing = this.sessions.get(key);

    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    let loggedOut = false;
    let tokenUsed = existing?.token;

    if (tokenUsed) {
      try {
        await client.logout(tokenUsed);
        loggedOut = true;
        console.log(`[GibSessionManager] ${cleanUser} için GİB'den güvenli çıkış yapıldı.`);
      } catch (e) {
        console.warn(`[GibSessionManager] Logout çağrısı sırasında hata (${cleanUser}):`, e.message);
      }
    }

    this.sessions.delete(key);
    this.saveToDisk();

    return {
      success: true,
      loggedOut,
      message: loggedOut 
        ? 'GİB portalından güvenli çıkış başarıyla tamamlandı. Artık tekrar işlem yapabilir veya portala girebilirsiniz.' 
        : 'Sistemdeki açık oturum kaydı temizlendi. GİB oturumları en geç 15 dakika içinde otomatik zaman aşımına uğrar.'
    };
  }

  invalidate(username, env = 'PROD') {
    const cleanUser = String(username || '').trim();
    const key = this.getKey(env, cleanUser);
    const existing = this.sessions.get(key);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }
    this.sessions.delete(key);
    this.saveToDisk();
    console.log(`[GibSessionManager] ${cleanUser} için oturum token'ı geçersiz kılındı (invalidate).`);
  }

  hasActiveSession(username, env = 'PROD') {
    const key = this.getKey(env, username);
    const existing = this.sessions.get(key);
    if (!existing || !existing.token) return false;
    return (Date.now() - existing.createdAt < 12 * 60 * 1000);
  }
}

export const gibSessionManager = new GibSessionManager();
