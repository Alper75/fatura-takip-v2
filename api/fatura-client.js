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
    if (!response) {
        throw new Error("GİB sunucusundan boş yanıt döndü.");
    }

    // 1. GİB numeric/string error kodu kontrolü (0 harici hata demektir)
    if (response.error && response.error !== "0" && response.error !== 0) {
        const raw = response.messages?.[0];
        const text = typeof raw === "string" ? raw : (typeof raw === "object" && raw !== null ? (raw.text || raw.description || JSON.stringify(raw)) : "GİB API hatası");
        throw new Error(text || `GİB Hatası (Kod: ${response.error})`);
    }

    // 2. messages dizisi içinde ERROR / HATA / UYARI var mı?
    if (Array.isArray(response.messages) && response.messages.length > 0) {
        const errItem = response.messages.find(m => {
            const t = String(m?.type || '').toUpperCase();
            return t === 'ERROR' || t === 'HATA' || t === 'WARN' || t === 'WARNING';
        });
        
        if (errItem) {
            const text = typeof errItem === 'string' ? errItem : (errItem.text || errItem.description || JSON.stringify(errItem));
            if (text && !text.includes('başarı') && !text.includes('basari') && !text.includes('başarılı')) {
                throw new Error(text);
            }
        }
    }

    // 3. Eğer data alanı null ve messages varsa doğrudan fırlat
    if ((response.data === null || response.data === undefined) && Array.isArray(response.messages) && response.messages.length > 0) {
        const text = response.messages.map(m => (typeof m === 'string' ? m : m.text || JSON.stringify(m))).join(' - ');
        if (text && !text.includes('başarı') && !text.includes('basari')) {
            throw new Error(text);
        }
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        try {
            const response = await fetch(`${this.baseURL}/earsiv-services/dispatch`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: `cmd=${command}&callid=${generateUUID()}&pageName=${pageName}&token=${token}&jp=${encodeURIComponent(JSON.stringify(data))}`,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
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
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error(`GİB sunucusu zaman aşımına uğradı (${command}). GİB sistemi şu an yoğun olabilir.`);
            }
            throw err;
        }
    }

    async getToken(userName, password) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(`${this.baseURL}/earsiv-services/assos-login`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: `assoscmd=${this.loginCmd}&rtype=json&userid=${userName}&sifre=${password}&sifre2=${password}&parola=1&`,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const responseText = await response.text();
            let json;
            try {
                json = JSON.parse(responseText);
            } catch (parseErr) {
                throw new Error(`GİB giriş sunucusu geçersiz yanıt döndü: ${responseText.substring(0, 150)}`);
            }

            assertApiSuccess(json);
            return json.token;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('GİB giriş sunucusu yanıt vermedi (Zaman aşımı). Lütfen biraz sonra tekrar deneyin.');
            }
            throw err;
        }
    }

    async logout(token) {
        if (!token) return null;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(`${this.baseURL}/earsiv-services/assos-login`, {
                method: "POST",
                headers: this.buildHeaders(),
                body: `assoscmd=${this.logoutCmd}&rtype=json&token=${token}&`,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                return json.data;
            } catch {
                return null;
            }
        } catch (err) {
            clearTimeout(timeoutId);
            console.warn('[GIB Client] Logout isteği gönderilirken hata oluştu:', err.message);
            return null;
        }
    }

    async createDraftInvoice(token, invoiceDetails) {
        const normDate = (d) => {
            if (!d) return "";
            const s = String(d).trim();
            if (s.includes("-")) {
                const p = s.split("T")[0].split("-");
                if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
            }
            return s;
        };

        const vknClean = String(invoiceDetails.taxIDOrTRID || "").trim().replace(/\s/g, "");
        let aliciUnvan = "";
        let aliciAdi = "";
        let aliciSoyadi = "";

        if (vknClean.length === 11 && vknClean !== "11111111111") {
            // Şahıs (TCKN) -> Sadece Ad ve Soyad gönderilmeli, Unvan boş olmalı!
            aliciUnvan = "";
            if (invoiceDetails.surname && String(invoiceDetails.surname).trim()) {
                aliciAdi = String(invoiceDetails.name || "").trim();
                aliciSoyadi = String(invoiceDetails.surname).trim();
            } else {
                const fullName = String(invoiceDetails.title || invoiceDetails.name || "").trim();
                const parts = fullName.split(/\s+/);
                if (parts.length > 1) {
                    aliciSoyadi = parts.pop();
                    aliciAdi = parts.join(" ");
                } else {
                    aliciAdi = parts[0] || "Alıcı";
                    aliciSoyadi = ".";
                }
            }
        } else if (vknClean === "11111111111") {
            // Nihai Tüketici
            aliciUnvan = invoiceDetails.title || `${invoiceDetails.name || ''} ${invoiceDetails.surname || ''}`.trim() || "NİHAİ TÜKETİCİ";
            aliciAdi = invoiceDetails.name || "";
            aliciSoyadi = invoiceDetails.surname || "";
        } else {
            // Şirket / Kurum (10 Haneli VKN) -> Sadece Unvan gönderilmeli, Ad ve Soyad kesinlikle boş olmalı!
            aliciUnvan = invoiceDetails.title || `${invoiceDetails.name || ''} ${invoiceDetails.surname || ''}`.trim();
            aliciAdi = "";
            aliciSoyadi = "";
        }

        const invoiceData = {
            faturaUuid: "", // GİB son güncellemelerle boş ETTN bekler, kendisi portaldan tekil ETTN üretir
            belgeNumarasi: invoiceDetails.documentNumber ?? "",
            faturaTarihi: normDate(invoiceDetails.date),
            saat: invoiceDetails.time || "00:00:00",
            paraBirimi: invoiceDetails.currency ?? "TRY",
            dovzTLkur: invoiceDetails.currencyRate ?? "0",
            faturaTipi: invoiceDetails.invoiceType ?? "SATIS",
            hangiTip: "Buyuk",
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
            vknTckn: vknClean || "11111111111",
            aliciUnvan: aliciUnvan,
            aliciAdi: aliciAdi,
            aliciSoyadi: aliciSoyadi,
            bulvarcaddesokak: invoiceDetails.fullAddress ?? "",
            binaAdi: invoiceDetails.buildingName ?? "",
            binaNo: invoiceDetails.buildingNumber ?? "",
            kapiNo: invoiceDetails.doorNumber ?? "",
            kasabaKoy: invoiceDetails.town ?? "",
            mahalleSemtIlce: invoiceDetails.district ?? "",
            sehir: invoiceDetails.city ?? " ",
            ulke: invoiceDetails.country ?? "Türkiye",
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
            gelirVergisiOrani: invoiceDetails.stopajTipi === 'V0011' ? 0 : (invoiceDetails.gelirVergisiOrani ?? 0),
            bagkurTevkifatiOrani: invoiceDetails.bagkurTevkifatiOrani ?? 0,
            gelirVergisiTevkifatiTutari: invoiceDetails.stopajTipi === 'V0011' ? "0" : (invoiceDetails.gelirVergisiTevkifatiTutari ?? "0"),
            kurumlarVergisiOrani: invoiceDetails.stopajTipi === 'V0011' ? (invoiceDetails.gelirVergisiOrani ?? 0) : 0,
            kurumlarVergisiTevkifatiTutari: invoiceDetails.stopajTipi === 'V0011' ? (invoiceDetails.gelirVergisiTevkifatiTutari ?? "0") : "0",
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
                V0003Orani: item.stopajTipi === 'V0011' ? 0 : (item.stopajRate ?? 0),
                V0003Tutari: item.stopajTipi === 'V0011' ? "0" : (item.stopajAmount ?? 0).toFixed(2),
                V0011Orani: item.stopajTipi === 'V0011' ? (item.stopajRate ?? 0) : 0,
                V0011Tutari: item.stopajTipi === 'V0011' ? (item.stopajAmount ?? 0).toFixed(2) : "0",
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

        const invoice = await this.runCommand(token, ...COMMANDS.createDraftInvoice, invoiceData);

        const parseMoney = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            let str = String(val).trim().replace(/[^\d.,]/g, '');
            if (str.includes(',') && str.includes('.')) {
                if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                    str = str.replace(/\./g, '').replace(',', '.');
                } else {
                    str = str.replace(/,/g, '');
                }
            } else if (str.includes(',')) {
                str = str.replace(',', '.');
            }
            return parseFloat(str) || 0;
        };

        const cleanDigits = (v) => String(v || '').replace(/\D/g, '');

        // GİB portalında oluşturulan taslağın gerçek ETTN (UUID) değerini çekelim
        let realUuid = "";
        
        // 1. Yanıt metninde doğrudan UUID varsa al
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const directMatch = JSON.stringify(invoice).match(uuidRegex);
        if (directMatch && directMatch[0] && directMatch[0] !== '00000000-0000-0000-0000-000000000000') {
            realUuid = directMatch[0];
        }

        // 2. Yanıtta UUID yoksa GİB taslaklar listesinden bu VKN ve Tutara ait faturayı tam eşleştir
        if (!realUuid) {
            try {
                await new Promise(r => setTimeout(r, 800));
                const drafts = await this.getAllInvoicesByDateRange(token, {
                    startDate: invoiceData.faturaTarihi,
                    endDate: invoiceData.faturaTarihi,
                });
                if (Array.isArray(drafts) && drafts.length > 0) {
                    const targetAmt = parseFloat(invoiceData.odenecekTutar) || 0;
                    const targetVkn = cleanDigits(vknClean);
                    const targetName = String(aliciUnvan || `${aliciAdi} ${aliciSoyadi}`).toLowerCase().replace(/[^a-z0-9]/g, '');

                    // 1. Öncelik: VKN + Tutar (1.05 TL kuruş toleransı)
                    let matched = drafts.find(d => {
                        const dVkn = cleanDigits(d.aliciVknTckn || d.vknTckn || d.aliciVergiNo || d.aliciTcKimlikNo);
                        const dAmt = parseMoney(d.odenecek || d.belgeToplamTutar || d.belgeTutari || d.toplamTutar);
                        return dVkn && targetVkn && dVkn === targetVkn && Math.abs(dAmt - targetAmt) < 1.05;
                    });

                    // 2. Öncelik: İsim + Tutar (VKN 11111111111 veya şahıslar için)
                    if (!matched && targetName) {
                        matched = drafts.find(d => {
                            const dName = String(d.aliciUnvanAdSoyad || d.aliciUnvan || d.unvan || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const dAmt = parseMoney(d.odenecek || d.belgeToplamTutar || d.belgeTutari || d.toplamTutar);
                            const nameMatches = dName && (dName.includes(targetName) || targetName.includes(dName));
                            return nameMatches && Math.abs(dAmt - targetAmt) < 1.05;
                        });
                    }

                    // 3. Öncelik: VKN eşleşmesi (ve henüz numarası olmayan / taslak olan en yeni kayıt)
                    if (!matched && targetVkn && targetVkn !== '11111111111') {
                        const sameVkn = drafts.filter(d => {
                            const dVkn = cleanDigits(d.aliciVknTckn || d.vknTckn || d.aliciVergiNo || d.aliciTcKimlikNo);
                            return dVkn === targetVkn && (!d.belgeNumarasi || d.belgeNumarasi === 'Taslak' || d.onayDurumu !== 'Onaylandı');
                        });
                        if (sameVkn.length > 0) {
                            matched = sameVkn[sameVkn.length - 1];
                        }
                    }

                    if (matched && matched.ettn) {
                        realUuid = matched.ettn;
                    } else {
                        console.warn(`[GIB] Taslak oluşturuldu fakat liste eşleştirmesinde tam uyuşan kayıt bulunamadı (VKN: ${targetVkn}, Tutar: ${targetAmt}). Yanlış fatura atanmaması için fallback uygulanmadı.`);
                    }
                }
            } catch (fetchErr) {
                console.warn('[GIB] Yeni oluşturulan taslak UUID getirilirken uyarı:', fetchErr.message);
            }
        }

        return { 
            date: invoiceData.faturaTarihi, 
            uuid: realUuid || "", 
            taxIDOrTRID: vknClean,
            paymentTotal: invoiceData.odenecekTutar,
            ...invoice 
        };
    }

    async findInvoice(token, draftInvoice, retries = 3) {
        if (!draftInvoice?.uuid && !draftInvoice?.taxIDOrTRID) {
            return undefined;
        }
        for (let attempt = 1; attempt <= retries; attempt++) {
            if (attempt > 1) {
                // GİB veritabanı indekslemesi için kısa bekleme
                await new Promise(r => setTimeout(r, 800 * attempt));
            }
            const invoices = await this.getAllInvoicesByDateRange(token, {
                startDate: draftInvoice.date,
                endDate: draftInvoice.date,
            });
            if (draftInvoice.uuid) {
                const found = invoices?.find((inv) => inv.ettn === draftInvoice.uuid);
                if (found) return found;
            } else if (draftInvoice.taxIDOrTRID) {
                const targetVkn = String(draftInvoice.taxIDOrTRID).replace(/\D/g, '');
                const targetAmt = parseFloat(draftInvoice.paymentTotal || 0);
                const found = invoices?.find(d => {
                    const dVkn = String(d.aliciVknTckn || d.vknTckn || d.aliciVergiNo || d.aliciTcKimlikNo || '').replace(/\D/g, '');
                    const dAmt = parseFloat(String(d.odenecek || d.belgeToplamTutar || '0').replace(/\./g, '').replace(',', '.')) || 0;
                    return dVkn === targetVkn && (targetAmt <= 0 || Math.abs(dAmt - targetAmt) < 1.05);
                });
                if (found) return found;
            }
        }
        return undefined;
    }

    async signDraftInvoice(token, draftInvoice) {
        return this.runCommand(token, ...COMMANDS.signDraftInvoice, {
            imzalanacaklar: [draftInvoice],
        });
    }

    async getAllInvoicesByDateRange(token, { startDate, endDate }) {
        const norm = (d) => {
            if (!d) return "";
            const s = String(d).trim();
            if (s.includes("-")) {
                const p = s.split("T")[0].split("-");
                if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
            }
            return s;
        };
        const sDate = norm(startDate);
        const eDate = norm(endDate);
        const result = await this.runCommand(token, ...COMMANDS.getAllInvoicesByDateRange, { 
            baslangic: sDate, 
            bitis: eDate, 
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

    async getRecipientData(token, vknTckn) {
        const result = await this.runCommand(token, ...COMMANDS.getRecipientDataByTaxIDOrTRID, {
            vknTcknn: vknTckn
        });
        return result.data;
    }
}

export function createFaturaClient(env = "PROD") {
    return new FaturaClient(env);
}
