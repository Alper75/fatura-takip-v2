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
      this.client = await soap.createClientAsync(this.apiUrl, {
        ignoredNamespaces: {
          namespaces: ['targetNamespace', 'typedNamespace'],
          override: true
        }
      });
      
      // Ensure namespaces are defined in the envelope to prevent WCF deserialization errors
      if (this.client.wsdl) {
        const defaultXmlns = this.client.wsdl.xmlnsInEnvelope || '';
        let addXmlns = '';
        if (!defaultXmlns.includes('xmlns:ns1=')) addXmlns += ' xmlns:ns1="http://www.w3.org/2001/XMLSchema"';
        if (!defaultXmlns.includes('xmlns:ns2=')) addXmlns += ' xmlns:ns2="http://schemas.microsoft.com/2003/10/Serialization/"';
        this.client.wsdl.xmlnsInEnvelope = defaultXmlns + addXmlns;
      }

      // Uyumsoft uses WS-Security
      const wsSecurity = new soap.WSSecurity(this.username, this.password, {
        hasTimeStamp: false,
        hasTokenCreated: false
      });
      this.client.setSecurity(wsSecurity);
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
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Uyumsoft GetDocumentList Error:', error);
      return { success: false, message: this._extractFaultMessage(error) };
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
