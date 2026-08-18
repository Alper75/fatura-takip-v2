import soap from 'soap';

export class UyumsoftClient {
  constructor(username, password, isTest = true) {
    this.username = username;
    this.password = password;
    this.isTest = isTest;
    this.apiUrl = isTest
      ? 'https://efatura-test.uyumsoft.com.tr/Services/Integration?wsdl'
      : 'https://efatura.uyumsoft.com.tr/Services/Integration?wsdl';
    this.voucherApiUrl = isTest
      ? 'https://efatura-test.uyumsoft.com.tr/Services/VoucherIntegration?wsdl'
      : 'https://efatura.uyumsoft.com.tr/Services/VoucherIntegration?wsdl';
    this.client = null;
    this.voucherClient = null;
  }

  async init() {
    const initClient = async (url) => {
      const client = await soap.createClientAsync(url, {
        ignoredNamespaces: {
          namespaces: ['targetNamespace', 'typedNamespace'],
          override: true
        }
      });
      
      if (client.wsdl) {
        const defaultXmlns = client.wsdl.xmlnsInEnvelope || '';
        let addXmlns = '';
        if (!defaultXmlns.includes('xmlns:ns1=')) addXmlns += ' xmlns:ns1="http://www.w3.org/2001/XMLSchema"';
        if (!defaultXmlns.includes('xmlns:ns2=')) addXmlns += ' xmlns:ns2="http://schemas.microsoft.com/2003/10/Serialization/"';
        client.wsdl.xmlnsInEnvelope = defaultXmlns + addXmlns;
      }

      const wsSecurity = new soap.WSSecurity(this.username, this.password, {
        hasTimeStamp: false,
        hasTokenCreated: false
      });
      client.setSecurity(wsSecurity);
      return client;
    };

    if (!this.client) {
      this.client = await initClient(this.apiUrl);
    }
    if (!this.voucherClient) {
      this.voucherClient = await initClient(this.voucherApiUrl);
    }
  }

  _extractFaultMessage(error) {
    let msg = error.message;
    try {
      if (error.root && error.root.Envelope && error.root.Envelope.Body && error.root.Envelope.Body.Fault) {
        const fault = error.root.Envelope.Body.Fault;
        msg = fault.faultstring?.$value || fault.faultstring || msg;
      } else if (error.response && error.response.data) {
        msg += ' (HTTP ' + error.response.status + ')';
      }
    } catch (e) {}
    return msg;
  }

  /**
   * Send E-Invoice or E-Archive Document
   */
  async sendDocument(documentType, zipDataBase64, zipFileName, alias = null) {
    await this.init();

    try {
      return { success: false, message: 'Uyumsoft giden fatura henüz desteklenmiyor.' };
    } catch (error) {
      console.error('Uyumsoft SendDocument Error:', error);
      return { success: false, message: this._extractFaultMessage(error) };
    }
  }

  async getDocumentList(documentType = 'EINVOICE', beginDate, endDate, opType = 2 /* 2: INCOMING */) {
    await this.init();

    // Uyumsoft method is usually GetInboxInvoiceList for incoming
    try {
      const args = {
        query: {
          CreateStartDate: beginDate.split('T')[0] + 'T00:00:00',
          CreateEndDate: endDate.split('T')[0] + 'T23:59:59',
          PageIndex: 0,
          PageSize: 100
        }
      };

      let result;
      if (opType === 2) {
        [result] = await this.client.GetInboxInvoiceListAsync(args);
      } else {
        [result] = await this.client.GetOutboxInvoiceListAsync(args);
      }
      
      let itemsRaw = result?.GetInboxInvoiceListResult?.Value?.Items || result?.GetOutboxInvoiceListResult?.Value?.Items;
      
      // WCF and node-soap often wrap arrays in another property (e.g., { InboxInvoiceInfo: [ ... ] })
      if (itemsRaw && typeof itemsRaw === 'object' && !Array.isArray(itemsRaw)) {
        const keys = Object.keys(itemsRaw);
        if (keys.length === 1 && Array.isArray(itemsRaw[keys[0]])) {
           itemsRaw = itemsRaw[keys[0]];
        } else if (keys.length === 1) {
           itemsRaw = [itemsRaw[keys[0]]];
        }
      }

      const itemsArr = Array.isArray(itemsRaw) ? itemsRaw : (itemsRaw ? [itemsRaw] : []);
      
      const mappedDocs = itemsArr.map(item => ({
         documentUuid: item.InvoiceId || item.Id || item.uuid || item.invoiceId || item.id,
         documentId: item.DocumentId || item.FaturaNo || item.documentId
      })).filter(doc => doc.documentUuid); // Remove any completely invalid mapping

      if (mappedDocs.length === 0) {
        // Return raw result as a message to debug what Uyumsoft actually sent!
        let debugStr = '';
        try { debugStr = JSON.stringify(result).substring(0, 1000); } catch(e){}
        return { success: false, message: 'Fatura bulunamadı veya parse edilemedi. Gelen veri: ' + debugStr };
      }

      return { success: true, data: { docList: { Document: mappedDocs } } };
    } catch (error) {
      console.error('Uyumsoft GetDocumentList Error:', error);
      return { success: false, message: this._extractFaultMessage(error) };
    }
  }

  async getVoucherList(beginDate, endDate, opType = 1 /* 1: OUTBOX, 2: INBOX */) {
    await this.init();
    try {
      const args = {
        context: {
          CreationSartDate: beginDate.split('T')[0] + 'T00:00:00',
          CreationEndDate: endDate.split('T')[0] + 'T23:59:59'
        }
      };

      let result;
      if (opType === 2) {
        [result] = await this.voucherClient.QueryInboxVoucherListAsync(args);
      } else {
        [result] = await this.voucherClient.QueryVoucherListAsync(args);
      }
      
      let itemsRaw = result?.QueryInboxVoucherListResult?.Value?.Items || result?.QueryVoucherListResult?.Value?.Items;
      
      if (itemsRaw && typeof itemsRaw === 'object' && !Array.isArray(itemsRaw)) {
        const keys = Object.keys(itemsRaw);
        if (keys.length === 1 && Array.isArray(itemsRaw[keys[0]])) {
           itemsRaw = itemsRaw[keys[0]];
        } else if (keys.length === 1) {
           itemsRaw = [itemsRaw[keys[0]]];
        }
      }

      const itemsArr = Array.isArray(itemsRaw) ? itemsRaw : (itemsRaw ? [itemsRaw] : []);
      
      const mappedDocs = itemsArr.map(item => ({
         documentUuid: item.Identifier || item.Id || item.uuid,
         documentId: item.VoucherNumber || item.FaturaNo,
         isPrePopulated: true, // Tell api/index.js to skip fetching XML
         senderName: item.TargetTitle || 'Bilinmiyor',
         senderVkn: item.TargetVknTckn || '-',
         issueDate: item.DocumentDate ? new Date(item.DocumentDate).toISOString().split('T')[0] : '-',
         payableAmount: item.PayableAmount || 0,
         taxTotal: item.TotalTaxAmount || item.VatAmount || 0,
         taxExclusiveAmount: item.GrossTotal || item.VatTaxableAmount || 0,
         currencyCode: item.CurrencyCode || 'TRY',
         faturaNo: item.VoucherNumber || item.FaturaNo
      })).filter(doc => doc.documentUuid);

      if (mappedDocs.length === 0) {
        let debugStr = '';
        try { debugStr = JSON.stringify(result).substring(0, 1000); } catch(e){}
        return { success: false, message: 'Makbuz bulunamadı. Gelen veri: ' + debugStr };
      }

      return { success: true, data: { docList: { Document: mappedDocs } } };
    } catch (error) {
      console.error('Uyumsoft GetVoucherList Error:', error);
      return { success: false, message: this._extractFaultMessage(error) };
    }
  }

  async getVoucherData(uuid) {
    await this.init();
    try {
      const args = { documentId: uuid };
      const [result] = await this.voucherClient.GetVoucherSourceAsync(args);
      
      let xmlData = '';
      if (result?.GetVoucherSourceResult?.Value?.AdditionalData?.Value) {
          xmlData = result.GetVoucherSourceResult.Value.AdditionalData.Value;
      } else {
          xmlData = '<DummyVoucherXml></DummyVoucherXml>'; // Fallback
      }
      
      const base64Data = Buffer.from(xmlData).toString('base64');
      return { 
        success: true, 
        data: { document: { binaryData: { Value: base64Data } } } 
      };
    } catch (error) {
      console.error('Uyumsoft GetVoucherData Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getVoucherPdf(uuid) {
    await this.init();
    try {
      const args = { voucherId: uuid };
      const [result] = await this.voucherClient.GetPdfAsync(args);
      
      const base64Data = result?.GetPdfResult?.Value?.Data || '';
      return { 
        success: true, 
        data: { document: { binaryData: { Value: base64Data } } } 
      };
    } catch (error) {
      console.error('Uyumsoft GetVoucherPdf Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getDocumentData(uuid) {
    await this.init();

    try {
      const args = { invoiceId: uuid, format: 'UBL' };
      const [result] = await this.client.GetInboxInvoiceAsync(args);
      
      const base64Data = result?.GetInboxInvoiceResult?.Value?.Data;
      return { 
        success: true, 
        data: { document: { binaryData: { Value: base64Data } } } 
      };
    } catch (error) {
      console.error('Uyumsoft GetDocumentData Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getDocumentPdf(uuid) {
    await this.init();

    try {
      const args = { invoiceId: uuid, format: 'PDF' };
      const [result] = await this.client.GetInboxInvoiceAsync(args);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Uyumsoft GetDocumentPdf Error:', error);
      return { success: false, message: error.message };
    }
  }
}
