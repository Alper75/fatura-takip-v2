import soap from 'soap';

export class ElogoClient {
  constructor(username, password, isTest = true) {
    this.username = username;
    this.password = password;
    this.isTest = isTest;
    this.apiUrl = isTest
      ? 'https://pb-demo.elogo.com.tr/PostboxService.svc?singlewsdl'
      : 'https://pb.elogo.com.tr/PostboxService.svc?singlewsdl';
    this.client = null;
    this.sessionId = null;
  }

  async init() {
    if (!this.client) {
      this.client = await soap.createClientAsync(this.apiUrl);
      // Logo'nun production sunucusu (IIS), WSDL'deki tüm namespace'lerin Envelope'a
      // eklenmesi durumunda header boyutu limiti nedeniyle 400 Bad Request fırlatır.
      // Bunu engellemek için node-soap'un otomatik oluşturduğu Envelope namespace'lerini temizliyoruz.
      if (this.client.wsdl) {
        this.client.wsdl.xmlnsInEnvelope = '';
      }
    }
  }

  async login() {
    await this.init();
    
    const loginArgs = {
      login: {
        appStr: 'fatura-takip-v2',
        passWord: this.password,
        source: 'fatura-takip',
        userName: this.username,
        version: '1.0'
      }
    };

    try {
      const [result] = await this.client.LoginAsync(loginArgs);
      if (result && result.LoginResult) {
        this.sessionId = result.sessionID;
        return { success: true, sessionId: this.sessionId, ettn: this.sessionId.replace('D;', '') };
      }
      return { success: false, message: 'Login failed. Invalid credentials or API error.' };
    } catch (error) {
      console.error('eLogo Login Error:', error);
      return { success: false, message: error.message };
    }
  }

  async logout() {
    if (!this.client || !this.sessionId) return;
    try {
      await this.client.LogoutAsync({ sessionID: this.sessionId });
      this.sessionId = null;
    } catch (error) {
      console.error('eLogo Logout Error:', error);
    }
  }

  // To check if a VKN/TCKN is e-fatura user
  async checkGibUser(vknOrTckn) {
    await this.init();
    if (!this.sessionId) await this.login();
    
    try {
      const args = {
        sessionID: this.sessionId,
        vknTcknList: {
          'string': [vknOrTckn]
        }
      };
      const [result] = await this.client.CheckGibUserAsync(args);
      if (result && result.CheckGibUserResult?.resultCode === 1) {
        return { success: true, isUser: true, userList: result.userList };
      }
      return { success: true, isUser: false };
    } catch (error) {
      console.error('eLogo checkGibUser Error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send E-Invoice or E-Archive Document
   * @param {string} documentType 'EINVOICE' or 'EARCHIVE'
   * @param {string} zipDataBase64 The base64 encoded zip file containing the UBL XML
   * @param {string} zipFileName The name of the zip file (e.g. '12345678-fatura.zip')
   * @param {string} alias Customer's e-invoice alias (urn:mail:defaultgb@...)
   */
  async sendDocument(documentType, zipDataBase64, zipFileName, alias = null) {
    await this.init();
    if (!this.sessionId) await this.login();

    const paramList = ['SIGNED=0', `DOCUMENTTYPE=${documentType}`];
    if (alias) {
      paramList.push(`ALIAS=${alias}`);
    }

    const args = {
      sessionID: this.sessionId,
      paramList: {
        'string': paramList
      },
      document: {
        binaryData: {
          Value: zipDataBase64
        },
        currentDate: new Date().toISOString(),
        fileName: zipFileName,
        hash: ''
      }
    };

    try {
      const [result] = await this.client.SendDocumentAsync(args);
      if (result && result.SendDocumentResult?.resultCode === 1) {
        return { success: true, refId: result.SendDocumentResult?.refId };
      }
      return { success: false, message: result.SendDocumentResult?.resultMsg || 'Bilinmeyen hata' };
    } catch (error) {
      console.error('eLogo SendDocument Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getDocumentList(documentType = 'EINVOICE', beginDate, endDate, opType = 2 /* 2: INCOMING, 1: OUTGOING */, dateBy = 1 /* 1: Fatura/Düzenleme Tarihi, 0: Sisteme Geliş/Zarf Tarihi */) {
    await this.init();
    if (!this.sessionId) await this.login();

    const args = {
      sessionID: this.sessionId,
      paramList: {
        'string': [
          `DOCUMENTTYPE=${documentType}`,
          `BEGINDATE=${beginDate}`,
          `ENDDATE=${endDate}`,
          `OPTYPE=${opType}`,
          `DATEBY=${dateBy}`
        ]
      }
    };

    try {
      const [result] = await this.client.GetDocumentListAsync(args);
      return { success: true, data: result };
    } catch (error) {
      console.error('eLogo GetDocumentList Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getDocumentData(uuid) {
    await this.init();
    if (!this.sessionId) await this.login();

    const args = {
      sessionID: this.sessionId,
      uuid: uuid,
      paramList: {
        'string': [ 'DOCUMENTTYPE=EINVOICE', 'DATAFORMAT=UBL' ]
      }
    };

    try {
      const [result] = await this.client.GetDocumentDataAsync(args);
      return { success: true, data: result };
    } catch (error) {
      console.error('eLogo GetDocumentData Error:', error);
      return { success: false, message: error.message };
    }
  }

  async getDocumentPdf(uuid) {
    await this.init();
    if (!this.sessionId) await this.login();

    const args = {
      sessionID: this.sessionId,
      uuid: uuid,
      paramList: {
        'string': [ 'DOCUMENTTYPE=EINVOICE', 'DATAFORMAT=PDF' ]
      }
    };

    try {
      const [result] = await this.client.GetDocumentDataAsync(args);
      return { success: true, data: result };
    } catch (error) {
      console.error('eLogo GetDocumentPdf Error:', error);
      return { success: false, message: error.message };
    }
  }
}
