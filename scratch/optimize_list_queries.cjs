const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '../api/index.js');
let indexJs = fs.readFileSync(indexPath, 'utf8');

// 1. Optimize GET /api/alis-faturalari
const oldAlisQuery = "sql: 'SELECT * FROM alis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',";
const fastAlisQuery = `sql: 'SELECT id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, mal_hizmet_adi, toplam_tutar, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, stopaj_orani, stopaj_tutari, kdv1, kdv10, kdv20, oiv_tutari, muhasebe_kodu, karsi_hesap_kodu, pdf_dosya_adi, odeme_tarihi, odeme_durumu, odeme_dekontu_adi, cari_id, vade_tarihi, aciklama, olusturma_tarihi, urun_id, depo_id, vehicle_plate, gib_uuid FROM alis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',`;

indexJs = indexJs.replace(oldAlisQuery, fastAlisQuery);

// 2. Optimize GET /api/satis-faturalari
const oldSatisQuery = "sql: 'SELECT * FROM satis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',";
const fastSatisQuery = `sql: 'SELECT id, fatura_no, fatura_tarihi, ad, soyad, tc_vkn, adres, alinan_ucret, kdv_orani, kdv_tutari, matrah, tevkifat_orani, tevkifat_tutari, tevkifat_kodu, stopaj_orani, stopaj_tutari, stopaj_kodu, muhasebe_kodu, pdf_dosya_adi, odeme_tarihi, odeme_durumu, cari_id, vade_tarihi, aciklama, olusturma_tarihi, urun_id, depo_id, gib_uuid FROM satis_faturalari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',`;

indexJs = indexJs.replace(oldSatisQuery, fastSatisQuery);

fs.writeFileSync(indexPath, indexJs, 'utf8');
console.log('api/index.js queries optimized: Base64 payload eliminated from list queries!');
