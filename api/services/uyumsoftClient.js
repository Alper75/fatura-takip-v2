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
   * Get Invoices (Inbox/Outbox) with automatic pagination
   */
  async getDocumentList(documentType = 'EINVOICE', beginDate, endDate, opType = 2 /* 2: INCOMING, 1: OUTGOING */, dateBy = 1 /* 1: Fatura Tarihi, 0: Oluşturma Tarihi */) {
    await this.init();

    try {
      const bDate = beginDate.split('T')[0] + 'T00:00:00';
      const eDate = endDate.split('T')[0] + 'T23:59:59';
      
      const allItems = [];
      let pageIndex = 0;
      const pageSize = 100;
      let totalPages = 1;

      while (pageIndex < totalPages && pageIndex < 20) {
        const queryObj = {
          PageIndex: pageIndex,
          PageSize: pageSize
        };

        if (dateBy === 1) {
          queryObj.ExecutionStartDate = bDate;
          queryObj.ExecutionEndDate = eDate;
          queryObj.SortColumn = 'ExecutionDate';
        } else {
          queryObj.CreateStartDate = bDate;
          queryObj.CreateEndDate = eDate;
          queryObj.SortColumn = 'CreateDate';
        }

        const args = { query: queryObj };
        let result;
        if (opType === 2) {
          [result] = await this.client.GetInboxInvoiceListAsync(args);
        } else {
          [result] = await this.client.GetOutboxInvoiceListAsync(args);
        }

        const resVal = result?.GetInboxInvoiceListResult?.Value || result?.GetOutboxInvoiceListResult?.Value;
        if (resVal?.attributes?.TotalPages) {
          totalPages = parseInt(resVal.attributes.TotalPages, 10) || 1;
        }

        let itemsRaw = resVal?.Items;
        if (itemsRaw && typeof itemsRaw === 'object' && !Array.isArray(itemsRaw)) {
          const keys = Object.keys(itemsRaw);
          if (keys.length === 1 && Array.isArray(itemsRaw[keys[0]])) {
            itemsRaw = itemsRaw[keys[0]];
          } else if (keys.length === 1) {
            itemsRaw = [itemsRaw[keys[0]]];
          }
        }

        const itemsArr = Array.isArray(itemsRaw) ? itemsRaw : (itemsRaw ? [itemsRaw] : []);
        if (itemsArr.length === 0) break;
        
        allItems.push(...itemsArr);
        pageIndex++;
      }

      const mappedDocs = allItems.map(item => ({
        documentUuid: item.InvoiceId || item.Id || item.uuid || item.invoiceId || item.id,
        documentId: item.DocumentId || item.FaturaNo || item.documentId
      })).filter(doc => doc.documentUuid);

      return { success: true, data: { docList: { Document: mappedDocs } } };
    } catch (error) {
      console.error('Uyumsoft GetDocumentList Error:', error);
      return { success: false, message: this._extractFaultMessage(error) };
    }
  }

  /**
   * Get E-SMM (Vouchers) with automatic multi-page pagination & dual-date fallback
   */
  async getVoucherList(beginDate, endDate, opType = 1 /* 1: OUTBOX, 2: INBOX */, dateBy = 1 /* 1: Belge/Makbuz Tarihi, 0: Oluşturma Tarihi */) {
    await this.init();
    try {
      const bDate = beginDate.split('T')[0] + 'T00:00:00';
      const eDate = endDate.split('T')[0] + 'T23:59:59';

      const allItems = [];
      let pageIndex = 0;
      const pageSize = 100;
      let totalPages = 1;

      while (pageIndex < totalPages && pageIndex < 20) {
        let args;
        if (opType === 2) {
          args = {
            context: {
              PageIndex: pageIndex,
              PageSize: pageSize,
              ...(dateBy === 1 ? { DocumentDate: { Begin: bDate, End: eDate } } : { CreationDate: { Begin: bDate, End: eDate } })
            }
          };
        } else {
          args = {
            context: {
              PageIndex: pageIndex,
              PageSize: pageSize,
              ...(dateBy === 1 
                ? { DocumentStartDate: bDate, DocumentEndDate: eDate, SortColumn: 'DocumentDate' }
                : { CreationSartDate: bDate, CreationEndDate: eDate, SortColumn: 'CreateDate' })
            }
          };
        }

        let result;
        if (opType === 2) {
          [result] = await this.voucherClient.QueryInboxVoucherListAsync(args);
        } else {
          [result] = await this.voucherClient.QueryVoucherListAsync(args);
        }

        const resVal = result?.QueryInboxVoucherListResult?.Value || result?.QueryVoucherListResult?.Value;
        if (resVal?.attributes?.TotalPages) {
          totalPages = parseInt(resVal.attributes.TotalPages, 10) || 1;
        }

        let itemsRaw = resVal?.Items;
        if (itemsRaw && typeof itemsRaw === 'object' && !Array.isArray(itemsRaw)) {
          const keys = Object.keys(itemsRaw);
          if (keys.length === 1 && Array.isArray(itemsRaw[keys[0]])) {
            itemsRaw = itemsRaw[keys[0]];
          } else if (keys.length === 1) {
            itemsRaw = [itemsRaw[keys[0]]];
          }
        }

        const itemsArr = Array.isArray(itemsRaw) ? itemsRaw : (itemsRaw ? [itemsRaw] : []);
        if (itemsArr.length === 0) break;

        allItems.push(...itemsArr);
        pageIndex++;
      }

      // If dateBy === 1 returned 0 items, try fallback to CreationSartDate just in case
      if (allItems.length === 0 && dateBy === 1 && opType === 1) {
        const fallbackArgs = {
          context: {
            PageIndex: 0,
            PageSize: 100,
            CreationSartDate: bDate,
            CreationEndDate: eDate
          }
        };
        const [fbResult] = await this.voucherClient.QueryVoucherListAsync(fallbackArgs);
        let fbItems = fbResult?.QueryVoucherListResult?.Value?.Items;
        if (fbItems && typeof fbItems === 'object' && !Array.isArray(fbItems)) {
          const keys = Object.keys(fbItems);
          if (keys.length === 1 && Array.isArray(fbItems[keys[0]])) fbItems = fbItems[keys[0]];
          else if (keys.length === 1) fbItems = [fbItems[keys[0]]];
        }
        if (Array.isArray(fbItems) && fbItems.length > 0) {
          allItems.push(...fbItems);
        }
      }

      // Map distinct vouchers
      const seenIds = new Set();
      const mappedDocs = [];

      for (const item of allItems) {
        const uuid = item.Identifier || item.Id || item.uuid || item.InvoiceId;
        if (!uuid || seenIds.has(uuid)) continue;
        seenIds.add(uuid);

        mappedDocs.push({
          documentUuid: uuid,
          documentId: item.VoucherNumber || item.FaturaNo || item.DocumentId || uuid,
          isPrePopulated: true,
          senderName: item.TargetTitle || 'Bilinmiyor',
          senderVkn: item.TargetVknTckn || '-',
          issueDate: item.DocumentDate ? new Date(item.DocumentDate).toISOString().split('T')[0] : (item.CreationDate ? new Date(item.CreationDate).toISOString().split('T')[0] : '-'),
          payableAmount: parseFloat(item.PayableAmount) || 0,
          taxTotal: parseFloat(item.TotalTaxAmount || item.VatAmount) || 0,
          taxExclusiveAmount: parseFloat(item.GrossTotal || item.VatTaxableAmount) || 0,
          currencyCode: item.CurrencyCode || 'TRY',
          faturaNo: item.VoucherNumber || item.FaturaNo || item.DocumentId || '-',
          stopajTutari: parseFloat(item.WithholdingTaxAmount || item.WithholdingAmount || item.StoppageAmount || item.TotalWithholdingTaxAmount) || 0,
          stopajOrani: parseFloat(item.WithholdingTaxRate || item.WithholdingRate || item.StoppageRate) || 0,
          tevkifatTutari: parseFloat(item.WithholdingAmount) || 0,
          tevkifatOrani: parseFloat(item.WithholdingRate) || 0
        });
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
        xmlData = '<DummyVoucherXml></DummyVoucherXml>';
      }
      
      return {
        success: true,
        data: {
          document: {
            binaryData: {
              Value: Buffer.from(xmlData).toString('base64')
            }
          }
        }
      };
    } catch (error) {
      console.error('Uyumsoft GetVoucherData Error:', error);
      return { success: false, message: this._extractFaultMessage(error) };
    }
  }

  async getDocumentPdf(uuid) {
    await this.init();
    try {
      const args = { invoiceId: uuid };
      const [result] = await this.client.GetInvoicePdfAsync(args);
      
      if (result?.GetInvoicePdfResult?.Value) {
        return {
          success: true,
          data: {
            document: {
              binaryData: {
                Value: result.GetInvoicePdfResult.Value
              }
            }
          }
        };
      }
      return { success: false, message: 'PDF alınamadı' };
    } catch (error) {
      return { success: false, message: this._extractFaultMessage(error) };
    }
  }

  async getVoucherPdf(uuid) {
    await this.init();
    try {
      const args = { documentId: uuid };
      const [result] = await this.voucherClient.GetVoucherPdfAsync(args);
      
      if (result?.GetVoucherPdfResult?.Value) {
        return {
          success: true,
          data: {
            document: {
              binaryData: {
                Value: result.GetVoucherPdfResult.Value
              }
            }
          }
        };
      }
      return { success: false, message: 'Makbuz PDF alınamadı' };
    } catch (error) {
      return { success: false, message: this._extractFaultMessage(error) };
    }
  }
}
