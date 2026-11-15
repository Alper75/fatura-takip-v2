import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { authMiddleware } from '../auth.js';
import { stockSyncService } from '../services/stockSyncService.js';
import { n } from '../utils/shared.js';

const ensureId = (id) => id || uuidv4();

const router = express.Router();

router.get('/api/stok/kritik-seviyedekiler', authMiddleware, async (req, res) => {
  try {
    const list = await stockSyncService.getCriticalProducts(req.user.companyId);
    res.json({ success: true, data: list });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});


router.get('/api/stok/kategoriler', authMiddleware, async (req, res) => {
  try {
    const companyId = n(req.user?.companyId);
    const rs = await client.execute({
      sql: `SELECT * FROM stok_kategoriler 
            WHERE company_id = ? OR (? IS NULL AND company_id IS NULL)
            ORDER BY ad ASC`,
      args: [companyId, companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/stok/kategoriler', authMiddleware, async (req, res) => {
  const { id, ad } = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO stok_kategoriler (id, ad, company_id) VALUES (?, ?, ?)',
      args: [ensureId(id), ad, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/stok/kategoriler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM stok_kategoriler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Products
router.get('/api/stok/urunler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `SELECT id, stok_kodu as stokKodu, barkod, urun_adi as urunAdi, 
            kategori_id as kategoriId, ana_birim as anaBirim, minimum_stok as minimumStok, 
            maksimum_stok as maksimumStok, lot_takibi as lotTakibi, 
            son_kullanma_tarihli as sonKullanma_tarihli, aktif, birim_fiyat as birimFiyat, aciklama 
            FROM stok_urunler WHERE company_id = ? ORDER BY urun_adi ASC`,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/stok/urunler', authMiddleware, async (req, res) => {
  const u = req.body;
  try {
    await client.execute({
      sql: `INSERT INTO stok_urunler (
        id, stok_kodu, barkod, urun_adi, kategori_id, ana_birim, 
        minimum_stok, maksimum_stok, lot_takibi, son_kullanma_tarihli, 
        aktif, birim_fiyat, aciklama, company_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ensureId(u.id), n(u.stokKodu), n(u.barkod), n(u.urunAdi), n(u.kategoriId), n(u.anaBirim) || 'Adet',
        u.minimumStok || 0, n(u.maksimumStok), u.lotTakibi ? 1 : 0, (u.sonKullanma_tarihli || u.sonKullanmaTarihli) ? 1 : 0,
        u.aktif !== false ? 1 : 0, u.birimFiyat || 0, n(u.aciklama), req.user.companyId
      ]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/stok/urunler/:id', authMiddleware, async (req, res) => {
  const u = req.body;
  try {
    await client.execute({
      sql: `UPDATE stok_urunler SET 
        stok_kodu = ?, barkod = ?, urun_adi = ?, kategori_id = ?, ana_birim = ?, 
        minimum_stok = ?, maksimum_stok = ?, lot_takibi = ?, son_kullanma_tarihli = ?, 
        aktif = ?, birim_fiyat = ?, aciklama = ?
        WHERE id = ? AND company_id = ?`,
      args: [
        n(u.stokKodu), n(u.barkod), n(u.urunAdi), n(u.kategoriId), n(u.anaBirim) || 'Adet',
        u.minimumStok || 0, n(u.maksimumStok), u.lotTakibi ? 1 : 0, (u.sonKullanma_tarihli || u.sonKullanmaTarihli) ? 1 : 0,
        u.aktif !== false ? 1 : 0, u.birimFiyat || 0, n(u.aciklama),
        req.params.id, req.user.companyId
      ]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/stok/urunler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM stok_urunler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Ürüne ait Alış ve Satış Fatura Detayları & Tedarikçi Analizi
router.get('/api/stok/urunler/:id/faturalar', authMiddleware, async (req, res) => {
  const urunId = req.params.id;
  const companyId = req.user.companyId;

  try {
    // 1. Ürün bilgilerini çek
    const uRs = await client.execute({
      sql: `SELECT id, stok_kodu as stokKodu, barkod, urun_adi as urunAdi, ana_birim as anaBirim, birim_fiyat as birimFiyat, minimum_stok as minimumStok 
            FROM stok_urunler WHERE id = ? AND company_id = ?`,
      args: [urunId, companyId]
    });

    if (uRs.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
    }
    const urun = uRs.rows[0];
    const urunAdi = String(urun.urunAdi || '').trim();

    // 2. Alış Faturaları (Tedarikçiden Alımlar)
    const alisRs = await client.execute({
      sql: `SELECT DISTINCT
              a.id as faturaId,
              a.fatura_no as faturaNo,
              a.fatura_tarihi as faturaTarihi,
              COALESCE(a.tedarikci_adi, 'Belirtilmemiş Tedarikçi') as tedarikciAdi,
              a.tedarikci_vkn as tedarikciVkn,
              a.mal_hizmet_adi as malHizmetAdi,
              a.toplam_tutar as faturaToplamTutar,
              a.matrah as faturaMatrah,
              a.kdv_orani as kdvOrani,
              a.kdv_tutari as kdvTutari,
              a.odeme_durumu as odemeDurumu,
              a.pdf_dosya as pdfDosya,
              h.id as hareketId,
              h.miktar,
              h.birim_fiyat as birimFiyat,
              h.tutar as hareketTutar,
              h.tarih as hareketTarihi,
              d.ad as depoAdi
            FROM alis_faturalari a
            LEFT JOIN stok_hareketler h ON h.bagli_fatura_id = a.id AND h.urun_id = ? AND h.tip = 'GIRIS'
            LEFT JOIN stok_depolar d ON h.depo_id = d.id
            WHERE a.company_id = ?
              AND (
                h.id IS NOT NULL
                OR a.urun_id = ?
                OR (a.mal_hizmet_adi IS NOT NULL AND LOWER(a.mal_hizmet_adi) LIKE LOWER(?))
                OR (a.aciklama IS NOT NULL AND LOWER(a.aciklama) LIKE LOWER(?))
              )
            ORDER BY COALESCE(a.fatura_tarihi, h.tarih) DESC`,
      args: [urunId, companyId, urunId, `%${urunAdi}%`, `%${urunAdi}%`]
    });

    // 3. Satış Faturaları (Müşteriye Satışlar)
    const satisRs = await client.execute({
      sql: `SELECT DISTINCT
              s.id as faturaId,
              s.fatura_no as faturaNo,
              s.fatura_tarihi as faturaTarihi,
              TRIM(COALESCE(s.ad, '') || ' ' || COALESCE(s.soyad, '')) as musteriAdi,
              s.tc_vkn as musteriVkn,
              s.alinan_ucret as faturaToplamTutar,
              s.matrah as faturaMatrah,
              s.kdv_orani as kdvOrani,
              s.kdv_tutari as kdvTutari,
              s.aciklama,
              s.odeme_durumu as odemeDurumu,
              s.pdf_dosya as pdfDosya,
              h.id as hareketId,
              h.miktar,
              h.birim_fiyat as birimFiyat,
              h.tutar as hareketTutar,
              h.tarih as hareketTarihi,
              d.ad as depoAdi
            FROM satis_faturalari s
            LEFT JOIN stok_hareketler h ON h.bagli_fatura_id = s.id AND h.urun_id = ? AND h.tip = 'CIKIS'
            LEFT JOIN stok_depolar d ON h.depo_id = d.id
            WHERE s.company_id = ?
              AND (
                h.id IS NOT NULL
                OR s.urun_id = ?
                OR (s.aciklama IS NOT NULL AND LOWER(s.aciklama) LIKE LOWER(?))
              )
            ORDER BY COALESCE(s.fatura_tarihi, h.tarih) DESC`,
      args: [urunId, companyId, urunId, `%${urunAdi}%`]
    });

    // 4. İstatistik ve Tedarikçi Özeti Hesapla
    let toplamAlisMiktari = 0;
    let toplamAlisTutari = 0;
    let minAlisFiyati = Infinity;
    let maxAlisFiyati = 0;
    const tedarikciMap = {};

    const alisFaturalari = alisRs.rows.map(row => {
      const miktar = parseFloat(row.miktar) || 1;
      const birimFiyat = parseFloat(row.birimFiyat) || (parseFloat(row.faturaMatrah) ? parseFloat(row.faturaMatrah) / miktar : parseFloat(row.faturaToplamTutar) / miktar) || 0;
      const tutar = parseFloat(row.hareketTutar) || (miktar * birimFiyat) || parseFloat(row.faturaToplamTutar) || 0;

      toplamAlisMiktari += miktar;
      toplamAlisTutari += tutar;

      if (birimFiyat > 0) {
        if (birimFiyat < minAlisFiyati) minAlisFiyati = birimFiyat;
        if (birimFiyat > maxAlisFiyati) maxAlisFiyati = birimFiyat;
      }

      const tedAd = row.tedarikciAdi || 'Bilinmeyen Firma';
      if (!tedarikciMap[tedAd]) {
        tedarikciMap[tedAd] = {
          tedarikciAdi: tedAd,
          tedarikciVkn: row.tedarikciVkn || '',
          faturaSayisi: 0,
          toplamMiktar: 0,
          toplamTutar: 0,
          sonTarih: row.faturaTarihi || '',
          sonBirimFiyat: birimFiyat
        };
      }
      tedarikciMap[tedAd].faturaSayisi += 1;
      tedarikciMap[tedAd].toplamMiktar += miktar;
      tedarikciMap[tedAd].toplamTutar += tutar;

      return {
        ...row,
        hesaplananMiktar: miktar,
        hesaplananBirimFiyat: birimFiyat,
        hesaplananTutar: tutar
      };
    });

    const ortalamaAlisFiyati = toplamAlisMiktari > 0 ? (toplamAlisTutari / toplamAlisMiktari) : 0;
    const tedarikciler = Object.values(tedarikciMap).sort((a, b) => b.toplamTutar - a.toplamTutar);

    let toplamSatisMiktari = 0;
    let toplamSatisTutari = 0;
    const satisFaturalari = satisRs.rows.map(row => {
      const miktar = parseFloat(row.miktar) || 1;
      const birimFiyat = parseFloat(row.birimFiyat) || (parseFloat(row.faturaMatrah) ? parseFloat(row.faturaMatrah) / miktar : parseFloat(row.faturaToplamTutar) / miktar) || 0;
      const tutar = parseFloat(row.hareketTutar) || (miktar * birimFiyat) || parseFloat(row.faturaToplamTutar) || 0;

      toplamSatisMiktari += miktar;
      toplamSatisTutari += tutar;

      return {
        ...row,
        hesaplananMiktar: miktar,
        hesaplananBirimFiyat: birimFiyat,
        hesaplananTutar: tutar
      };
    });

    res.json({
      success: true,
      data: {
        urun,
        istatistik: {
          toplamAlisMiktari,
          toplamAlisTutari,
          ortalamaAlisFiyati,
          minAlisFiyati: minAlisFiyati === Infinity ? 0 : minAlisFiyati,
          maxAlisFiyati,
          alisFaturaSayisi: alisFaturalari.length,
          toplamSatisMiktari,
          toplamSatisTutari,
          satisFaturaSayisi: satisFaturalari.length,
          anaTedarikci: tedarikciler[0] || null,
          enSonAlis: alisFaturalari[0] || null
        },
        tedarikciler,
        alisFaturalari,
        satisFaturalari
      }
    });
  } catch (e) {
    console.error('Stok fatura detayları hatası:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Warehouses
router.get('/api/stok/depolar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM stok_depolar WHERE company_id = ? ORDER BY kod ASC',
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/stok/depolar', authMiddleware, async (req, res) => {
  const d = req.body;
  try {
    if (d.varsayilan) {
      await client.execute({
        sql: 'UPDATE stok_depolar SET varsayilan = 0 WHERE company_id = ?',
        args: [req.user.companyId]
      });
    }
    await client.execute({
      sql: 'INSERT INTO stok_depolar (id, kod, ad, varsayilan, aktif, adres, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [ensureId(d.id), d.kod, d.ad, d.varsayilan ? 1 : 0, d.aktif !== false ? 1 : 0, d.adres || null, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/stok/depolar/:id', authMiddleware, async (req, res) => {
  const d = req.body;
  try {
    if (d.varsayilan) {
      await client.execute({
        sql: 'UPDATE stok_depolar SET varsayilan = 0 WHERE company_id = ?',
        args: [req.user.companyId]
      });
    }
    await client.execute({
      sql: 'UPDATE stok_depolar SET kod = ?, ad = ?, varsayilan = ?, aktif = ?, adres = ? WHERE id = ? AND company_id = ?',
      args: [d.kod, d.ad, d.varsayilan ? 1 : 0, d.aktif !== false ? 1 : 0, d.adres || null, req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/stok/depolar/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM stok_depolar WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Movements
router.get('/api/stok/hareketler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `SELECT id, urun_id as urunId, depo_id as depoId, tip, miktar, 
            birim_fiyat as birimFiyat, tutar, tarih, aciklama, 
            referans_no as referansNo, iptal
            FROM stok_hareketler WHERE company_id = ? ORDER BY tarih DESC`,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/stok/hareketler', authMiddleware, async (req, res) => {
  const h = req.body;
  console.log('[Stok API] Hareket Kaydı İsteği:', JSON.stringify(h, null, 2));
  try {
    const companyId = n(req.user?.companyId) || 1;
    
    if (h.tip === 'TRANSFER') {
      const transId1 = uuidv4();
      const transId2 = uuidv4();
      const refNo = n(h.referansNo) || n(h.referans) || `TRA-${Date.now().toString().slice(-6)}`;
      
      const stmts = [
        {
          sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, lot_no, son_kullanma_tarihi, company_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            n(transId1), n(h.urunId), n(h.depoId), 'TRANSFER_CIKIS', n(h.miktar) || 0, 
            n(h.birimFiyat) || 0, n(h.tutar) || 0, n(h.tarih) || new Date().toISOString(), 
            n(h.aciklama), n(refNo), n(h.lotNo), n(h.sonKullanmaTarihi), companyId
          ]
        },
        {
          sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, lot_no, son_kullanma_tarihi, company_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            n(transId2), n(h.urunId), n(h.hedefDepoId), 'TRANSFER_GIRIS', n(h.miktar) || 0, 
            n(h.birimFiyat) || 0, n(h.tutar) || 0, n(h.tarih) || new Date().toISOString(), 
            n(h.aciklama), n(refNo), n(h.lotNo), n(h.sonKullanmaTarihi), companyId
          ]
        }
      ];
      console.log('[Stok API] Transfer Batch Strt:' , JSON.stringify(stmts, null, 2));
      await client.batch(stmts, "write");
    } else {
      const args = [
        ensureId(h.id), n(h.urunId), n(h.depoId), n(h.tip), n(h.miktar) || 0, 
        n(h.birimFiyat) || 0, n(h.tutar) || 0, n(h.tarih) || new Date().toISOString(), 
        n(h.aciklama), n(h.referansNo) || n(h.referans), n(h.lotNo), 
        n(h.sonKullanmaTarihi), n(h.bagliFaturaId), companyId
      ];
      console.log('[Stok API] Normal Hareket Args:', args);

      await client.execute({
        sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, birim_fiyat, tutar, tarih, aciklama, referans_no, lot_no, son_kullanma_tarihi, bagli_fatura_id, company_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: args
      });
    }
    res.json({ success: true });
  } catch (e) { 
    console.error('[Stok API] Hata:', e);
    res.status(500).json({ success: false, message: e.message }); 
  }
});

// Inventory Sessions (Sayım)
router.get('/api/stok/sayimlar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `SELECT id, depo_id as depoId, tarih, durum, onay_tarihi as onayTarihi, 
            onaylayan_kullanici as onaylayanKullanici, aciklama
            FROM stok_sayimlar WHERE company_id = ? ORDER BY tarih DESC`,
      args: [req.user.companyId]
    });
    res.json({ success: true, data: rs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/api/stok/sayimlar/:id', authMiddleware, async (req, res) => {
  try {
    const sayimRs = await client.execute({
      sql: `SELECT id, depo_id as depoId, tarih, durum, onay_tarihi as onayTarihi, 
            onaylayan_kullanici as onaylayanKullanici, aciklama
            FROM stok_sayimlar WHERE id = ? AND company_id = ?`,
      args: [req.params.id, req.user.companyId]
    });
    const kalemlerRs = await client.execute({
      sql: `SELECT id, sayim_id as sayimId, urun_id as urunId, 
            sistem_miktari as sistemMiktari, sayim_miktari as sayimMiktari, fark
            FROM stok_sayim_kalemler WHERE sayim_id = ? AND company_id = ?`,
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true, sayim: sayimRs.rows[0], kalemler: kalemlerRs.rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/stok/sayimlar/baslat', authMiddleware, async (req, res) => {
  const { depoId } = req.body;
  try {
    const sayimId = uuidv4();
    const now = new Date().toISOString();
    
    // 1. Create session
    await client.execute({
      sql: 'INSERT INTO stok_sayimlar (id, depo_id, tarih, durum, company_id) VALUES (?, ?, ?, ?, ?)',
      args: [sayimId, depoId, now, 'TASLAK', req.user.companyId]
    });

    // 2. Capture snapshot of all active products
    const urunlerRs = await client.execute({
      sql: 'SELECT id FROM stok_urunler WHERE aktif = 1 AND company_id = ?',
      args: [req.user.companyId]
    });

    const batch = urunlerRs.rows.map(u => {
      // For each product, calculate current stock in this warehouse
      return {
        sql: `INSERT INTO stok_sayim_kalemler (id, sayim_id, urun_id, sistem_miktari, sayim_miktari, company_id)
              SELECT ?, ?, ?, 
              COALESCE((SELECT SUM(CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS') THEN miktar ELSE -miktar END) 
               FROM stok_hareketler WHERE urun_id = ? AND depo_id = ? AND iptal = 0 AND company_id = ?), 0),
              COALESCE((SELECT SUM(CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS') THEN miktar ELSE -miktar END) 
               FROM stok_hareketler WHERE urun_id = ? AND depo_id = ? AND iptal = 0 AND company_id = ?), 0),
              ?`,
        args: [uuidv4(), sayimId, u.id, u.id, depoId, req.user.companyId, u.id, depoId, req.user.companyId, req.user.companyId]
      };
    });

    if (batch.length > 0) {
      await client.batch(batch, "write");
    }

    res.json({ success: true, id: sayimId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/stok/sayimlar/kalem-kaydet', authMiddleware, async (req, res) => {
  const { kalemId, sayimMiktari } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE stok_sayim_kalemler SET sayim_miktari = ? WHERE id = ? AND company_id = ?',
      args: [sayimMiktari, kalemId, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/stok/sayimlar/onayla', authMiddleware, async (req, res) => {
  const { id, kullanici } = req.body;
  try {
    const sayimRs = await client.execute({
      sql: 'SELECT * FROM stok_sayimlar WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    const sayim = sayimRs.rows[0];
    if (!sayim) return res.status(404).json({ success: false, message: 'Sayım kaydı bulunamadı.' });
    if (sayim.durum !== 'TASLAK') return res.status(400).json({ success: false, message: 'Bu sayım zaten onaylanmış.' });

    const kalemlerRs = await client.execute({
      sql: 'SELECT * FROM stok_sayim_kalemler WHERE sayim_id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });

    const movements = [];
    const now = new Date().toISOString();
    const refNo = `SAYIM-${Date.now().toString().slice(-6)}`;

    for (const k of kalemlerRs.rows) {
      const diff = k.sayim_miktari - k.sistem_miktari;
      if (diff !== 0) {
        movements.push({
          sql: `INSERT INTO stok_hareketler (id, urun_id, depo_id, tip, miktar, tarih, aciklama, referans_no, company_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [uuidv4(), k.urun_id, sayim.depo_id, diff > 0 ? 'SAYIM_GIRIS' : 'SAYIM_CIKIS', Math.abs(diff), now, 'SAYIM SONUCU DÜZELTME', refNo, req.user.companyId]
        });
      }
    }

    movements.push({
      sql: 'UPDATE stok_sayimlar SET durum = ?, onaylayan_kullanici = ? WHERE id = ? AND company_id = ?',
      args: ['ONAYLANDI', kullanici || 'Admin', id, req.user.companyId]
    });

    await client.batch(movements, "write");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Analytics
router.get('/api/stok/analiz', authMiddleware, async (req, res) => {
  try {
    const compId = req.user.companyId;

    // 1. Get all products and categories
    const urunlerRs = await client.execute({
      sql: 'SELECT * FROM stok_urunler WHERE aktif = 1 AND company_id = ?',
      args: [compId]
    });
    const kategorilerRs = await client.execute({
      sql: 'SELECT * FROM stok_kategoriler WHERE company_id = ?',
      args: [compId]
    });
    const hareketlerRs = await client.execute({
      sql: "SELECT * FROM stok_hareketler WHERE iptal = 0 AND company_id = ?",
      args: [compId]
    });

    const urunler = urunlerRs.rows;
    const kategoriler = kategorilerRs.rows;
    const hareketler = hareketlerRs.rows;

    // 2. Calculation logic (similar to mock but on DB data)
    const productStocks = urunler.map(u => {
      const uMoves = hareketler.filter(h => h.urun_id === u.id);
      const totalAmount = uMoves.reduce((total, h) => {
        const isGiris = ['GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS'].includes(h.tip);
        return isGiris ? total + h.miktar : total - h.miktar;
      }, 0);

      const lastPurchase = uMoves.filter(h => h.tip === 'GIRIS').pop();
      const unitVal = lastPurchase?.birim_fiyat || u.birim_fiyat || 0;
      const totalVal = totalAmount * unitVal;

      return {
        id: u.id,
        urunAdi: u.urun_adi,
        stokKodu: u.stok_kodu,
        kategoriId: u.kategori_id,
        miktar: totalAmount,
        deger: totalVal,
        moveCount: uMoves.length,
        minStok: u.minimum_stok
      };
    });

    const totalValuation = productStocks.reduce((sum, p) => sum + p.deger, 0);

    const categoryDist = kategoriler.map(cat => {
      const catVal = productStocks.filter(p => p.kategoriId === cat.id).reduce((sum, p) => sum + p.deger, 0);
      return {
        id: cat.id,
        ad: cat.ad,
        deger: catVal,
        yuzde: totalValuation > 0 ? (catVal / totalValuation) * 100 : 0
      };
    });

    const topMovers = [...productStocks]
      .sort((a, b) => b.moveCount - a.moveCount)
      .slice(0, 5)
      .map(p => ({
        urunAdi: p.urunAdi,
        stokKodu: p.stokKodu,
        moveCount: p.moveCount,
        miktar: p.miktar
      }));

    res.json({
      success: true,
      data: {
        totalValuation,
        categoryDist,
        topMovers,
        criticalCount: productStocks.filter(p => p.miktar <= p.minStok).length
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Manual Database Initialization Route (For Migrations)

router.get('/api/stok/:id/history', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get history (Only inputs to see costs, e.g. GIRIS types)
    const historyRs = await client.execute({
      sql: 'SELECT tip, miktar, birim_fiyat, tarih FROM stok_hareketler WHERE urun_id = ? AND company_id = ? AND (tip = ? OR tip = ?) ORDER BY tarih DESC',
      args: [id, req.user.companyId, 'GIRIS', 'DEVIR']
    });
    
    // 2. Calculate remaining stock across all active inventory
    const totalRs = await client.execute({
      sql: "SELECT SUM(CASE WHEN tip IN ('GIRIS', 'TRANSFER_GIRIS', 'SAYIM_GIRIS', 'DEVIR') THEN miktar ELSE -miktar END) as kalan_stok FROM stok_hareketler WHERE urun_id = ? AND company_id = ? AND iptal = 0",
      args: [id, req.user.companyId]
    });
    
    const kalan_stok = totalRs.rows[0]?.kalan_stok || 0;
    
    res.json({ success: true, history: historyRs.rows, kalan_stok });
  } catch (e) {
    console.error("Stok History Error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});


export default router;
