import soap from 'soap';

export class UyumsoftClient {
  constructor(username, password, isTest = true) {
    this.username = username;
    this.password = password;
    this.isTest = isTest;
    this.apiUrl = isTest
      ? 'https://efatura-test.uyumsoft.com.tr/Services/Integration?wsdl'
      : 'https://efatura.uyumsoft.com.tr/Services/Integration?wsdl';
    this.client = null;
  }

  async init() {
    if (!this.client) {
      this.client = await soap.createClientAsync(this.apiUrl);
      // Uyumsoft uses WS-Security
      const wsSecurity = new soap.WSSecurity(this.username, this.password, {
        hasTimeStamp: false,
        hasTokenCreated: false
      });
      this.client.setSecurity(wsSecurity);
    }
  }

  /**
   * Send E-Invoice or E-Archive Document
   */
  async sendDocument(documentType, zipDataBase64, zipFileName, alias = null) {
    await this.init();

    // In Uyumsoft, usually it's SendDocument or SendInvoice
    // This requires WSDL inspection, but assuming a standard SendInvoice method
    const args = {
      invoices: {
        InvoiceInfo: [
          // The structure here is highly specific to Uyumsoft WSDL
          // Usually requires UBL XML mapped or Base64 inside a specific tag.
          // Since we might be sending UBL Base64 directly:
          // Uyumsoft usually uses SaveAsDraft or SendDocument
        ]
      }
    };

    try {
      // Mocked for now, as WSDL mapping is required
      return { success: false, message: 'Uyumsoft giden fatura henüz desteklenmiyor.' };
    } catch (error) {
      console.error('Uyumsoft SendDocument Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getDocumentList(documentType = 'EINVOICE', beginDate, endDate, opType = 2 /* 2: INCOMING */) {
    await this.init();

    // Uyumsoft method is usually GetInboxInvoiceList for incoming
    try {
      const args = {
        query: {
          CreateStartDate: beginDate + 'T00:00:00',
          CreateEndDate: endDate + 'T23:59:59',
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
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Uyumsoft GetDocumentList Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getDocumentData(uuid) {
    await this.init();

    try {
      // Typically GetInboxInvoice or GetInvoice method
      const args = { invoiceId: uuid, format: 'UBL' };
      const [result] = await this.client.GetInboxInvoiceAsync(args);
      
      // Need to format result to match elogoClient format so api/index.js doesn't break
      return { success: true, data: result };
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
