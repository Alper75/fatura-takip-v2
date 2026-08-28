const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '../api/index.js');
let indexJs = fs.readFileSync(indexPath, 'utf8');

// 1. Optimize /api/elogo/gelen-faturalar
const oldGelenElogoStart = "    const fetchInvoiceDetails = async (doc) => {";
const oldGelenElogoEnd = "    const formattedDocs = await Promise.all(documents.map(d => fetchInvoiceDetails(d)));";

const newGelenElogoCode = `    // 1. Veritabanında zaten kayıtlı olan faturaları anında eşle (Gereksiz SOAP XML indirmelerini atla)
    const existingInvoicesRs = await client.execute({
      sql: 'SELECT id, fatura_no, fatura_tarihi, tedarikci_adi, tedarikci_vkn, toplam_tutar, matrah, kdv_orani, kdv_tutari, oiv_tutari, mal_hizmet_adi, aciklama, gib_uuid FROM alis_faturalari WHERE company_id = ?',
      args: [companyId]
    });
    const existingMap = new Map();
    for (const row of existingInvoicesRs.rows) {
      if (row.gib_uuid) existingMap.set(String(row.gib_uuid).toLowerCase().trim(), row);
      if (row.fatura_no) existingMap.set(String(row.fatura_no).toLowerCase().trim(), row);
    }

    const fetchInvoiceDetails = async (doc) => {
      try {
        const uuid = doc.documentUuid || doc.uuid;
        const docId = doc.documentId || '';
        
        // Eğer veritabanımızda varsa doğrudan veritabanından al
        const exByUuid = uuid ? existingMap.get(String(uuid).toLowerCase().trim()) : null;
        const exByNo = docId ? existingMap.get(String(docId).toLowerCase().trim()) : null;
        const ex = exByUuid || exByNo;
        if (ex) {
          return {
            ...doc,
            faturaNo: ex.fatura_no || docId,
            uuid: ex.gib_uuid || uuid,
            senderName: ex.tedarikci_adi || 'Kayıtlı Cari',
            senderVkn: ex.tedarikci_vkn || '-',
            issueDate: ex.fatura_tarihi,
            payableAmount: parseFloat(ex.toplam_tutar) || 0,
            currencyCode: 'TRY',
            matrah: parseFloat(ex.matrah) || 0,
            kdvOrani: parseFloat(ex.kdv_orani) || 20,
            kdvTutari: parseFloat(ex.kdv_tutari) || 0,
            oivTutari: parseFloat(ex.oiv_tutari) || 0,
            faturaAciklama: ex.aciklama || ex.mal_hizmet_adi || 'Kayıtlı Alış Faturası',
            isAlreadySaved: true
          };
        }`;

indexJs = indexJs.replace(oldGelenElogoStart, newGelenElogoCode);

// Replace Promise.all with batch chunks
const newBatchChunks = `    // Faturaları 15'erli paralel paketler halinde çek (Sunucuyu ve API'yi tıkamadan hızlı yükle)
    const pLimit = 15;
    const formattedDocs = [];
    for (let i = 0; i < documents.length; i += pLimit) {
      const chunk = documents.slice(i, i + pLimit);
      const chunkResults = await Promise.all(chunk.map(d => fetchInvoiceDetails(d)));
      formattedDocs.push(...chunkResults);
    }`;

indexJs = indexJs.replace(oldGelenElogoEnd, newBatchChunks);

fs.writeFileSync(indexPath, indexJs, 'utf8');
console.log('api/index.js optimized with DB caching and concurrency chunking!');
