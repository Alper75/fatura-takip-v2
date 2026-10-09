import { client } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { telegramBotService } from './telegramBot.js';

class StockSyncService {
  /**
   * Varsayılan depoyu bul veya oluştur
   */
  async getTargetDepo(companyId, preferredDepoId = null) {
    if (preferredDepoId) {
      const rs = await client.execute({
        sql: 'SELECT id FROM stok_depolar WHERE id = ? AND company_id = ? LIMIT 1',
        args: [preferredDepoId, companyId]
      });
      if (rs.rows.length > 0) return rs.rows[0].id;
    }

    // 1. Varsayılan depoyu ara
    const defRs = await client.execute({
      sql: 'SELECT id FROM stok_depolar WHERE company_id = ? AND varsayilan = 1 LIMIT 1',
      args: [companyId]
    });
    if (defRs.rows.length > 0) return defRs.rows[0].id;

    // 2. İlk depoyu ara
    const firstRs = await client.execute({
      sql: 'SELECT id FROM stok_depolar WHERE company_id = ? ORDER BY id ASC LIMIT 1',
      args: [companyId]
    });
    if (firstRs.rows.length > 0) return firstRs.rows[0].id;

    // 3. Hiç depo yoksa otomatik "Merkez Depo" oluştur
    const newDepoId = uuidv4();
    await client.execute({
      sql: `INSERT INTO stok_depolar (id, kod, ad, varsayilan, aktif, company_id) 
            VALUES (?, 'DEP01', 'Merkez Depo', 1, 1, ?)`,
      args: [newDepoId, companyId]
    });
    return newDepoId;
  }

  /**
   * Ürünü barkod, stok kodu veya ada göre eşle, yoksa otomatik oluştur
   */
  async matchOrCreateProduct(companyId, item) {
    if (item.urunId && item.urunId !== 'yok' && item.urunId !== '') {
      return item.urunId;
    }

    // 1. Barkod ile ara
    if (item.barcode) {
      const bRs = await client.execute({
        sql: 'SELECT id FROM stok_urunler WHERE company_id = ? AND barkod = ? LIMIT 1',
        args: [companyId, String(item.barcode).trim()]
      });
      if (bRs.rows.length > 0) return bRs.rows[0].id;
    }

    // 2. Stok Kodu ile ara
    if (item.stokKodu) {
      const kRs = await client.execute({
        sql: 'SELECT id FROM stok_urunler WHERE company_id = ? AND LOWER(stok_kodu) = LOWER(?) LIMIT 1',
        args: [companyId, String(item.stokKodu).trim()]
      });
      if (kRs.rows.length > 0) return kRs.rows[0].id;
    }

    // 3. Ürün Adı ile ara
    const name = String(item.name || item.urunAdi || item.aciklama || '').trim();
    if (name) {
      const nRs = await client.execute({
        sql: 'SELECT id FROM stok_urunler WHERE company_id = ? AND LOWER(urun_adi) = LOWER(?) LIMIT 1',
        args: [companyId, name]
      });
      if (nRs.rows.length > 0) return nRs.rows[0].id;
    }

    // 4. Bulunamadıysa otomatik yeni ürün aç
    const newId = uuidv4();
    const cleanName = name || 'İsimsiz Ürün';
    const autoCode = 'STK-' + Date.now().toString().slice(-6);
    const unitPrice = parseFloat(item.price || item.birimFiyat) || 0;

    await client.execute({
      sql: `INSERT INTO stok_urunler (
        id, stok_kodu, barkod, urun_adi, ana_birim, minimum_stok, aktif, birim_fiyat, company_id
      ) VALUES (?, ?, ?, ?, 'Adet', 5, 1, ?, ?)`,
      args: [newId, autoCode, item.barcode || null, cleanName, unitPrice, companyId]
    });

    console.log(`[StockSyncService] Otomatik yeni stok ürünü açıldı: ${cleanName} (${autoCode})`);
    return newId;
  }

  /**
   * Fatura için stok hareketlerini senkronize et (Alış -> GIRIS, Satış -> CIKIS)
   */
  async syncInvoiceStockMovements(companyId, { faturaId, faturaTipi, items, faturaNo, faturaTarihi, depoId }) {
    if (!faturaId || !Array.isArray(items) || items.length === 0) {
      return { success: true, processedCount: 0, criticalAlerts: [] };
    }

    const tip = faturaTipi === 'satis' ? 'CIKIS' : 'GIRIS';
    const desc = faturaTipi === 'satis' 
      ? `Satış Faturası (${faturaNo || ''}) - Otomatik Stok Çıkışı`
      : `Alış Faturası (${faturaNo || ''}) - Otomatik Stok Girişi`;

    // 1. Önceki hareketleri temizle (güncellemelerde çiftleme olmaması için)
    await client.execute({
      sql: 'DELETE FROM stok_hareketler WHERE bagli_fatura_id = ? AND company_id = ?',
      args: [faturaId, companyId]
    });

    // 2. Hedef depoyu belirle
    const targetDepoId = await this.getTargetDepo(companyId, depoId);
    const affectedProductIds = new Set();
    const dateStr = faturaTarihi || new Date().toISOString();

    // 3. Kalemleri stok hareketine dönüştür
    for (const item of items) {
      const urunId = await this.matchOrCreateProduct(companyId, item);
      if (!urunId) continue;

      const miktar = parseFloat(item.qty || item.miktar) || 1;
      const birimFiyat = parseFloat(item.price || item.birimFiyat) || 0;
      const tutar = miktar * birimFiyat;

      await client.execute({
        sql: `INSERT INTO stok_hareketler (
          id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, bagli_fatura_id, company_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          uuidv4(), urunId, targetDepoId, tip, miktar, birimFiyat, tutar, 
          dateStr, desc, faturaNo || null, faturaId, companyId
        ]
      });

      affectedProductIds.add(urunId);
    }

    // 4. Kritik stok seviyesi kontrolleri
    const criticalAlerts = [];
    for (const pId of affectedProductIds) {
      const alert = await this._checkProductCriticalThreshold(companyId, pId, faturaNo, faturaTipi);
      if (alert) criticalAlerts.push(alert);
    }

    return {
      success: true,
      processedCount: items.length,
      criticalAlerts
    };
  }

  /**
   * Bir ürünün mevcut stok bakiyesini hesapla ve kritik eşik altındaysa uyar
   */
  async _checkProductCriticalThreshold(companyId, urunId, faturaNo, faturaTipi) {
    try {
      const pRs = await client.execute({
        sql: 'SELECT id, stok_kodu, urun_adi, ana_birim, minimum_stok FROM stok_urunler WHERE id = ? AND company_id = ?',
        args: [urunId, companyId]
      });
      if (pRs.rows.length === 0) return null;
      const product = pRs.rows[0];
      const minStock = parseFloat(product.minimum_stok) || 0;

      // Net mevcut stok miktarı
      const bRs = await client.execute({
        sql: `SELECT COALESCE(SUM(
                CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS') THEN miktar 
                     ELSE -miktar END
              ), 0) as mevcut
              FROM stok_hareketler 
              WHERE urun_id = ? AND company_id = ? AND (iptal IS NULL OR iptal = 0)`,
        args: [urunId, companyId]
      });

      const currentStock = parseFloat(bRs.rows[0]?.mevcut || 0);

      if (currentStock <= minStock) {
        const alertId = 'su_' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
        await client.execute({
          sql: `INSERT INTO stok_uyarilar (id, company_id, urun_id, mevcut_stok, minimum_stok, tetikleyen_fatura_no, olusturma_tarihi)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [alertId, companyId, urunId, currentStock, minStock, faturaNo || null, new Date().toISOString()]
        }).catch(err => console.warn('Kritik stok uyarısı kaydetme hatası:', err.message));

        // Eğer satış faturası sonrası stoğun kritik eşiğin altına düşmesi söz konusu ise Telegram bildirimi gönder
        if (faturaTipi === 'satis') {
          await this._sendCriticalStockTelegramAlert(companyId, product, currentStock, minStock, faturaNo);
        }

        return {
          urunId: product.id,
          urunAdi: product.urun_adi,
          stokKodu: product.stok_kodu,
          mevcutStok: currentStock,
          minimumStok: minStock,
          birim: product.ana_birim || 'Adet'
        };
      }
    } catch (e) {
      console.warn('[StockSyncService] Kritik stok kontrol hatası:', e.message);
    }
    return null;
  }

  /**
   * Telegram üzerinden kritik stok uyarısı gönder
   */
  async _sendCriticalStockTelegramAlert(companyId, product, currentStock, minStock, faturaNo) {
    try {
      const compRs = await client.execute({
        sql: 'SELECT name FROM companies WHERE id = ?',
        args: [companyId]
      });
      const compName = compRs.rows[0]?.name || 'Şirketiniz';

      const unit = product.ana_birim || 'Adet';
      const statusIcon = currentStock <= 0 ? '🔴 TÜKENDİ' : '⚠️ KRİTİK SEVİYE';

      const msg = `🚨 *KRİTİK STOK UYARISI!*\n` +
        `🏢 *Firma:* ${compName}\n` +
        `📦 *Ürün:* *${product.urun_adi}* (\`${product.stok_kodu}\`)\n` +
        `📊 *Durum:* ${statusIcon}\n` +
        `🔻 *Kalan Stok:* *${currentStock} ${unit}*\n` +
        `🛑 *Asgari Eşik (Minimum):* ${minStock} ${unit}\n` +
        `📄 *Tetikleyen Belge:* ${faturaNo ? `Fatura \`${faturaNo}\`` : 'Stok Çıkışı'}\n\n` +
        `⚡ _Tedarikçiye yeni sipariş oluşturulması tavsiye edilir._`;

      await telegramBotService.broadcast(msg);
    } catch (e) {
      console.warn('[StockSyncService] Telegram kritik stok bildirim hatası:', e.message);
    }
  }

  /**
   * Tüm kritik seviyedeki ürünleri listele
   */
  async getCriticalProducts(companyId) {
    const pRs = await client.execute({
      sql: `SELECT id, stok_kodu as stokKodu, barkod, urun_adi as urunAdi, 
                   ana_birim as anaBirim, minimum_stok as minimumStok, birim_fiyat as birimFiyat
            FROM stok_urunler 
            WHERE company_id = ? AND aktif = 1`,
      args: [companyId]
    });

    const products = pRs.rows;
    if (products.length === 0) return [];

    // Tüm hareketleri çekip ürün bazında bakiyeleri hesapla
    const hRs = await client.execute({
      sql: `SELECT urun_id, 
                   SUM(CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS') THEN miktar ELSE -miktar END) as bakiye
            FROM stok_hareketler 
            WHERE company_id = ? AND (iptal IS NULL OR iptal = 0)
            GROUP BY urun_id`,
      args: [companyId]
    });

    const balanceMap = new Map();
    for (const h of hRs.rows) {
      balanceMap.set(h.urun_id, parseFloat(h.bakiye) || 0);
    }

    const criticalList = [];
    for (const p of products) {
      const minStock = parseFloat(p.minimumStok) || 0;
      const currentStock = balanceMap.get(p.id) || 0;

      if (currentStock <= minStock) {
        criticalList.push({
          id: p.id,
          stokKodu: p.stokKodu,
          barkod: p.barkod,
          urunAdi: p.urunAdi,
          anaBirim: p.anaBirim || 'Adet',
          minimumStok: minStock,
          mevcutStok: currentStock,
          fark: Math.max(0, minStock - currentStock),
          birimFiyat: parseFloat(p.birimFiyat) || 0,
          durum: currentStock <= 0 ? 'tukenmis' : 'kritik'
        });
      }
    }

    return criticalList.sort((a, b) => a.mevcutStok - b.mevcutStok);
  }
}

export const stockSyncService = new StockSyncService();
