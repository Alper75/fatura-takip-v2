import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Decodes base64 string safely to UTF-8
 */
function base64ToUTF8(base64: string) {
  try {
    const cleanBase64 = base64.replace(/\s+/g, '');
    const binString = window.atob(cleanBase64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Base64 decode hatası:', e);
    return '';
  }
}

/**
 * UBL-TR XML dosyasını alıp, içindeki XSLT şablonunu kullanarak HTML oluşturur 
 * ve bu HTML'den PDF üreterek Base64 (data URL) formatında döndürür.
 * 
 * @param file Yüklenen XML dosyası
 * @returns PDF'in Base64 string karşılığı veya null
 */
export async function generatePdfFromUblXml(file: File): Promise<string | null> {
  try {
    const xmlText = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // 1. XML içindeki EmbeddedDocumentBinaryObject (XSLT) bulunması
    const binaryObjects = xmlDoc.getElementsByTagName('cbc:EmbeddedDocumentBinaryObject');
    let xsltBase64 = '';
    
    // UBL-TR standardında XSLT genellikle filename özelliği "xslt" içeren bir etikettedir
    for (let i = 0; i < binaryObjects.length; i++) {
      const node = binaryObjects[i];
      const filename = node.getAttribute('filename') || '';
      if (filename.toLowerCase().includes('xslt') || filename.toLowerCase().includes('xsl')) {
        xsltBase64 = node.textContent || '';
        break;
      }
    }

    // Eğer filename="xslt" bulunamadıysa, ilk gördüğümüz binary object'i alalım (büyük ihtimalle odur)
    if (!xsltBase64 && binaryObjects.length > 0) {
      xsltBase64 = binaryObjects[0].textContent || '';
    }

    if (!xsltBase64) {
      console.warn('XML içerisinde XSLT şablonu bulunamadı. PDF oluşturulamıyor.');
      return null;
    }

    // 2. Base64 XSLT -> String -> DOM
    const xsltString = base64ToUTF8(xsltBase64);
    if (!xsltString) return null;

    const xsltDoc = parser.parseFromString(xsltString, 'text/xml');

    // 3. XSLTProcessor ile HTML Document'e çevirme
    const xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    const resultDoc = xsltProcessor.transformToDocument(xmlDoc);

    if (!resultDoc) {
      console.error('XSLT dönüşümü başarısız oldu.');
      return null;
    }

    const htmlString = new XMLSerializer().serializeToString(resultDoc);

    // 4. HTML'i geçici, görünmez bir iframe içine yerleştirip render etme
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1200px';
    iframe.style.height = '1600px';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);

    // Iframe içine içeriği yaz
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlString);
      doc.close();
    }

    // XSLT içindeki resimlerin vb. yüklenmesi için ufak bir bekleme
    await new Promise(r => setTimeout(r, 1000));

    const targetElement = iframe.contentDocument?.body;
    if (!targetElement) {
      document.body.removeChild(iframe);
      return null;
    }

    // 5. html2canvas ve jsPDF ile PDF'e çevirme
    const canvas = await html2canvas(targetElement, {
      scale: 2, // Yüksek çözünürlük
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    // Orantılı boy
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Eğer fatura uzunsa birden fazla sayfaya taşır (basit yaklaşım)
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    const pdfBase64 = pdf.output('datauristring');

    // Temizlik
    document.body.removeChild(iframe);

    return pdfBase64;
  } catch (err) {
    console.error('PDF oluşturma sırasında hata:', err);
    return null;
  }
}
