import type { AlisFaturaFormData } from '@/types';

export const KDV_ORANLARI = ['0', '1', '8', '10', '18', '20'];
export const TEVKIFAT_ORANLARI = ['0', '2/10', '3/10', '4/10', '5/10', '7/10', '9/10', '10/10'];

export const INITIAL_FORM: AlisFaturaFormData = {
  faturaNo: '',
  faturaTarihi: new Date().toISOString().split('T')[0],
  vadeTarihi: '',
  tedarikciAdi: '',
  tedarikciVkn: '',
  malHizmetAdi: '',
  toplamTutar: '',
  kdvOrani: '20',
  tevkifatOrani: '0',
  stopajOrani: '0',
  oivTutari: '0',
  aciklama: ''
};

export type FormEntry = {
  id: number;
  data: AlisFaturaFormData;
  tutarTuru: 'dahil' | 'haric';
  errors: Partial<Record<keyof AlisFaturaFormData, string>>;
  aiError?: string;
};

export type UploadedFile = {
  base64: string;
  mimeType: string;
  name: string;
  status?: 'pending' | 'scanning' | 'success' | 'error';
  errorMessage?: string;
};

export const compressImageIfNeeded = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  if (file.type === 'application/pdf') {
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { base64: b64, mimeType: file.type };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedB64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ base64: compressedB64, mimeType: 'image/jpeg' });
        } else {
          resolve({ base64: event.target?.result as string, mimeType: file.type });
        }
      };
      img.onerror = () => {
        resolve({ base64: event.target?.result as string, mimeType: file.type });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);

export const getHesaplanan = (f: FormEntry) => {
  if (f.data.mahsupSatirlari && f.data.mahsupSatirlari.length > 0) {
    let tMatrah = 0;
    let tKdv = 0;
    let tOiv = parseFloat(f.data.oivTutari || '0') || 0;
    f.data.mahsupSatirlari.forEach(s => {
      tMatrah += s.matrah || 0;
      tKdv += s.kdvTutari || 0;
      if (s.oivTutari) tOiv += s.oivTutari;
    });
    const finalTotal = parseFloat(f.data.toplamTutar) || (tMatrah + tKdv + tOiv);
    return {
      matrah: tMatrah,
      kdvTutari: tKdv,
      oivTutari: tOiv,
      tevkifatTutari: 0,
      stopajTutari: 0,
      toplamNet: finalTotal
    };
  }
  const tutar = parseFloat(f.data.toplamTutar) || 0;
  const kdvOran = parseFloat(f.data.kdvOrani) || 0;
  const oivTutari = parseFloat(f.data.oivTutari || '0') || 0;
  const tutarForTax = Math.max(0, tutar - (f.tutarTuru === 'dahil' ? oivTutari : 0));
  const matrah = f.tutarTuru === 'dahil' ? tutarForTax / (1 + kdvOran / 100) : tutarForTax;
  const kdvTutari = matrah * (kdvOran / 100);
  const tevParts = (f.data.tevkifatOrani || '0').split('/');
  const tevRate = tevParts.length === 2 ? Number(tevParts[0]) / Number(tevParts[1]) : 0;
  const tevkifatTutari = kdvTutari * tevRate;
  const stopajRate = (parseFloat(f.data.stopajOrani || '0') || 0) / 100;
  const stopajTutari = matrah * stopajRate;
  const toplamNet = f.tutarTuru === 'dahil' ? tutar : (matrah + kdvTutari + oivTutari - tevkifatTutari - stopajTutari);
  return { matrah, kdvTutari, oivTutari, tevkifatTutari, stopajTutari, toplamNet };
};

export const consolidateInvoicesByKdv =   (items: any[]): any[] => {
    if (!Array.isArray(items) || items.length <= 1) return items || [];

    const groups: { [key: string]: any } = {};

    for (const item of items) {
      if (!item) continue;
      let rawKdv = String(item.kdv_orani || item.kdvOrani || item.kdv || '20').replace(/[^0-9]/g, '') || '20';
      if (rawKdv === '8') rawKdv = '10';
      if (rawKdv === '18') rawKdv = '20';
      if (!['1', '10', '20', '0'].includes(rawKdv)) {
        rawKdv = '20';
      }
      const faturaNo = (item.faturaNo || item.fatura_no || item.belgeNo || item.belge_no || '').trim().toLowerCase();
      const vendor = (item.tedarikciVkn || item.tedarikci_vkn || item.tedarikciAdi || item.tedarikci_adi || '').trim().toLowerCase();
      const date = (item.faturaTarihi || item.fatura_tarihi || item.tarih || '').trim();

      const groupKey = faturaNo 
        ? `no:${faturaNo}_kdv:${rawKdv}`
        : `v:${vendor}_d:${date}_kdv:${rawKdv}`;

      const numTutar = parseFloat(String(item.tutar || item.toplam_tutar || item.toplamTutar || item.amount || item.total || '0').replace(',', '.')) || 0;
      const itemName = (item.malHizmetAdi || item.mal_hizmet_adi || item.urun_adi || item.urunAdi || item.aciklama || item.description || '').trim();

      if (!groups[groupKey]) {
        groups[groupKey] = {
          ...item,
          _receiptKey: faturaNo ? `no:${faturaNo}` : `v:${vendor}_d:${date}`,
          kdv_orani: rawKdv,
          kdvOrani: rawKdv,
          _numericTotal: numTutar,
          _itemNames: itemName ? [itemName] : []
        };
      } else {
        groups[groupKey]._numericTotal += numTutar;
        if (itemName && !groups[groupKey]._itemNames.includes(itemName)) {
          groups[groupKey]._itemNames.push(itemName);
        }
        if (!groups[groupKey].plate && (item.plate || item.plaka || item.vehicle_plate)) {
          groups[groupKey].plate = item.plate || item.plaka || item.vehicle_plate;
        }
        if (!groups[groupKey].kredi_karti_son4 && item.kredi_karti_son4) {
          groups[groupKey].kredi_karti_son4 = item.kredi_karti_son4;
        }
        if (!groups[groupKey].muhasebe_kodu && (item.muhasebe_kodu || item.muhasebeKodu)) {
          groups[groupKey].muhasebe_kodu = item.muhasebe_kodu || item.muhasebeKodu;
        }
      }
    }

    // ==================== ÇOKLU KDV VE TOPKDV OTOMATİK DÜZELTME MOTORU ====================
    // Fişlerde %10 doğru okunup %20'ye fişteki TOPLAM KDV'nin yazılması hatasını matematiksel olarak onarır.
    const receiptGroups: { [key: string]: any[] } = {};
    for (const g of Object.values(groups)) {
      const rKey = g._receiptKey || 'default';
      if (!receiptGroups[rKey]) receiptGroups[rKey] = [];
      receiptGroups[rKey].push(g);
    }

    for (const rKey of Object.keys(receiptGroups)) {
      const subItems = receiptGroups[rKey];
      if (subItems.length <= 1) continue; // Tek KDV oranlı fişlerde gerek yok

      // Fişin genel toplamı ve toplam KDV değerini yakala
      let genelToplam = 0;
      let topKdv = 0;
      for (const it of subItems) {
        const gt = parseFloat(String(it.genel_toplam || it.genelToplam || it.grandTotal || it.toplamTutarGenel || '0').replace(',', '.')) || 0;
        if (gt > genelToplam) genelToplam = gt;

        const tk = parseFloat(String(it.toplam_kdv || it.topkdv || it.toplamKdv || it.kdv_toplam || '0').replace(',', '.')) || 0;
        if (tk > topKdv) topKdv = tk;
      }

      const item20 = subItems.find(x => x.kdv_orani === '20');
      const otherItems = subItems.filter(x => x.kdv_orani !== '20');
      const sumOtherTutars = otherItems.reduce((acc, x) => acc + (x._numericTotal || 0), 0);

      if (item20 && otherItems.length > 0) {
        const currentTutar20 = item20._numericTotal || 0;
        const totalOfAllSubgroups = sumOtherTutars + currentTutar20;

        // Durum A: Genel Toplam biliniyor ve alt grupların toplamı Genel Toplam'dan küçük kalıyor
        // Veya %20 grubunun tutarı doğrudan TOPKDV'ye eşit atanmışsa
        const isAssignedTopKdvDirectly = topKdv > 0 && Math.abs(currentTutar20 - topKdv) <= 0.5;
        const isSumMismatch = genelToplam > 0 && Math.abs(totalOfAllSubgroups - genelToplam) > 0.5 && totalOfAllSubgroups < genelToplam;

        if (genelToplam > 0 && (isAssignedTopKdvDirectly || isSumMismatch)) {
          const correctedTutar20 = Math.max(0, genelToplam - sumOtherTutars);
          if (correctedTutar20 > 0) {
            console.log(`[Multi-KDV AutoFix] %20 grubuna TOPKDV atanması düzeltildi: ${currentTutar20} TL -> ${correctedTutar20.toFixed(2)} TL (Genel Toplam: ${genelToplam} TL)`);
            item20._numericTotal = Math.round(correctedTutar20 * 100) / 100;
          }
        } else if (topKdv > 0 && isAssignedTopKdvDirectly) {
          // Genel Toplam açıkça gelmediyse ama TOPKDV varsa:
          // %10 (ve varsa %1) KDV'lerini hesapla, TOPKDV'den çıkar -> gerçek %20 KDV'sini ve dahil tutarını bul
          let otherKdvSum = 0;
          for (const oi of otherItems) {
            const rate = parseFloat(oi.kdv_orani) || 10;
            const mat = oi._numericTotal / (1 + rate / 100);
            otherKdvSum += (oi._numericTotal - mat);
          }
          const realKdv20 = Math.max(0, topKdv - otherKdvSum);
          // Dahil Tutar = Matrah + KDV = (realKdv20 / 0.20) * 1.20 = realKdv20 * 6
          const realTutar20 = Math.round(realKdv20 * 6 * 100) / 100;
          if (realTutar20 > 0) {
            console.log(`[Multi-KDV AutoFix] TOPKDV üzerinden %20 tutarı türetildi: ${currentTutar20} TL -> ${realTutar20.toFixed(2)} TL (Gerçek %20 KDV: ${realKdv20.toFixed(2)} TL)`);
            item20._numericTotal = realTutar20;
          }
        }
      }
    }

    return Object.values(groups).map((group: any) => {
      const finalItem = { ...group };
      finalItem.tutar = group._numericTotal.toFixed(2);
      finalItem.toplamTutar = finalItem.tutar;
      finalItem.toplam_tutar = finalItem.tutar;
      
      if (group._itemNames && group._itemNames.length > 0) {
        if (group._itemNames.length === 1) {
          finalItem.malHizmetAdi = group._itemNames[0];
        } else {
          const joined = group._itemNames.slice(0, 3).join(', ');
          finalItem.malHizmetAdi = `${joined}${group._itemNames.length > 3 ? ' vb.' : ''} (%${group.kdv_orani} KDV Harcaması)`;
        }
        finalItem.urun_adi = finalItem.malHizmetAdi;
        finalItem.urunAdi = finalItem.malHizmetAdi;
      }
      delete finalItem._receiptKey;
      delete finalItem._numericTotal;
      delete finalItem._itemNames;
      return finalItem;
    });
  };
