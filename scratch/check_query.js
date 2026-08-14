import { createClient } from '@libsql/client';
import 'dotenv/config';

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  try {
    const rs = await client.execute(`
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
        WHERE b.company_id = 6
    `);
    console.log(rs.rows);
  } catch (e) {
    console.error(e);
  }
}
run();
