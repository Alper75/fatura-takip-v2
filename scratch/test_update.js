import { client } from '../api/db.js';

const n = (val) => {
  if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) return null;
  return val;
};

async function runTest() {
  try {
    // 1. Get an existing invoice
    const rs = await client.execute('SELECT * FROM kesilecek_faturalar LIMIT 1');
    if (rs.rows.length === 0) {
      console.log('No invoices found');
      return;
    }
    const dbRow = rs.rows[0];
    
    // Convert to frontend object structure roughly
    const f = {
      ad: dbRow.ad,
      soyad: dbRow.soyad,
      vknTckn: dbRow.vkn_tckn,
      vergiDairesi: dbRow.vergi_dairesi,
      adres: dbRow.adres,
      il: dbRow.il,
      ilce: dbRow.ilce,
      tutar: dbRow.tutar,
      kdvDahil: dbRow.kdv_dahil === 1,
      kdvOrani: dbRow.kdv_orani,
      faturaTarihi: dbRow.fatura_tarihi,
      aciklama: dbRow.aciklama,
      durum: 'kesildi',
      cariId: dbRow.cari_id,
      gibUuid: 'test-uuid-123',
      faturaNo: 'TEST2026000000001'
    };

    const id = dbRow.id;
    const companyId = dbRow.company_id || 1;

    console.log('Running update for id', id, 'with payload:', f);

    const updateRes = await client.execute({
      sql: 'UPDATE kesilecek_faturalar SET ad=?,soyad=?,vkn_tckn=?,vergi_dairesi=?,adres=?,il=?,ilce=?,tutar=?,kdv_dahil=?,kdv_orani=?,fatura_tarihi=?,aciklama=?,durum=?,cari_id=?,gib_uuid=?,fatura_no=? WHERE id=? AND company_id = ?',
      args: [n(f.ad),n(f.soyad),n(f.vknTckn),n(f.vergiDairesi),n(f.adres),n(f.il),n(f.ilce),n(f.tutar),f.kdvDahil?1:0,n(f.kdvOrani),n(f.faturaTarihi),n(f.aciklama),n(f.durum),n(f.cariId),n(f.gibUuid),n(f.faturaNo),id, companyId]
    });
    
    console.log('Update success!', updateRes);
  } catch (error) {
    console.error('Update failed!', error);
  }
}

runTest();
