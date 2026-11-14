import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { XMLParser } from 'fast-xml-parser';
import { client } from '../db.js';
import { authMiddleware } from '../auth.js';
import { xmlParser, n } from '../utils/shared.js';

const router = express.Router();

router.post('/api/reconciliation/batch-close', authMiddleware, async (req, res) => {
  const { matches } = req.body; // Array of { hareketId, faturaId, faturaTipi: 'satis'|'alis', odemeTarihi, tutar }
  if (!Array.isArray(matches) || matches.length === 0) {
    return res.status(400).json({ success: false, message: 'Eşleşme listesi boş.' });
  }

  let closedCount = 0;
  for (const m of matches) {
    try {
      const isSatis = m.faturaTipi === 'satis';
      const table = isSatis ? 'satis_faturalari' : 'alis_faturalari';
      const totalCol = isSatis ? 'alinan_ucret' : 'toplam_tutar';
      const odemeTarihi = m.odemeTarihi || new Date().toISOString().split('T')[0];

      // Mevcut fatura bilgilerini çek (Tam / Kısmi ödeme ve cari_id kontrolü için)
      const invRs = await client.execute({
        sql: `SELECT id, ${totalCol} as total_amount, COALESCE(odenen_tutar, 0) as odenen_tutar, cari_id, muhasebe_kodu FROM ${table} WHERE id = ? AND company_id = ?`,
        args: [m.faturaId, req.user.companyId]
      });
      const invRow = invRs.rows[0];
      const totalAmount = Number(invRow?.total_amount) || 0;
      const currentPaid = Number(invRow?.odenen_tutar) || 0;
      const paymentAmount = Number(m.tutar) > 0 ? Number(m.tutar) : Math.max(0, totalAmount - currentPaid);

      const newPaid = Math.min(totalAmount, Math.round((currentPaid + paymentAmount) * 100) / 100);
      const newRemaining = Math.max(0, Math.round((totalAmount - newPaid) * 100) / 100);
      const newStatus = newRemaining <= 0.05 ? 'odendi' : 'kismi_odendi';

      // Faturayı ödendi / kısmi ödendi yap
      await client.execute({
        sql: `UPDATE ${table} SET odeme_durumu = ?, odeme_tarihi = ?, odenen_tutar = ?, kalan_tutar = ? WHERE id = ? AND company_id = ?`,
        args: [newStatus, odemeTarihi, newPaid, newRemaining, m.faturaId, req.user.companyId]
      });

      // Banka hareketine bağlı fatura ID'sini ve eksikse cari_id'sini bağla
      if (m.hareketId) {
        await client.execute({
          sql: `UPDATE cari_hareketler SET bagli_fatura_id = ?, cari_id = COALESCE(NULLIF(cari_id, ''), ?) WHERE id = ? AND company_id = ?`,
          args: [m.faturaId, invRow?.cari_id || null, m.hareketId, req.user.companyId]
        }).catch(() => {});
      }

      // Fatura tahsilat/ödeme geçmişine kaydet
      if (paymentAmount > 0) {
        const ftId = 'ft_rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await client.execute({
          sql: `INSERT INTO fatura_tahsilatlar (id, company_id, fatura_id, fatura_tipi, tarih, tutar, aciklama, cari_hareket_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            ftId,
            req.user.companyId,
            m.faturaId,
            isSatis ? 'satis' : 'alis',
            odemeTarihi,
            paymentAmount,
            newStatus === 'odendi' ? 'Otomatik Banka Eşleştirme (Tam Kapama)' : 'Otomatik Banka Eşleştirme (Kısmi Ödeme)',
            m.hareketId || null
          ]
        }).catch(() => {});
      }

      closedCount++;
    } catch (e) {
      console.warn(`[Reconciliation] Eşleşme kapatılamadı (${m.faturaId}):`, e.message);
    }
  }

  res.json({ success: true, message: `${closedCount} adet fatura ve banka hareketi başarıyla eşleştirilip kapatıldı.`, closedCount });
});

// ==========================================
// --- LUCA AKTARIM DURUMU (KALICI VERİTABANI KAYDI) ---
// ==========================================

router.get('/api/cariler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cariler WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ 
      id: r.id, 
      tip: r.tip, 
      unvan: r.unvan, 
      vknTckn: r.vkn_tckn, 
      vergiDairesi: r.vergi_dairesi, 
      adres: r.adres, 
      telefon: r.telefon, 
      eposta: r.eposta, 
      muhasebeKodu: r.muhasebe_kodu,
      olusturmaTarihi: r.olusturma_tarihi 
    }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/cariler', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO cariler (id,tip,unvan,vkn_tckn,vergi_dairesi,adres,telefon,eposta,muhasebe_kodu,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id), n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), n(f.muhasebeKodu), n(f.olusturmaTarihi), req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.post('/api/cariler/bulk-import', authMiddleware, async (req, res) => {
  const { cariler } = req.body;
  if (!cariler || !Array.isArray(cariler)) {
    return res.status(400).json({ success: false, message: 'Geçersiz veri formatı' });
  }

  try {
    let successCount = 0;
    for (const cari of cariler) {
      if (!cari.unvan) continue;
      
      const id = 'c' + Date.now() + Math.random().toString(36).substr(2, 5);
      const tip = cari.tip || 'musteri';
      
      // VKN veya muhasebe kodu ile eşleşen var mı kontrol et
      let targetId = null;
      if (cari.muhasebeKodu) {
        const rs = await client.execute({ sql: 'SELECT id FROM cariler WHERE muhasebe_kodu = ? AND company_id = ?', args: [cari.muhasebeKodu, req.user.companyId] });
        if (rs.rows.length > 0) targetId = rs.rows[0].id;
      }
      
      if (!targetId && cari.vknTckn) {
        const rs = await client.execute({ sql: 'SELECT id FROM cariler WHERE vkn_tckn = ? AND company_id = ?', args: [cari.vknTckn, req.user.companyId] });
        if (rs.rows.length > 0) targetId = rs.rows[0].id;
      }

      if (targetId) {
        // Mevcut cariyi güncelle (adres, eposta ve muhasebe kodu boş değilse üzerine yaz)
        await client.execute({
          sql: 'UPDATE cariler SET unvan = COALESCE(?, unvan), vkn_tckn = COALESCE(nullif(?, \'\'), vkn_tckn), adres = COALESCE(nullif(?, \'\'), adres), eposta = COALESCE(nullif(?, \'\'), eposta), muhasebe_kodu = COALESCE(nullif(?, \'\'), muhasebe_kodu), tip = COALESCE(nullif(?, \'\'), tip) WHERE id = ? AND company_id = ?',
          args: [n(cari.unvan), n(cari.vknTckn), n(cari.adres), n(cari.eposta), n(cari.muhasebeKodu), n(tip), targetId, req.user.companyId]
        });
      } else {
        // Yeni ekle
        await client.execute({
          sql: 'INSERT INTO cariler (id,tip,unvan,vkn_tckn,vergi_dairesi,adres,telefon,eposta,muhasebe_kodu,olusturma_tarihi,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          args: [id, tip, n(cari.unvan), n(cari.vknTckn), null, n(cari.adres), null, n(cari.eposta), n(cari.muhasebeKodu), new Date().toISOString().split('T')[0], req.user.companyId]
        });
      }
      successCount++;
    }
    res.json({ success: true, count: successCount });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put('/api/cariler/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE cariler SET tip=?,unvan=?,vkn_tckn=?,vergi_dairesi=?,adres=?,telefon=?,eposta=?,muhasebe_kodu=? WHERE id=? AND company_id = ?',
      args: [n(f.tip), n(f.unvan), n(f.vknTckn), n(f.vergiDairesi), n(f.adres), n(f.telefon), n(f.eposta), n(f.muhasebeKodu), req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/cariler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM cariler WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.get('/api/kur', async (req, res) => {
  try {
    const { date } = req.query; // optional date in YYYY-MM-DD
    let response;
    let success = false;
    let attemptDate = date ? new Date(date) : new Date();
    
    // Muhasebe kuralları gereği işlemin bir önceki gününün kuru baz alınır
    attemptDate.setDate(attemptDate.getDate() - 1);
    
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
        let url = 'https://www.tcmb.gov.tr/kurlar/today.xml';
        
        if (attemptDate.setHours(0,0,0,0) < today.setHours(0,0,0,0)) {
            const year = attemptDate.getFullYear();
            const month = String(attemptDate.getMonth() + 1).padStart(2, '0');
            const day = String(attemptDate.getDate()).padStart(2, '0');
            url = `https://www.tcmb.gov.tr/kurlar/${year}${month}/${day}${month}${year}.xml`;
        }
        
        try {
            response = await axios.get(url, { responseType: 'text', timeout: 5000 });
            success = true;
            break;
        } catch (e) {
            // Hafta sonu veya resmi tatil ise bir önceki güne git
            attemptDate.setDate(attemptDate.getDate() - 1);
        }
    }

    if (!success) {
      response = await axios.get('https://www.tcmb.gov.tr/kurlar/today.xml', { responseType: 'text' });
    }

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const result = xmlParser.parse(response.data);
    
    const currencies = result.Tarih_Date?.Currency || [];
    const rates = {};
    
    if (Array.isArray(currencies)) {
      currencies.forEach(c => {
        rates[c['@_CurrencyCode']] = {
          ForexBuying: parseFloat(c.ForexBuying),
          ForexSelling: parseFloat(c.ForexSelling),
          BanknoteBuying: parseFloat(c.BanknoteBuying),
          BanknoteSelling: parseFloat(c.BanknoteSelling)
        };
      });
    }

    res.json({ success: true, date: result.Tarih_Date?.['@_Date'], rates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/api/cari-hareketler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cari_hareketler WHERE company_id = ? ORDER BY tarih DESC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ 
      id: r.id, 
      cariId: r.cari_id, 
      tarih: r.tarih, 
      islemTuru: r.islem_turu, 
      tutar: r.tutar, 
      aciklama: r.aciklama, 
      bagliFaturaId: r.bagli_fatura_id, 
      bankaId: r.banka_id, 
      dekontDosya: r.dekont_dosya, 
      olusturmaTarihi: r.olusturma_tarihi,
      kategoriId: r.kategori_id,
      muhasebeKodu: r.muhasebe_kodu,
      dovizTuru: r.doviz_turu,
      dovizTutar: r.doviz_tutar,
      dovizKuru: r.doviz_kuru,
      lucaTransferredAt: r.luca_transferred_at || null
    }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/cari-hareketler', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO cari_hareketler (id,cari_id,tarih,islem_turu,tutar,aciklama,bagli_fatura_id,banka_id,dekont_dosya,olusturma_tarihi,kategori_id,company_id,muhasebe_kodu,doviz_turu,doviz_tutar,doviz_kuru) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id), n(f.cariId), n(f.tarih), n(f.islemTuru), n(f.tutar), n(f.aciklama), n(f.bagliFaturaId), n(f.bankaId), n(f.dekontDosya), n(f.olusturmaTarihi), n(f.kategoriId), req.user.companyId, n(f.muhasebeKodu), n(f.dovizTuru), n(f.dovizTutar), n(f.dovizKuru)]
    });
    
    // BANKA BAKİYESİ GÜNCELLE
    if (f.bankaId && f.tutar) {
        const ArtisTurleri = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan', 'diger_gelir'];
        const AzalisTurleri = ['odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi','cek_senet_verilen'];
        let degisim = 0;
        let amount = f.dovizTutar ? f.dovizTutar : f.tutar;
        if (ArtisTurleri.includes(f.islemTuru)) degisim = amount;
        else if (AzalisTurleri.includes(f.islemTuru)) degisim = -amount;
        else if (f.islemTuru === 'transfer') {
          if ((f.aciklama||'').toUpperCase().includes('GELEN')) degisim = amount;
          else degisim = -amount;
        }
        if (degisim !== 0) {
          await client.execute({
            sql: 'UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ? AND company_id = ?',
            args: [degisim, f.bankaId, req.user.companyId]
          });
        }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/cari-hareketler/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cari_hareketler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    const old = rs.rows[0];
    if (!old) {
      return res.status(404).json({ success: false, message: 'Cari hareket bulunamadı' });
    }

    if (old.banka_id && old.tutar) {
      const ArtisTurleri = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan', 'diger_gelir'];
      const AzalisTurleri = ['odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi', 'cek_senet_verilen'];
      let degisim = 0;
      let amount = Number(old.doviz_tutar ? old.doviz_tutar : old.tutar) || 0;
      if (ArtisTurleri.includes(old.islem_turu)) degisim = -amount;
      else if (AzalisTurleri.includes(old.islem_turu)) degisim = amount;
      else if (old.islem_turu === 'transfer') {
        if ((old.aciklama||'').toUpperCase().includes('GELEN')) degisim = -amount;
        else degisim = amount;
      }
      if (degisim !== 0) {
        await client.execute({
          sql: 'UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ? AND company_id = ?',
          args: [degisim, old.banka_id, req.user.companyId]
        });
      }
    }

    const updatedCariId = f.cariId !== undefined ? f.cariId : old.cari_id;
    const updatedTarih = f.tarih !== undefined ? f.tarih : old.tarih;
    const updatedIslemTuru = f.islemTuru !== undefined ? f.islemTuru : old.islem_turu;
    const updatedTutar = f.tutar !== undefined ? f.tutar : old.tutar;
    const updatedAciklama = f.aciklama !== undefined ? f.aciklama : old.aciklama;
    const updatedBagliFaturaId = f.bagliFaturaId !== undefined ? f.bagliFaturaId : old.bagli_fatura_id;
    const updatedBankaId = f.bankaId !== undefined ? f.bankaId : old.banka_id;
    const updatedDekontDosya = f.dekontDosya !== undefined ? f.dekontDosya : old.dekont_dosya;
    const updatedKategoriId = f.kategoriId !== undefined ? f.kategoriId : old.kategori_id;
    const updatedMuhasebeKodu = f.muhasebeKodu !== undefined ? f.muhasebeKodu : old.muhasebe_kodu;
    const updatedDovizTuru = f.dovizTuru !== undefined ? f.dovizTuru : old.doviz_turu;
    const updatedDovizTutar = f.dovizTutar !== undefined ? f.dovizTutar : old.doviz_tutar;
    const updatedDovizKuru = f.dovizKuru !== undefined ? f.dovizKuru : old.doviz_kuru;

    await client.execute({
      sql: 'UPDATE cari_hareketler SET cari_id=?,tarih=?,islem_turu=?,tutar=?,aciklama=?,bagli_fatura_id=?,banka_id=?,dekont_dosya=?,kategori_id=?,muhasebe_kodu=?,doviz_turu=?,doviz_tutar=?,doviz_kuru=? WHERE id=? AND company_id = ?',
      args: [n(updatedCariId), n(updatedTarih), n(updatedIslemTuru), n(updatedTutar), n(updatedAciklama), n(updatedBagliFaturaId), n(updatedBankaId), n(updatedDekontDosya), n(updatedKategoriId), n(updatedMuhasebeKodu), n(updatedDovizTuru), n(updatedDovizTutar), n(updatedDovizKuru), req.params.id, req.user.companyId]
    });

    if (updatedBankaId && updatedTutar) {
      const ArtisTurleri = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan', 'diger_gelir'];
      const AzalisTurleri = ['odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi', 'cek_senet_verilen'];
      let degisim = 0;
      let amount = Number(updatedDovizTutar ? updatedDovizTutar : updatedTutar) || 0;
      if (ArtisTurleri.includes(updatedIslemTuru)) degisim = amount;
      else if (AzalisTurleri.includes(updatedIslemTuru)) degisim = -amount;
      else if (updatedIslemTuru === 'transfer') {
        if ((updatedAciklama||'').toUpperCase().includes('GELEN')) degisim = amount;
        else degisim = -amount;
      }
      if (degisim !== 0) {
        await client.execute({
          sql: 'UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ? AND company_id = ?',
          args: [degisim, updatedBankaId, req.user.companyId]
        });
      }
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/cari-hareketler/:id', authMiddleware, async (req, res) => {
  try { 
    const rs = await client.execute({
      sql: 'SELECT * FROM cari_hareketler WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    const h = rs.rows[0];
    if (h && h.banka_id && h.tutar) {
        const ArtisTurleri = ['tahsilat', 'satis_faturasi', 'cek_senet_alinan', 'diger_gelir'];
        const AzalisTurleri = ['odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi', 'cek_senet_verilen'];
        let degisim = 0;
        let amount = h.doviz_tutar ? h.doviz_tutar : h.tutar;
        if (ArtisTurleri.includes(h.islem_turu)) degisim = -amount; // Gelir siliniyorsa bakiye azalır
        else if (AzalisTurleri.includes(h.islem_turu)) degisim = amount; // Gider siliniyorsa bakiye artar
        else if (h.islem_turu === 'transfer') {
          if ((h.aciklama||'').toUpperCase().includes('GELEN')) degisim = -amount;
          else degisim = amount;
        }
        if (degisim !== 0) {
          await client.execute({
            sql: 'UPDATE banka_hesaplari SET guncel_bakiye = guncel_bakiye + ? WHERE id = ? AND company_id = ?',
            args: [degisim, h.banka_id, req.user.companyId]
          });
        }
    }
    await client.execute({
      sql: 'DELETE FROM cari_hareketler WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true }); 
  }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- SATIŞ FATURALARI ---
// ============================================================

router.get('/api/cek-senetler', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM cek_senetler WHERE company_id = ? ORDER BY vade_tarihi ASC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, tip: r.tip, islemTipi: r.islem_tipi, cariId: r.cari_id, belgeNo: r.belge_no, tutar: r.tutar, vadeTarihi: r.vade_tarihi, verilisTarihi: r.verilis_tarihi, durum: r.durum, aciklama: r.aciklama }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/cek-senetler', authMiddleware, async (req, res) => {
  const c = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO cek_senetler (id,tip,islem_tipi,cari_id,belge_no,tutar,vade_tarihi,verilis_tarihi,durum,aciklama,company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(c.id),n(c.tip),n(c.islemTipi),n(c.cariId),n(c.belgeNo),n(c.tutar),n(c.vadeTarihi),n(c.verilisTarihi),c.durum||'bekliyor',n(c.aciklama),req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/cek-senetler/:id', authMiddleware, async (req, res) => {
  const c = req.body;
  try {
    await client.execute({
      sql: 'UPDATE cek_senetler SET tip=?,islem_tipi=?,cari_id=?,belge_no=?,tutar=?,vade_tarihi=?,verilis_tarihi=?,durum=?,aciklama=? WHERE id=? AND company_id = ?',
      args: [n(c.tip),n(c.islemTipi),n(c.cariId),n(c.belgeNo),n(c.tutar),n(c.vadeTarihi),n(c.verilisTarihi),n(c.durum),n(c.aciklama),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/cek-senetler/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM cek_senetler WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.get('/api/banka-hesaplari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT 
          b.*,
          b.acilis_bakiyesi + COALESCE(
            (SELECT SUM(
              CASE 
                WHEN h.islem_turu IN ('tahsilat', 'satis_faturasi', 'cek_senet_alinan', 'diger_gelir') THEN COALESCE(h.doviz_tutar, h.tutar)
                WHEN h.islem_turu IN ('odeme', 'alis_faturasi', 'vergi_kdv', 'vergi_muhtasar', 'vergi_gecici', 'vergi_damga', 'maas_odemesi', 'kira_odemesi', 'banka_masrafi', 'ssk_odemesi', 'genel_gider', 'kredi_karti_odemesi', 'cek_senet_verilen') THEN -COALESCE(h.doviz_tutar, h.tutar)
                WHEN h.islem_turu = 'transfer' AND UPPER(h.aciklama) LIKE '%GELEN%' THEN COALESCE(h.doviz_tutar, h.tutar)
                WHEN h.islem_turu = 'transfer' THEN -COALESCE(h.doviz_tutar, h.tutar)
                ELSE 0
              END
            ) FROM cari_hareketler h WHERE h.banka_id = b.id AND h.company_id = b.company_id), 0
          ) as hesaplanan_bakiye
        FROM banka_hesaplari b 
        WHERE b.company_id = ?
      `,
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, hesapAdi: r.hesap_adi, bankaAdi: r.banka_adi, iban: r.iban, hesapNo: r.hesap_no, kartNo: r.kart_no, dovizTuru: r.doviz_turu, acilisBakiyesi: r.acilis_bakiyesi, guncelBakiye: r.hesaplanan_bakiye, muhasebeKodu: r.muhasebe_kodu }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/banka-hesaplari', authMiddleware, async (req, res) => {
  const b = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO banka_hesaplari (id,hesap_adi,banka_adi,iban,hesap_no,kart_no,doviz_turu,acilis_bakiyesi,guncel_bakiye,company_id,muhasebe_kodu) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(b.id),n(b.hesapAdi),n(b.bankaAdi),n(b.iban),n(b.hesapNo),n(b.kartNo),n(b.dovizTuru)||'TRY',n(b.acilisBakiyesi)||0,n(b.guncelBakiye)||0,req.user.companyId,n(b.muhasebeKodu)]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/banka-hesaplari/:id', authMiddleware, async (req, res) => {
  const b = req.body;
  try {
    await client.execute({
      sql: 'UPDATE banka_hesaplari SET hesap_adi=?,banka_adi=?,iban=?,hesap_no=?,kart_no=?,doviz_turu=?,acilis_bakiyesi=?,guncel_bakiye=?,muhasebe_kodu=? WHERE id=? AND company_id = ?',
      args: [n(b.hesapAdi),n(b.bankaAdi),n(b.iban),n(b.hesapNo),n(b.kartNo),n(b.dovizTuru),n(b.acilisBakiyesi),n(b.guncelBakiye),n(b.muhasebeKodu),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/banka-hesaplari/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM banka_hesaplari WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// ============================================================
// --- MASRAF KURALLARI ---
// ============================================================
router.get('/api/masraf-kurallari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM masraf_kurallari WHERE company_id = ?',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, anahtarKelime: r.anahtar_kelime, islemTuru: r.islem_turu, aciklama: r.aciklama, kategoriId: r.kategori_id, muhasebeKodu: r.muhasebe_kodu }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/masraf-kurallari', authMiddleware, async (req, res) => {
  const m = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO masraf_kurallari (id,anahtar_kelime,islem_turu,aciklama,company_id,kategori_id,muhasebe_kodu) VALUES (?,?,?,?,?,?,?)',
      args: [n(m.id),n(m.anahtarKelime),n(m.islemTuru),n(m.aciklama),req.user.companyId,n(m.kategoriId),n(m.muhasebeKodu)]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/masraf-kurallari/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM masraf_kurallari WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/api/kesilecek-faturalar', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM kesilecek_faturalar WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ 
      id: r.id, ad: r.ad, soyad: r.soyad, vknTckn: r.vkn_tckn, vergiDairesi: r.vergi_dairesi, 
      adres: r.adres, il: r.il, ilce: r.ilce, tutar: r.tutar, kdvDahil: !!r.kdv_dahil, 
      kdvOrani: r.kdv_orani, faturaTarihi: r.fatura_tarihi, aciklama: r.aciklama, 
      olusturmaTarihi: r.olusturma_tarihi, durum: r.durum, cariId: r.cari_id,
      gibUuid: r.gib_uuid, faturaNo: r.fatura_no
    }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/kesilecek-faturalar', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO kesilecek_faturalar (id,ad,soyad,vkn_tckn,vergi_dairesi,adres,il,ilce,tutar,kdv_dahil,kdv_orani,fatura_tarihi,aciklama,olusturma_tarihi,durum,cari_id,company_id,gib_uuid,fatura_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [n(f.id),n(f.ad),n(f.soyad),n(f.vknTckn),n(f.vergiDairesi),n(f.adres),n(f.il),n(f.ilce),n(f.tutar),f.kdvDahil?1:0,n(f.kdvOrani),n(f.faturaTarihi),n(f.aciklama),n(f.olusturmaTarihi),n(f.durum)||'bekliyor',n(f.cariId),req.user.companyId,n(f.gibUuid),n(f.faturaNo)]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/kesilecek-faturalar/:id', authMiddleware, async (req, res) => {
  const f = req.body;
  try {
    await client.execute({
      sql: 'UPDATE kesilecek_faturalar SET ad=?,soyad=?,vkn_tckn=?,vergi_dairesi=?,adres=?,il=?,ilce=?,tutar=?,kdv_dahil=?,kdv_orani=?,fatura_tarihi=?,aciklama=?,durum=?,cari_id=?,gib_uuid=?,fatura_no=? WHERE id=? AND company_id = ?',
      args: [n(f.ad),n(f.soyad),n(f.vknTckn),n(f.vergiDairesi),n(f.adres),n(f.il),n(f.ilce),n(f.tutar),f.kdvDahil?1:0,n(f.kdvOrani),n(f.faturaTarihi),n(f.aciklama),n(f.durum),n(f.cariId),n(f.gibUuid),n(f.faturaNo),req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/kesilecek-faturalar/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM kesilecek_faturalar WHERE id=? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// --- SUPER ADMIN COMPANY MANAGEMENT ---

router.get('/api/gider-kategorileri', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM gider_kategorileri WHERE company_id = ? ORDER BY ad ASC',
      args: [req.user.companyId]
    });
    const mapped = rs.rows.map(r => ({ id: r.id, ad: r.ad, muhasebeKodu: r.muhasebe_kodu, tip: r.tip || 'GIDER' }));
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/api/gider-kategorileri', authMiddleware, async (req, res) => {
  const k = req.body;
  try {
    await client.execute({
      sql: 'INSERT INTO gider_kategorileri (id, ad, company_id, muhasebe_kodu, tip) VALUES (?, ?, ?, ?, ?)',
      args: [n(k.id), n(k.ad), req.user.companyId, n(k.muhasebeKodu), k.tip || 'GIDER']
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/api/gider-kategorileri/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM gider_kategorileri WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/api/gider-kategorileri/:id', authMiddleware, async (req, res) => {
  const k = req.body;
  try {
    await client.execute({
      sql: 'UPDATE gider_kategorileri SET ad = ?, muhasebe_kodu = ?, tip = ? WHERE id = ? AND company_id = ?',
      args: [n(k.ad), n(k.muhasebeKodu), k.tip || 'GIDER', req.params.id, req.user.companyId]
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
