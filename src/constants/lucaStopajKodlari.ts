export interface LucaStopajKodu {
  value: string;
  code: string;
  rate: number;
  label: string;
  category: string;
  info: string;
}

export const LUCA_STOPAJ_KODLARI: LucaStopajKodu[] = [
  {
    value: '022-20',
    code: '022',
    rate: 20,
    label: "022-Diğer Serbest Meslek Kazancı Ödemeleri (GVK Md. 94/2-b)",
    category: "Serbest Meslek",
    info: "Serbest Meslek, Oran: %20"
  },
  {
    value: '021-17',
    code: '021',
    rate: 17,
    label: "021-18'nci Madde Kapsamına Giren Ödemeler (GVK Md. 94/2-a)",
    category: "Serbest Meslek",
    info: "Serbest Meslek, Oran: %17"
  },
  {
    value: '041-20',
    code: '041',
    rate: 20,
    label: "041-70'nci Maddede Yazılı Mal ve Hakların Kiralanması Karşılığı Yapılan Ödemeler (GVK Md. 94/5)",
    category: "Kira",
    info: "Kira, Oran: %20"
  },
  {
    value: '041-10',
    code: '041',
    rate: 10,
    label: "041-70'nci Maddede Yazılı Mal ve Hakların Kiralanması Karşılığı Yapılan Ödemeler (GVK Md. 94/5)",
    category: "Kira",
    info: "Kira, Oran: %10"
  },
  {
    value: '044-20',
    code: '044',
    rate: 20,
    label: "044-Vakıflara (Mazbut Vakıflar Hariç) ve Derneklere Ait Taşınmazların Kiralanması Karşılığı Yapılan Ödemeler (GVK 94/1-5-b)",
    category: "Kira",
    info: "Kira, Oran: %20"
  },
  {
    value: '042-0',
    code: '042',
    rate: 0,
    label: "042-Kooperatiflere Ait Taşınmazların Kiralanması Karşılığı Yapılan Ödemeler (KVK Md. 15/1-b)",
    category: "Kira",
    info: "Kira"
  },
  {
    value: '043-0',
    code: '043',
    rate: 0,
    label: "043-Sinai Mülkiyet Hakkı (KVK Md .5/b) kiralaması",
    category: "Kira",
    info: "Kira"
  },
  {
    value: '024-3',
    code: '024',
    rate: 3,
    label: "024-2004 sayılı İcra ve İflas Kanunu ile 1136 sayılı Avukatlık Kanunu uyarınca karşı tarafa yükletilen vekalet ücreti ödemeleri",
    category: "Vekalet Ücreti",
    info: "Ücret ve Ücret Sayılan Ödemeler Hariç, Oran: %3"
  },
  {
    value: '023-0',
    code: '023',
    rate: 0,
    label: "023-Sinai Mülkiyet Hakkı (KVK Md.5/b)",
    category: "Serbest Meslek",
    info: "Serbest Meslek"
  },
  {
    value: '011-0',
    code: '011',
    rate: 0,
    label: "011-Asgari Ücretli (GVK Md. 94/1)",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '012-0',
    code: '012',
    rate: 0,
    label: "012-Diğer Ücretler ile Ücret Sayılan Ödemeler (GVK Md. 94/1)",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '013-0',
    code: '013',
    rate: 0,
    label: "013-Kıdem Tazminatı",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '014-0',
    code: '014',
    rate: 0,
    label: "014-Huzur Hakkı",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '015-0',
    code: '015',
    rate: 0,
    label: "015-İhbar Tazminatı",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '016-0',
    code: '016',
    rate: 0,
    label: "016-Yeraltı Maden İşçileri",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '017-0',
    code: '017',
    rate: 0,
    label: "017-4691/6550 Sayılı Kanun Kapsamı",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '018-0',
    code: '018',
    rate: 0,
    label: "018-Döner Sermaye/Performans/Ek Ders Odemesi/Ek ödeme/Kayyum-Bilirkişi ödemesi/Diğer",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '019-0',
    code: '019',
    rate: 0,
    label: "019-Gemi Çalışanları/Dar Mükellef Kurumların İrtibat Buroları/Apartman Kapıcıları",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '020-0',
    code: '020',
    rate: 0,
    label: "020-4691 sayılı kanun kapsamında çalışan işverenler/Muhtarlar/Elçiliklerde Çalışan Personel/GVK23/11 Kapsamında Çalışanlar/Diğer",
    category: "Ücret",
    info: "Ücret"
  },
  {
    value: '031-0',
    code: '031',
    rate: 0,
    label: "031-Birden Fazla Takvim Yılına Yaygın İnşaat ve Onarım İşleri Dolayısıyla Yapılan Hakediş Ödemeleri (GVK Md. 94/3)",
    category: "Yıllara Yaygın İnşaat",
    info: "Yıllara Yaygın İnşaat"
  },
  {
    value: '032-0',
    code: '032',
    rate: 0,
    label: "032-Birden Fazla Takvim Yılına Yaygın İnşaat ve Onarım İşleri İle Uğraşan Kurumlara Yapılan Hakediş Ödemeleri (KVK Md. 15/1-a)",
    category: "Yıllara Yaygın İnşaat",
    info: "Yıllara Yaygın İnşaat"
  },
  {
    value: '052-0',
    code: '052',
    rate: 0,
    label: "052-Men. Kıy. Yatırım Fonu ile Ort. Portföy Kazançları (GVK Geç. Md. 67/8)",
    category: "Yatırım Fonu veya Ort. Kazançları",
    info: "Yatırım Fonu veya Ort. Kazançları"
  },
  {
    value: '053-0',
    code: '053',
    rate: 0,
    label: "053-Altın ve Kıymetli Madenlere Dayalı Yatırım Fonu veya Ort. Portföy Kazançları (KVK Md. 15/3)",
    category: "Yatırım Fonu veya Ort. Kazançları",
    info: "Yatırım Fonu veya Ort. Kazançları"
  },
  {
    value: '054-0',
    code: '054',
    rate: 0,
    label: "054-Girişim Sermayesi Yatırım Fonu veya Ort. Kazançları (KVK Md. 15/3)",
    category: "Yatırım Fonu veya Ort. Kazançları",
    info: "Yatırım Fonu veya Ort. Kazançları"
  },
  {
    value: '055-0',
    code: '055',
    rate: 0,
    label: "055-Gayrimenkul Yatırım Fonu veya Ort. Kazançları (KVK Md. 15/3)",
    category: "Yatırım Fonu veya Ort. Kazançları",
    info: "Yatırım Fonu veya Ort. Kazançları"
  },
  {
    value: '056-0',
    code: '056',
    rate: 0,
    label: "056-Konut Finansmanı Fonu ile Varlık Finansmanı Fonu Kazançları (GVK Geç. Md. 67/8)",
    category: "Yatırım Fonu veya Ort. Kazançları",
    info: "Yatırım Fonu veya Ort. Kazançları"
  },
  {
    value: '061-15',
    code: '061',
    rate: 15,
    label: "061-Tam Mükellef Kurumlar Tarafından Dağıtılan Kar Payları (GVK Md. 94/6-b-i)",
    category: "Kar Payları",
    info: "Kurumların Dağıttıkları Kar Payları, Oran: %15"
  },
  {
    value: '062-15',
    code: '062',
    rate: 15,
    label: "062-Dar Mükellef Gerçek Kişilere Dağıtılan Kar Payları (GVK Md. 94/6-b-ii)",
    category: "Kar Payları",
    info: "Kurumların Dağıttıkları Kar Payları, Oran: %15"
  },
  {
    value: '065-0',
    code: '065',
    rate: 0,
    label: "065-Vergiden Muaf Olan Kurumlara Dağıtılan Kar Payları (KVK Md. 15/2)",
    category: "Kar Payları",
    info: "Kurumların Dağıttıkları Kar Payları"
  },
  {
    value: '066-0',
    code: '066',
    rate: 0,
    label: "066-Tam mükellef sermaye şirketlerince kendi hisse senetlerinin iktisap edilmesi (GVK md 94)",
    category: "Kar Payları",
    info: "Kurumların Dağıttığı Kar Payları"
  },
  {
    value: '071-0',
    code: '071',
    rate: 0,
    label: "071-Yatırım İndiriminden Yararlanan Kazançlar (GVK Geç. Md. 61)",
    category: "Yatırım İndirimi",
    info: "Yatırım İndirimi"
  },
  {
    value: '081-0',
    code: '081',
    rate: 0,
    label: "081-Her Nevi Tahvil ve Hazine Bonosu Faizleri (GVK Md. 94/7)",
    category: "Tahvil Faizleri",
    info: "Her Nevi Tahvil Faizleri"
  },
  {
    value: '082-0',
    code: '082',
    rate: 0,
    label: "082-Her Nevi Tahvil ve Hazine Bonosu Faizleri (GVK Geç. Md. 67/2)",
    category: "Tahvil Faizleri",
    info: "Her Nevi Tahvil Faizleri"
  },
  {
    value: '083-0',
    code: '083',
    rate: 0,
    label: "083-Her Nevi Tahvil ve Hazine Bonosu Faizleri (KVK Md.15/1-c)",
    category: "Tahvil Faizleri",
    info: "Her Nevi Tahvil Faizleri"
  },
  {
    value: '091-1',
    code: '091',
    rate: 1,
    label: "091-Ticaret Borsalarında Tescil Ettirilerek Satın Alınan Hayvanlar ve Mahsulleri (GVK Md. 94/11-a-i)",
    category: "Zirai Mahsul",
    info: "Zirai Mahsuller ve Hizmetler, Oran: %1"
  },
  {
    value: '092-2',
    code: '092',
    rate: 2,
    label: "092-Ticaret Borsalarında Tescil Ettirilmeksizin Satın Alınan Hayvanlar ve Mahsulleri (GVK Md. 94/11-a-ii)",
    category: "Zirai Mahsul",
    info: "Zirai Mahsuller ve Hizmetler, Oran: %2"
  },
  {
    value: '093-2',
    code: '093',
    rate: 2,
    label: "093-Ticaret Borsalarında Tescil Ettirilerek Satın Alınan Diğer Zirai Mahsuller (GVK Md. 94/11-b-i)",
    category: "Zirai Mahsul",
    info: "Zirai Mahsuller ve Hizmetler, Oran: %2"
  },
  {
    value: '094-4',
    code: '094',
    rate: 4,
    label: "094-Ticaret Borsalarında Tescil Ettirilmeksizin Satın Alınan Diğer Zirai Mahsuller (GVK Md. 94/11-b-ii)",
    category: "Zirai Mahsul",
    info: "Zirai Mahsuller ve Hizmetler, Oran: %4"
  },
  {
    value: '095-2',
    code: '095',
    rate: 2,
    label: "095-Zirai Faaliyet Kapsamında İfa Edilen Orman İdaresine Yapılan Ödemeler (GVK Md. 94/11-c-i)",
    category: "Zirai Mahsul",
    info: "Zirai Mahsuller ve Hizmetler, Oran: %2"
  },
  {
    value: '096-4',
    code: '096',
    rate: 4,
    label: "096-Zirai Faaliyet Kapsamında İfa Edilen Diğer Hizmetler (GVK Md. 94/11-c-ii)",
    category: "Zirai Mahsul",
    info: "Zirai Mahsuller ve Hizmetler, Oran: %4"
  },
  {
    value: '097-0',
    code: '097',
    rate: 0,
    label: "097-Destek Ödemeleri (GVK Md.94/11-aii; bii)",
    category: "Zirai Mahsul",
    info: "Zirai Mahsuller ve Hizmetler"
  },
  {
    value: '101-0',
    code: '101',
    rate: 0,
    label: "101-TL Mevduat Hesaplarına Yürütülen Faizler (GVK Geç. Md. 67/4)",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '102-0',
    code: '102',
    rate: 0,
    label: "102-Döviz Tevdiat Hesaplarına Faizler ve Katılım Kar Payları (GVK Geç. Md. 67/4)",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '103-0',
    code: '103',
    rate: 0,
    label: "103-Aralık Ayında Tahakkuk Ettirilen Mevduat Faizleri",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '104-0',
    code: '104',
    rate: 0,
    label: "104-Değişken Faiz Oranı Uygulanan 1 Yıldan Uzun Vadeli Hesaplar (GVK Geç. Md. 67/4)",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '105-0',
    code: '105',
    rate: 0,
    label: "105-Kur Korumalı Vadeli Mevduat Faizleri (GVK Geç. Md. 67/4)",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '106-0',
    code: '106',
    rate: 0,
    label: "106-Kur Korumalı Katılma Hesapları Faizleri (GVK Geç. Md. 67/4)",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '107-0',
    code: '107',
    rate: 0,
    label: "107-Altın Cinsinden Mevduat Hesapları Faizleri (GVK Geç. Md. 67/4)",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '108-0',
    code: '108',
    rate: 0,
    label: "108-Altın Cinsinden Katılım Fonu Hesapları Faizleri (GVK Geç. Md. 67/4)",
    category: "Mevduat Faizleri",
    info: "Mevduat Faizleri"
  },
  {
    value: '111-0',
    code: '111',
    rate: 0,
    label: "111-Faizsiz Kredi Verenlere Ödenen Kar Payları (GVK Geç. Md. 67/4)",
    category: "Kar Payları",
    info: "Faizsiz Kredi Kar Payları"
  },
  {
    value: '121-0',
    code: '121',
    rate: 0,
    label: "121-Repo Gelirleri (GVK Geç. Md. 67/4)",
    category: "Repo",
    info: "Repo"
  },
  {
    value: '131-15',
    code: '131',
    rate: 15,
    label: "131-Bireysel Emeklilik ve Şahıs Sigorta Şirketleri Ödemeleri (GVK Md. 94/15-a)",
    category: "Bireysel Emeklilik",
    info: "Bireysel Emeklilik Sistemi, Oran: %15"
  },
  {
    value: '132-10',
    code: '132',
    rate: 10,
    label: "132-Bireysel Emeklilik ve Şahıs Sigorta Şirketleri Ödemeleri (GVK Md. 94/15-b)",
    category: "Bireysel Emeklilik",
    info: "Bireysel Emeklilik Sistemi, Oran: %10"
  },
  {
    value: '134-15',
    code: '134',
    rate: 15,
    label: "134-Bireysel Emeklilik Sistemi Ödemeleri (GVK Md. 94/16-a)",
    category: "Bireysel Emeklilik",
    info: "Bireysel Emeklilik Sistemi, Oran: %15"
  },
  {
    value: '135-10',
    code: '135',
    rate: 10,
    label: "135-Bireysel Emeklilik Sistemi Ödemeleri (GVK Md. 94/16-b)",
    category: "Bireysel Emeklilik",
    info: "Bireysel Emeklilik Sistemi, Oran: %10"
  },
  {
    value: '136-5',
    code: '136',
    rate: 5,
    label: "136-Bireysel Emeklilik Sistemi Ödemeleri (GVK Md. 94/16-c)",
    category: "Bireysel Emeklilik",
    info: "Bireysel Emeklilik Sistemi, Oran: %5"
  },
  {
    value: '137-15',
    code: '137',
    rate: 15,
    label: "137-İnternet Ortamında Verilen Reklam Hizmetlerine İlişkin Ödemeler (GVK Md. 94/18)",
    category: "Reklam Hizmetleri",
    info: "İnternet Ortamında Verilen Reklam Hizmetleri, Oran: %15"
  },
  {
    value: '138-15',
    code: '138',
    rate: 15,
    label: "138-İnternet Ortamında Verilen Reklam Hizmetlerine Aracılık Edenlere Yapılan Ödemeler (GVK Md. 94/18)",
    category: "Reklam Hizmetleri",
    info: "İnternet Ortamında Verilen Reklam Hizmetleri, Oran: %15"
  },
  {
    value: '139-0',
    code: '139',
    rate: 0,
    label: "139-İnternet Ortamında Verilen Reklam Hizmetlerine İlişkin Ödemeler (KVK Md. 15/1-ğ)",
    category: "Reklam Hizmetleri",
    info: "İnternet Ortamında Verilen Reklam Hizmetleri"
  },
  {
    value: '140-0',
    code: '140',
    rate: 0,
    label: "140-İnternet Ortamında Reklam Hizmetlerine Aracılık Edenlere Ödemeler (KVK Md. 15/1-ğ)",
    category: "Reklam Hizmetleri",
    info: "İnternet Ortamında Verilen Reklam Hizmetleri"
  },
  {
    value: '141-20',
    code: '141',
    rate: 20,
    label: "141-Telif ve Patent Hakları Satışı (GVK Md. 94/4)",
    category: "Diğer Ödemeler",
    info: "Diğer Ödemeler, Oran: %20"
  },
  {
    value: '142-15',
    code: '142',
    rate: 15,
    label: "142-Milli Piyango ve Benzeri Bilet Satış Komisyon/Prim Ödemeleri (GVK Md. 94/10-a)",
    category: "Diğer Ödemeler",
    info: "Diğer Ödemeler, Oran: %15"
  },
  {
    value: '143-20',
    code: '143',
    rate: 20,
    label: "143-Kapı Kapı Dolaşmak Suretiyle Satış Yapanlara Komisyon/Prim Ödemeleri (GVK Md. 94/10-b)",
    category: "Diğer Ödemeler",
    info: "Diğer Ödemeler, Oran: %20"
  },
  {
    value: '144-20',
    code: '144',
    rate: 20,
    label: "144-PTT Acenteliği Yapanlara Ödenen Komisyon Bedeli (GVK Md. 94/12)",
    category: "Diğer Ödemeler",
    info: "Diğer Ödemeler, Oran: %20"
  },
  {
    value: '145-0',
    code: '145',
    rate: 0,
    label: "145-Esnaf Muaflığından Yararlananlara Mal ve Hizmet Alımları Ödemeleri (GVK Md. 94-13/a,c,d)",
    category: "Esnaf Muaflığı",
    info: "Diğer Ödemeler"
  },
  {
    value: '146-2',
    code: '146',
    rate: 2,
    label: "146-Esnaf Muaflığından Yararlananlara Hurda Mal Alımları Karşılığında Yapılan Ödemeler (GVK Md. 94/13-b)",
    category: "Esnaf Muaflığı",
    info: "Diğer Ödemeler, Oran: %2"
  },
  {
    value: '147-0',
    code: '147',
    rate: 0,
    label: "147-Esnaf Muaflığından Yararlananlara İhtiyaç Fazlası Elektrik Alımları Ödemeleri (GVK 94/13-ç)",
    category: "Esnaf Muaflığı",
    info: "Diğer Ödemeler"
  },
  {
    value: '148-0',
    code: '148',
    rate: 0,
    label: "148-Esnaf Muaflığından İnternet Üzerinden Yapılan Satışlar Ödemeleri (GVK Md. 9/10)",
    category: "Esnaf Muaflığı",
    info: "Diğer Ödemeler"
  },
  {
    value: '149-0',
    code: '149',
    rate: 0,
    label: "149-Sosyal İçerik Üreticiliğinde Kazanç İstisnası Kapsamında Yapılan Ödemeler (GVK mük. 20/B)",
    category: "Diğer Ödemeler",
    info: "Diğer Ödemeler"
  },
  {
    value: '150-0',
    code: '150',
    rate: 0,
    label: "150-Mobil Cihazlar İçin Uygulama Geliştiriciliğinde Kazanç İstisnası (GVK mük. 20/B)",
    category: "Diğer Ödemeler",
    info: "Diğer Ödemeler"
  },
  {
    value: '151-0',
    code: '151',
    rate: 0,
    label: "151-Diğerleri",
    category: "Diğer",
    info: "Diğerleri"
  },
  {
    value: '156-0',
    code: '156',
    rate: 0,
    label: "156-GVK Md. 9/(6)-(8) Bentleri Kapsamında Emtia/Hizmet Ödemeleri (GVK Md. 94/13-a)",
    category: "Esnaf Muaflığı",
    info: "Esnaf Muaflığı"
  },
  {
    value: '157-0',
    code: '157',
    rate: 0,
    label: "157-Diğer Mal Alımları (GVK Md. 94/13-c)",
    category: "Esnaf Muaflığı",
    info: "Esnaf Muaflığı"
  },
  {
    value: '158-0',
    code: '158',
    rate: 0,
    label: "158-Diğer Hizmet Alımları (GVK Md. 94/13-d)",
    category: "Esnaf Muaflığı",
    info: "Esnaf Muaflığı"
  },
  {
    value: '221-0',
    code: '221',
    rate: 0,
    label: "221-Dar Mükellef Kurumlara Yıllara Yaygın İnşaat Hakediş Ödemeleri (KVK Md. 30/1-a)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Yıllara Yaygın İnşaat"
  },
  {
    value: '231-0',
    code: '231',
    rate: 0,
    label: "231-Petrol Arama Faaliyetleri Serbest Meslek Ödemeleri (KVK Md. 30/1-b)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Serbest Meslek"
  },
  {
    value: '232-0',
    code: '232',
    rate: 0,
    label: "232-Diğer Serbest Meslek Kazancı Ödemeleri (KVK Md. 30/1-b)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Serbest Meslek"
  },
  {
    value: '233-0',
    code: '233',
    rate: 0,
    label: "233-KVK 30 / Sınai Mülkiyet Hakkı (KVK Md.5/b)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Serbest Meslek"
  },
  {
    value: '241-0',
    code: '241',
    rate: 0,
    label: "241-Finansal Kiralama Gayrimenkul Sermaye İratları (KVK Md. 30/1-c)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Gayrimenkul Sermaye İratları"
  },
  {
    value: '242-0',
    code: '242',
    rate: 0,
    label: "242-Diğer Gayrimenkul Sermaye İratları (KVK Md. 30/1-c)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Gayrimenkul Sermaye İratları"
  },
  {
    value: '243-0',
    code: '243',
    rate: 0,
    label: "243-KVK 30 / Sınai Mülkiyet Hakkı Kiralaması (KVK Md.5/b)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Gayrimenkul Sermaye İratları"
  },
  {
    value: '251-0',
    code: '251',
    rate: 0,
    label: "251-Her Nevi Tahvil ve Hazine Bonosu Faizleri (GVK Geç. Md. 67/2)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Menkul Sermaye İratları"
  },
  {
    value: '252-0',
    code: '252',
    rate: 0,
    label: "252-Her Nevi Tahvil ve Hazine Bonosu Faizleri (KVK Md. 30/1-ç)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Menkul Sermaye İratları"
  },
  {
    value: '253-0',
    code: '253',
    rate: 0,
    label: "253-Mevduat Faizleri (GVK Geç. Md. 67/4)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Menkul Sermaye İratları"
  },
  {
    value: '254-0',
    code: '254',
    rate: 0,
    label: "254-Faizsiz Kredi Verenlere Ödenen Kar Payları (GVK Geç. Md. 67/4)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Menkul Sermaye İratları"
  },
  {
    value: '256-0',
    code: '256',
    rate: 0,
    label: "256-GVK 75/10 Menkul Sermaye İratları (KVK Md. 30/1-ç)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Menkul Sermaye İratları"
  },
  {
    value: '257-0',
    code: '257',
    rate: 0,
    label: "257-Repo Gelirleri (GVK Geç. Md. 67/4)",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Menkul Sermaye İratları"
  },
  {
    value: '258-0',
    code: '258',
    rate: 0,
    label: "258-Diğer Menkul Sermaye İratları",
    category: "Dar Mükellef",
    info: "KVK 30 ÖDM - Menkul Sermaye İratları"
  },
  {
    value: '262-0',
    code: '262',
    rate: 0,
    label: "262-Bakanlar Kurulu Kararı Madde 1/(5-a) Alacak Faizleri",
    category: "Faizler",
    info: "Kar Payları Hariç Menkul Sermaye İratları"
  },
  {
    value: '263-0',
    code: '263',
    rate: 0,
    label: "263-Bakanlar Kurulu Kararı Madde 1/(5-b) Alacak Faizleri",
    category: "Faizler",
    info: "Kar Payları Hariç Menkul Sermaye İratları"
  },
  {
    value: '264-0',
    code: '264',
    rate: 0,
    label: "264-Bakanlar Kurulu Kararı Madde 1/(5-c) Vade Farkları",
    category: "Faizler",
    info: "Kar Payları Hariç Menkul Sermaye İratları"
  },
  {
    value: '265-0',
    code: '265',
    rate: 0,
    label: "265-Bakanlar Kurulu Kararı Madde 1/(5/ç) Diğer Alacak Faizleri",
    category: "Faizler",
    info: "Kar Payları Hariç Menkul Sermaye İratları"
  },
  {
    value: '271-0',
    code: '271',
    rate: 0,
    label: "271-Dar Mükellef Kurumlara Dağıtılan Kar Payları (KVK Md. 30/3)",
    category: "Kar Payları",
    info: "KVK 30 ÖDM - Kurumların Dağıttıkları Kar Payları"
  },
  {
    value: '272-0',
    code: '272',
    rate: 0,
    label: "272-Dar Mükellef Kurumlarca Ana Merkeze Aktarılan Tutarlar (KVK Md. 30/6)",
    category: "Kar Payları",
    info: "KVK 30 ÖDM - Kurumların Dağıttıkları Kar Payları"
  },
  {
    value: '279-15',
    code: '279',
    rate: 15,
    label: "279-İnternet Ortamında Verilen Reklam Hizmetleri (KVK Md. 30/1-d)",
    category: "Reklam Hizmetleri",
    info: "KVK 30ÖDM - İnternet Ortamında Verilen Reklam Hizmetleri, Oran: %15"
  },
  {
    value: '280-15',
    code: '280',
    rate: 15,
    label: "280-İnternet Reklam Hizmetlerine Aracılık Edenlere Ödemeler (KVK Md. 30/1-d)",
    category: "Reklam Hizmetleri",
    info: "KVK 30ÖDM - İnternet Ortamında Verilen Reklam Hizmetleri, Oran: %15"
  },
  {
    value: '281-0',
    code: '281',
    rate: 0,
    label: "281-Gayrimaddi Hakların Satışı, Devir ve Temliki (KVK Md. 30/2)",
    category: "Diğer Ödemeler",
    info: "KVK 30 ÖDM - Diğer Ödemeler"
  },
  {
    value: '282-0',
    code: '282',
    rate: 0,
    label: "282-Sergi ve Panayırlarda Yapılan Ticari Faaliyetler (KVK Md. 30/5)",
    category: "Diğer Ödemeler",
    info: "KVK 30 ÖDM - Diğer Ödemeler"
  },
  {
    value: '283-0',
    code: '283',
    rate: 0,
    label: "283-İlan Edilen Ülkelerde Yerleşik Olanlara Yapılan Ödemeler (KVK Md. 30/7)",
    category: "Diğer Ödemeler",
    info: "KVK 30 ÖDM - Diğer Ödemeler"
  },
  {
    value: '284-0',
    code: '284',
    rate: 0,
    label: "284-Diğerleri (KVK 30)",
    category: "Diğer Ödemeler",
    info: "KVK 30 ÖDM"
  },
  {
    value: '301-0',
    code: '301',
    rate: 0,
    label: "301-Resmi Daireler Mal ve Hizmet Alımları Makbuzları (Damga Vergisi)",
    category: "Damga Vergisi",
    info: "Damga Vergisi Kanununa Göre Yapılan Ödemeler"
  },
  {
    value: '302-0',
    code: '302',
    rate: 0,
    label: "302-Maaş, Ücret, Huzur Hakkı, İkramiye vb. Makbuzları (Damga Vergisi)",
    category: "Damga Vergisi",
    info: "Damga Vergisi Kanununa Göre Yapılan Ödemeler"
  },
  {
    value: '303-0',
    code: '303',
    rate: 0,
    label: "303-Ödünç Alınan Paralar İçin Verilen Makbuzlar / Senetler (Damga Vergisi)",
    category: "Damga Vergisi",
    info: "Damga Vergisi Kanununa Göre Yapılan Ödemeler"
  },
  {
    value: '519-0',
    code: '519',
    rate: 0,
    label: "519-Gemi Çalışanları",
    category: "Ücret",
    info: "Ücret"
  }
];

/**
 * Fatura özelliklerine göre en olası stopaj kodunu otomatik tahmin eder
 */
export function deduceStopajKodu(inv: any): string {
  const existingKod = String(inv.stopajKodu || '').trim();
  if (existingKod) {
    const found = LUCA_STOPAJ_KODLARI.find(k => k.value === existingKod || k.code === existingKod || k.value.startsWith(existingKod + '-'));
    if (found) return found.value;
  }

  const rate = parseFloat(inv.stopajOrani || '0') || 0;
  const desc = ((inv.aciklama || '') + ' ' + (inv.malHizmetAdi || '') + ' ' + (inv.ad || '') + ' ' + (inv.faturaNo || '')).toLowerCase();

  // Kira kontrolü
  if (desc.includes('kira') || desc.includes('gayrimenkul') || desc.includes('taşınmaz')) {
    if (rate === 10) return '041-10';
    return '041-20';
  }

  // Orana göre varsayılan eşleşmeler
  if (rate === 20 || rate === 0) {
    // SMM veya Genel Serbest Meslek
    return '022-20';
  }
  if (rate === 17) return '021-17';
  if (rate === 15) return '137-15';
  if (rate === 10) return '041-10';
  if (rate === 3) return '024-3';
  if (rate === 2) return '146-2';
  if (rate === 4) return '094-4';
  if (rate === 1) return '091-1';
  if (rate === 5) return '136-5';

  return '022-20';
}
