import { generateUUID, convertPriceToText } from './fatura-utils.js';

const ENV = {
    PROD: { BASE_URL: "https://earsivportal.efatura.gov.tr" },
    TEST: { BASE_URL: "https://earsivportaltest.efatura.gov.tr" }
};

const COMMANDS = {
    createDraftInvoice: ["EARSIV_PORTAL_FATURA_OLUSTUR", "RG_BASITFATURA"],
    getAllInvoicesByDateRange: ["EARSIV_PORTAL_TASLAKLARI_GETIR", "RG_BASITTASLAKLAR"],
    getAllInvoicesIssuedToMeByDateRange: ["EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR", "RG_ALICI_TASLAKLAR"],
    signDraftInvoice: ["EARSIV_PORTAL_FATURA_HSM_CIHAZI_ILE_IMZALA", "RG_BASITTASLAKLAR"],
    getInvoiceHTML: ["EARSIV_PORTAL_FATURA_GOSTER", "RG_BASITTASLAKLAR"],
    cancelDraftInvoice: ["EARSIV_PORTAL_FATURA_SIL", "RG_BASITTASLAKLAR"],
    getRecipientDataByTaxIDOrTRID: ["SICIL_VEYA_MERNISTEN_BILGILERI_GETIR", "RG_BASITFATURA"],
    sendSignSMSCode: ["EARSIV_PORTAL_SMSSIFRE_GONDER", "RG_SMSONAY"],
    verifySMSCode: ["EARSIV_PORTAL_SMSSIFRE_DOGRULA", "RG_SMSONAY"],
    getUserData: ["EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR", "RG_KULLANICI"],
    updateUserData: ["EARSIV_PORTAL_KULLANICI_BILGILERI_KAYDET", "RG_KULLANICI"],
};

function assertApiSuccess(response) {
    if (response.error && response.error !== "0") {
        const raw = response.messages?.[0];
        const text = typeof raw === "string" ? raw : (typeof raw === "object" && raw !== null ? raw.text : "GİB API hatası");
        throw new Error(text ?? "GİB API hatası");
    }
}

export class FaturaClient {
    constructor(env = "PROD") {
        this.baseURL = ENV[env].BASE_URL;
        this.loginCmd = env === "PROD" ? "anologin" : "login";
        this.logoutCmd = "logout";
    }

    buildHeaders() {
        return {
            accept: "*/*",
            "accept-language": "tr,en-US;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            pragma: "no-cache",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
        };
    }

    async runCommand(token, command, pageName, data = {}) {
        const response = await fetch(`${this.baseURL}/earsiv-services/dispatch`, {
            method: "POST",
            headers: this.buildHeaders(),
            body: `cmd=${command}&callid=${generateUUID()}&pageName=${pageName}&token=${token}&jp=${encodeURIComponent(JSON.stringify(data))}`,
        });
        
        const responseText = await response.text();
        try {
            const json = JSON.parse(responseText);
            assertApiSuccess(json);
            return json;
        } catch (err) {
            if (err instanceof SyntaxError) {
                console.error("GİB JSON dönmedi, HTML döndürdü. İçerik:", responseText.substring(0, 500));
                throw new Error(`GİB API Hatası (HTML Döndü): ${responseText.substring(0, 200)}...`);
            }
            throw err;
        }
    }

    async getToken(userName, password) {
        const response = await fetch(`${this.baseURL}/earsiv-services/assos-login`, {
            method: "POST",
            headers: this.buildHeaders(),
            body: `assoscmd=${this.loginCmd}&rtype=json&userid=${userName}&sifre=${password}&sifre2=${password}&parola=1&`,
        });
        const json = await response.json();
        assertApiSuccess(json);
        return json.token;
    }

    async logout(token) {
        const response = await fetch(`${this.baseURL}/earsiv-services/assos-login`, {
            method: "POST",
            headers: this.buildHeaders(),
            body: `assoscmd=${this.logoutCmd}&rtype=json&token=${token}&`,
        });
        const json = await response.json();
        return json.data;
    }

    async createDraftInvoice(token, invoiceDetails) {
        const invoiceData = {
            belgeNumarasi: invoiceDetails.documentNumber ?? "",
            faturaTarihi: invoiceDetails.date.includes("-") ? invoiceDetails.date.split("-").reverse().join("/") : invoiceDetails.date,
            saat: invoiceDetails.time,
            paraBirimi: invoiceDetails.currency ?? "TRY",
            dovzTLkur: invoiceDetails.currencyRate ?? "0",
            faturaTipi: invoiceDetails.invoiceType ?? "SATIS",
            hangiTip: invoiceDetails.hangiTip ?? "Buyuk",
            siparisNumarasi: invoiceDetails.orderNumber ?? "",
            siparisTarihi: invoiceDetails.orderDate ?? "",
            irsaliyeNumarasi: invoiceDetails.dispatchNumber ?? "",
            irsaliyeTarihi: invoiceDetails.dispatchDate ?? "",
            fisNo: invoiceDetails.slipNumber ?? "",
            fisTarihi: invoiceDetails.slipDate ?? "",
            fisSaati: invoiceDetails.slipTime ?? " ",
            fisTipi: invoiceDetails.slipType ?? " ",
            zRaporNo: invoiceDetails.zReportNumber ?? "",
            okcSeriNo: invoiceDetails.okcSerialNumber ?? "",
            vknTckn: invoiceDetails.taxIDOrTRID ?? "11111111111",
            aliciUnvan: invoiceDetails.title ?? "",
            aliciAdi: invoiceDetails.name ?? "",
            aliciSoyadi: invoiceDetails.surname ?? "",
            bulvarcaddesokak: invoiceDetails.fullAddress ?? "",
            binaAdi: invoiceDetails.buildingName ?? "",
            binaNo: invoiceDetails.buildingNumber ?? "",
            kapiNo: invoiceDetails.doorNumber ?? "",
            kasabaKoy: invoiceDetails.town ?? "",
            mahalleSemtIlce: invoiceDetails.district ?? "",
            sehir: invoiceDetails.city ?? " ",
            ulke: invoiceDetails.country ?? "",
            postaKodu: invoiceDetails.zipCode ?? "",
            tel: invoiceDetails.phoneNumber ?? "",
            fax: invoiceDetails.faxNumber ?? "",
            eposta: invoiceDetails.email ?? "",
            websitesi: invoiceDetails.webSite ?? "",
            vergiDairesi: invoiceDetails.taxOffice ?? "",
            komisyonOrani: invoiceDetails.commissionRate ?? 0,
            navlunOrani: invoiceDetails.freightRate ?? 0,
            hammaliyeOrani: invoiceDetails.hammaliyeOrani ?? 0,
            nakliyeOrani: invoiceDetails.nakliyeOrani ?? 0,
            komisyonTutari: invoiceDetails.komisyonTutari ?? "0",
            navlunTutari: invoiceDetails.navlunTutari ?? "0",
            hammaliyeTutari: invoiceDetails.hammaliyeTutari ?? "0",
            nakliyeTutari: invoiceDetails.nakliyeTutari ?? "0",
            komisyonKDVOrani: invoiceDetails.komisyonKDVOrani ?? 0,
            navlunKDVOrani: invoiceDetails.navlunKDVOrani ?? 0,
            hammaliyeKDVOrani: invoiceDetails.hammaliyeKDVOrani ?? 0,
            nakliyeKDVOrani: invoiceDetails.nakliyeKDVOrani ?? 0,
            komisyonKDVTutari: invoiceDetails.komisyonKDVTutari ?? "0",
            navlunKDVTutari: invoiceDetails.navlunKDVTutari ?? "0",
            hammaliyeKDVTutari: invoiceDetails.hammaliyeKDVTutari ?? "0",
            nakliyeKDVTutari: invoiceDetails.nakliyeKDVTutari ?? "0",
            gelirVergisiOrani: invoiceDetails.gelirVergisiOrani ?? 0,
            bagkurTevkifatiOrani: invoiceDetails.bagkurTevkifatiOrani ?? 0,
            gelirVergisiTevkifatiTutari: invoiceDetails.gelirVergisiTevkifatiTutari ?? "0",
            bagkurTevkifatiTutari: invoiceDetails.bagkurTevkifatiTutari ?? "0",
            halRusumuOrani: invoiceDetails.halRusumuOrani ?? 0,
            ticaretBorsasiOrani: invoiceDetails.ticaretBorsasiOrani ?? 0,
            milliSavunmaFonuOrani: invoiceDetails.milliSavunmaFonuOrani ?? 0,
            digerOrani: invoiceDetails.digerOrani ?? 0,
            halRusumuTutari: invoiceDetails.halRusumuTutari ?? "0",
            ticaretBorsasiTutari: invoiceDetails.ticaretBorsasiTutari ?? "0",
            milliSavunmaFonuTutari: invoiceDetails.milliSavunmaFonuTutari ?? "0",
            digerTutari: invoiceDetails.digerTutari ?? "0",
            halRusumuKDVOrani: invoiceDetails.halRusumuKDVOrani ?? 0,
            ticaretBorsasiKDVOrani: invoiceDetails.ticaretBorsasiKDVOrani ?? 0,
            milliSavunmaFonuKDVOrani: invoiceDetails.milliSavunmaFonuKDVOrani ?? 0,
            digerKDVOrani: invoiceDetails.digerKDVOrani ?? 0,
            halRusumuKDVTutari: invoiceDetails.halRusumuKDVTutari ?? "0",
            ticaretBorsasiKDVTutari: invoiceDetails.ticaretBorsasiKDVTutari ?? "0",
            milliSavunmaFonuKDVTutari: invoiceDetails.milliSavunmaFonuKDVTutari ?? "0",
            digerKDVTutari: invoiceDetails.digerKDVTutari ?? "0",
            iadeTable: (invoiceDetails.returnItems ?? []).map(() => ({})),
            ozelMatrahTutari: invoiceDetails.specialTaxBaseAmount ?? "0",
            ozelMatrahOrani: invoiceDetails.specialTaxBaseRate ?? 0,
            ozelMatrahVergiTutari: (invoiceDetails.specialTaxBaseTaxAmount ?? 0).toFixed(2),
            vergiCesidi: invoiceDetails.taxType ?? " ",
            malHizmetTable: invoiceDetails.items.map((item) => ({
                iskontoArttm: item.discount ?? "İskonto",
                malHizmet: item.name,
                miktar: item.quantity ?? 1,
                birim: item.unitType ?? "C62",
                birimFiyat: (item.unitPrice ?? 0).toFixed(2),
                fiyat: item.price.toFixed(2),
                iskontoOrani: item.discountRate ?? 0,
                iskontoTutari: (item.discountAmount ?? 0).toFixed(2),
                iskontoNedeni: item.discountReason ?? "",
                malHizmetTutari: ((item.quantity ?? 0) * (item.unitPrice ?? 0)).toFixed(2),
                kdvOrani: (item.VATRate ?? 0).toFixed(0),
                vergiOrani: item.taxRate ?? 0,
                kdvTutari: (item.VATAmount ?? 0).toFixed(2),
                vergininKdvTutari: (item.VATAmountOfTax ?? 0).toFixed(2),
                tevkifatKodu: item.tevkifatKodu ?? "",
                kdvTevkifatOrani: (item.tevkifatOrani ?? 0) > 0 && (item.tevkifatOrani ?? 0) < 10 ? (item.tevkifatOrani * 10) : (item.tevkifatOrani ?? 0),
                kdvTevkifatTutari: (item.tevkifatAmount ?? 0).toFixed(2),
                V9015Orani: (item.tevkifatOrani ?? 0) > 0 && (item.tevkifatOrani ?? 0) < 10 ? (item.tevkifatOrani * 10) : (item.tevkifatOrani ?? 0),
                V9015Tutari: (item.tevkifatAmount ?? 0).toFixed(2),
                V0003Orani: item.stopajRate ?? 0,
                V0003Tutari: (item.stopajAmount ?? 0).toFixed(2),
            })),
            tip: "İskonto",
            matrah: invoiceDetails.subtotal.toFixed(2),
            malhizmetToplamTutari: invoiceDetails.subtotal.toFixed(2),
            toplamIskonto: (invoiceDetails.totalDiscount ?? 0).toFixed(2),
            hesaplanankdv: invoiceDetails.totalVAT.toFixed(2),
            tevkifatToplamTutari: (invoiceDetails.totalTevkifat ?? 0).toFixed(2),
            vergilerToplami: (invoiceDetails.totalVAT + (invoiceDetails.totalStopaj ?? 0)).toFixed(2),
            vergilerDahilToplamTutar: invoiceDetails.grandTotalInclVAT.toFixed(2),
            toplamMasraflar: invoiceDetails.toplamMasraflar ?? "0",
            odenecekTutar: invoiceDetails.paymentTotal.toFixed(2),
            not: invoiceDetails.note ?? convertPriceToText(invoiceDetails.paymentTotal),
        };

        if (invoiceDetails.uuid) {
            invoiceData.faturaUuid = invoiceDetails.uuid;
        }

        const invoice = await this.runCommand(token, ...COMMANDS.createDraftInvoice, invoiceData);
        
        let realUuid = invoiceDetails.uuid;
        if (!realUuid) {
            const drafts = await this.getAllInvoicesByDateRange(token, {
                startDate: invoiceDetails.date.split("-").reverse().join("/"),
                endDate: invoiceDetails.date.split("-").reverse().join("/"),
            });
            if (drafts && drafts.length > 0) {
                // En son oluşturulan taslak genellikle listedeki ilk veya son elemandır
                // GİB tarihine/saatine göre sıralı getirir.
                realUuid = drafts[0].ettn;
            }
        }

        return { date: invoiceDetails.date, uuid: realUuid, ...invoice };
    }

    async findInvoice(token, draftInvoice) {
        const invoices = await this.getAllInvoicesByDateRange(token, {
            startDate: draftInvoice.date,
            endDate: draftInvoice.date,
        });
        return invoices.find((inv) => inv.ettn === draftInvoice.uuid);
    }

    async signDraftInvoice(token, draftInvoice) {
        return this.runCommand(token, ...COMMANDS.signDraftInvoice, {
            imzalanacaklar: [draftInvoice],
        });
    }

    async getAllInvoicesByDateRange(token, { startDate, endDate }) {
        const result = await this.runCommand(token, ...COMMANDS.getAllInvoicesByDateRange, { 
            baslangic: startDate, 
            bitis: endDate, 
            hangiTip: "5000/30000", 
            table: [] 
        });
        return result.data;
    }

    async getInvoiceHTML(token, uuid, { signed }) {
        const result = await this.runCommand(token, ...COMMANDS.getInvoiceHTML, {
            ettn: uuid,
            onayDurumu: signed ? "Onaylandı" : "Onaylanmadı",
        });
        return result.data;
    }

    getDownloadURL(token, invoiceUUID, { signed }) {
        return (
            `${this.baseURL}/earsiv-services/download` +
            `?token=${token}&ettn=${invoiceUUID}&belgeTip=FATURA` +
            `&onayDurumu=${encodeURIComponent(signed ? "Onaylandı" : "Onaylanmadı")}` +
            `&cmd=downloadResource&`
        );
    }
}

export function createFaturaClient(env = "PROD") {
    return new FaturaClient(env);
}
