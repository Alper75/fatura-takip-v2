import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { client } from '../db.js';
import { n } from '../utils/shared.js';
import { triggerEvrakWorker } from '../services/evrakAiWorker.js';
import { saveBufferFile } from '../services/fileStorage.js';

function mapEvrakRow(r) {
  let mahsup = [];
  if (r.mahsup_satirlari) {
    try {
      mahsup = typeof r.mahsup_satirlari === 'string' ? JSON.parse(r.mahsup_satirlari) : r.mahsup_satirlari;
    } catch {
      mahsup = [];
    }
  }
  return {
    id: r.id,
    companyId: r.company_id,
    yon: r.yon || 'ALIS',
    dosyaAdi: r.dosya_adi || '',
    mimeType: r.mime_type || 'image/jpeg',
    durum: r.durum || 'bekliyor',
    hataMesaji: r.hata_mesaji || null,
    faturaNo: r.fatura_no || '',
    faturaTarihi: r.fatura_tarihi || '',
    cariAdi: r.cari_adi || '',
    cariVkn: r.cari_vkn || '',
    malHizmet: r.mal_hizmet || '',
    matrah: Number(r.matrah) || 0,
    kdvOrani: Number(r.kdv_orani) || 20,
    kdvTutari: Number(r.kdv_tutari) || 0,
    kdv1: Number(r.kdv1) || 0,
    kdv10: Number(r.kdv10) || 0,
    kdv20: Number(r.kdv20) || 0,
    oivTutari: Number(r.oiv_tutari) || 0,
    toplamTutar: Number(r.toplam_tutar) || 0,
    muhasebeKodu: r.muhasebe_kodu || '',
    karsiHesapKodu: r.karsi_hesap_kodu || '',
    odemeSekli: r.odeme_sekli || 'CARI_HESAP',
    mahsupSatirlari: Array.isArray(mahsup) ? mahsup : [],
    aktarilanFaturaId: r.aktarilan_fatura_id || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listEvrakHavuzu(req, res) {
  try {
    const { yon, durum } = req.query;
    let sql = 'SELECT * FROM evrak_havuzu WHERE company_id = ?';
    const args = [req.user.companyId];
    if (yon && yon !== 'ALL') {
      sql += ' AND yon = ?';
      args.push(yon);
    }
    if (durum && durum !== 'ALL') {
      sql += ' AND durum = ?';
      args.push(durum);
    }
    sql += ' ORDER BY created_at DESC';
    const rs = await client.execute({ sql, args });
    res.json({ success: true, data: rs.rows.map(mapEvrakRow) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function uploadEvrakHavuzu(req, res) {
  try {
    const yon = req.body?.yon === 'SATIS' ? 'SATIS' : 'ALIS';
    const files = req.files || [];
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, message: 'Yüklenecek dosya seçilmedi.' });
    }

    const inserted = [];
    for (const file of files) {
      const id = uuidv4();
      await client.execute({
        sql: `INSERT INTO evrak_havuzu (id, company_id, yon, dosya_adi, mime_type, dosya_yolu, durum)
              VALUES (?, ?, ?, ?, ?, ?, 'bekliyor')`,
        args: [id, req.user.companyId, yon, file.originalname, file.mimetype || 'image/jpeg', file.path]
      });
      inserted.push({ id, dosyaAdi: file.originalname, yon, durum: 'bekliyor' });
    }

    triggerEvrakWorker();
    res.json({ success: true, count: inserted.length, data: inserted });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function getEvrakFile(req, res) {
  try {
    const rs = await client.execute({
      sql: 'SELECT dosya_yolu, dosya_adi, mime_type FROM evrak_havuzu WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (!rs.rows || rs.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evrak bulunamadı.' });
    }
    const row = rs.rows[0];
    if (!row.dosya_yolu || !fs.existsSync(row.dosya_yolu)) {
      return res.status(404).json({ success: false, message: 'Dosya diskte bulunamadı.' });
    }
    const buf = fs.readFileSync(row.dosya_yolu);
    const mime = row.mime_type || 'image/jpeg';
    const base64Url = `data:${mime};base64,${buf.toString('base64')}`;
    res.json({ success: true, dataUrl: base64Url, mimeType: mime, dosyaAdi: row.dosya_adi });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function updateEvrakHavuzu(req, res) {
  try {
    const b = req.body || {};
    await client.execute({
      sql: `UPDATE evrak_havuzu SET
              yon = COALESCE(?, yon),
              fatura_no = ?,
              fatura_tarihi = ?,
              cari_adi = ?,
              cari_vkn = ?,
              mal_hizmet = ?,
              matrah = ?,
              kdv_orani = ?,
              kdv_tutari = ?,
              kdv1 = ?,
              kdv10 = ?,
              kdv20 = ?,
              oiv_tutari = ?,
              toplam_tutar = ?,
              muhasebe_kodu = ?,
              karsi_hesap_kodu = ?,
              odeme_sekli = ?,
              mahsup_satirlari = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND company_id = ?`,
      args: [
        b.yon || null,
        n(b.faturaNo) || '',
        n(b.faturaTarihi) || '',
        n(b.cariAdi) || '',
        n(b.cariVkn) || '',
        n(b.malHizmet) || '',
        Number(b.matrah) || 0,
        Number(b.kdvOrani) || 20,
        Number(b.kdvTutari) || 0,
        Number(b.kdv1) || 0,
        Number(b.kdv10) || 0,
        Number(b.kdv20) || 0,
        Number(b.oivTutari) || 0,
        Number(b.toplamTutar) || 0,
        n(b.muhasebeKodu),
        n(b.karsiHesapKodu),
        n(b.odemeSekli) || 'CARI_HESAP',
        b.mahsupSatirlari ? JSON.stringify(b.mahsupSatirlari) : null,
        req.params.id,
        req.user.companyId
      ]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function reanalyzeEvrak(req, res) {
  try {
    await client.execute({
      sql: "UPDATE evrak_havuzu SET durum = 'bekliyor', hata_mesaji = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?",
      args: [req.params.id, req.user.companyId]
    });
    triggerEvrakWorker();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

async function transferSingleEvrak(row, companyId) {
  if (row.durum === 'aktarildi') return null;

  let storedFilePath = null;
  if (row.dosya_yolu && fs.existsSync(row.dosya_yolu)) {
    const buf = fs.readFileSync(row.dosya_yolu);
    storedFilePath = saveBufferFile(buf, row.dosya_adi || `${row.id}.jpg`, row.yon === 'ALIS' ? 'fisler' : 'faturalar');
  }

  let cariId = null;
  if (row.cari_vkn) {
    const cRs = await client.execute({
      sql: 'SELECT id FROM cariler WHERE company_id = ? AND vkn_tckn = ? LIMIT 1',
      args: [companyId, String(row.cari_vkn).trim()]
    });
    if (cRs.rows?.[0]?.id) cariId = cRs.rows[0].id;
  }

  const newFaturaId = uuidv4();
  const tarih = row.fatura_tarihi || new Date().toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  if (row.yon === 'SATIS') {
    const adParts = String(row.cari_adi || 'Müşteri').trim().split(' ');
    const ad = adParts[0] || 'Müşteri';
    const soyad = adParts.slice(1).join(' ');
    await client.execute({
      sql: `INSERT INTO satis_faturalari
            (id, fatura_no, tc_vkn, ad, soyad, adres, kdv_orani, alinan_ucret, matrah, kdv_tutari,
             tevkifat_orani, tevkifat_tutari, stopaj_orani, stopaj_tutari, muhasebe_kodu,
             pdf_dosya, pdf_dosya_adi, fatura_tarihi, odeme_durumu, cari_id, aciklama, olusturma_tarihi, company_id)
            VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, '0', 0, '0', 0, ?, ?, ?, ?, 'odenmedi', ?, ?, ?, ?)`,
      args: [
        newFaturaId, n(row.fatura_no), n(row.cari_vkn) || '', ad, soyad,
        Number(row.kdv_orani) || 20, Number(row.toplam_tutar) || 0, Number(row.matrah) || 0, Number(row.kdv_tutari) || 0,
        n(row.muhasebe_kodu), storedFilePath, n(row.dosya_adi), tarih, cariId, n(row.mal_hizmet) || '', todayStr, companyId
      ]
    });
    if (cariId) {
      await client.execute({
        sql: 'INSERT INTO cari_hareketler (id, cari_id, tarih, islem_turu, tutar, aciklama, bagli_fatura_id, olusturma_tarihi, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [uuidv4(), cariId, tarih, 'satis_faturasi', Number(row.toplam_tutar) || 0, `Satış Faturası (${row.fatura_no || ''})`, newFaturaId, todayStr, companyId]
      });
    }
  } else {
    const mahsupStr = typeof row.mahsup_satirlari === 'string' ? row.mahsup_satirlari : JSON.stringify(row.mahsup_satirlari || []);
    await client.execute({
      sql: `INSERT INTO alis_faturalari
            (id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, mal_hizmet_adi,
             toplam_tutar, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari,
             stopaj_orani, stopaj_tutari, muhasebe_kodu, karsi_hesap_kodu, pdf_dosya, pdf_dosya_adi,
             odeme_durumu, cari_id, aciklama, olusturma_tarihi, company_id, kdv1, kdv10, kdv20, oiv_tutari, mahsup_satirlari)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', 0, '0', 0, ?, ?, ?, ?, 'odenmedi', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newFaturaId, n(row.fatura_no), tarih, n(row.cari_adi) || 'Tedarikçi', n(row.cari_vkn) || '', n(row.mal_hizmet) || '',
        Number(row.toplam_tutar) || 0, Number(row.kdv_orani) || 20, Number(row.kdv_tutari) || 0, Number(row.matrah) || 0,
        n(row.muhasebe_kodu), n(row.karsi_hesap_kodu), storedFilePath, n(row.dosya_adi),
        cariId, n(row.mal_hizmet) || '', todayStr, companyId,
        Number(row.kdv1) || 0, Number(row.kdv10) || 0, Number(row.kdv20) || 0, Number(row.oiv_tutari) || 0, mahsupStr
      ]
    });
    if (cariId) {
      await client.execute({
        sql: 'INSERT INTO cari_hareketler (id, cari_id, tarih, islem_turu, tutar, aciklama, bagli_fatura_id, olusturma_tarihi, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [uuidv4(), cariId, tarih, 'alis_faturasi', Number(row.toplam_tutar) || 0, `Alış Faturası (${row.fatura_no || ''})`, newFaturaId, todayStr, companyId]
      });
    }
  }

  await client.execute({
    sql: "UPDATE evrak_havuzu SET durum = 'aktarildi', aktarilan_fatura_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [newFaturaId, row.id]
  });
  return newFaturaId;
}

export async function approveEvrak(req, res) {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM evrak_havuzu WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (!rs.rows || rs.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evrak bulunamadı.' });
    }
    const row = rs.rows[0];
    if (row.durum === 'aktarildi') {
      return res.status(400).json({ success: false, message: 'Bu evrak zaten sisteme aktarılmış.' });
    }
    const faturaId = await transferSingleEvrak(row, req.user.companyId);
    res.json({ success: true, faturaId });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function bulkApproveEvrak(req, res) {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Onaylanacak evrak seçilmedi.' });
    }
    let count = 0;
    for (const id of ids) {
      const rs = await client.execute({
        sql: 'SELECT * FROM evrak_havuzu WHERE id = ? AND company_id = ?',
        args: [id, req.user.companyId]
      });
      if (rs.rows?.[0] && rs.rows[0].durum !== 'aktarildi') {
        await transferSingleEvrak(rs.rows[0], req.user.companyId);
        count++;
      }
    }
    res.json({ success: true, count });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function deleteEvrakHavuzu(req, res) {
  try {
    const rs = await client.execute({
      sql: 'SELECT dosya_yolu FROM evrak_havuzu WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    const path = rs.rows?.[0]?.dosya_yolu;
    await client.execute({
      sql: 'DELETE FROM evrak_havuzu WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    if (path && fs.existsSync(path)) {
      try { fs.unlinkSync(path); } catch {}
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}
