import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cachedPdfParse = undefined;
function getPdfParse() {
  if (cachedPdfParse !== undefined) return cachedPdfParse;
  try {
    // pdf-parse/lib/pdf-parse.js doğrudan yüklenerek ESM altındaki test dosyası okuma hatası önlenir
    cachedPdfParse = require('pdf-parse/lib/pdf-parse.js');
  } catch (err) {
    console.warn('[BankStatementParser] pdf-parse paketi yüklenemedi:', err.message);
    cachedPdfParse = null;
  }
  return cachedPdfParse;
}

export function normalizeAsciiUpper(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/i/g, 'I')
    .replace(/ı/g, 'I')
    .replace(/ğ/g, 'G')
    .replace(/ü/g, 'U')
    .replace(/ş/g, 'S')
    .replace(/ö/g, 'O')
    .replace(/ç/g, 'C')
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTurkishCurrency(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw || '').trim();
  if (!s) return 0;

  const isNeg = s.startsWith('-') || /\(\s*-\s*\)/.test(s);
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return 0;

  const dotCount = (s.match(/\./g) || []).length;
  const commaCount = (s.match(/,/g) || []).length;

  if (dotCount > 0 && commaCount > 0) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (dotCount > 1) {
    s = s.replace(/\./g, '');
  }

  const val = parseFloat(s);
  if (!Number.isFinite(val)) return 0;
  return isNeg ? -Math.abs(val) : Math.abs(val);
}

export function extractLeadingDate(text) {
  const s = String(text || '').trim();
  // Dönem aralığı satırlarını ("01.03.2026 - 31.03.2026") dışla
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*-\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(s)) {
    return null;
  }

  // Satır başında opsiyonel sıra/fiş/şube no (ör: "1  15.03.2026" veya "20260012 15/03/2026") + işlem tarihi + opsiyonel saat ve valör tarihi
  const match = s.match(
    /^(?:(?:#?\d{1,12})\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?(?:\s+(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2}))?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\b/
  );
  if (!match) return null;

  const rawDate = match[1];
  let iso = '';

  const isoMatch = rawDate.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  } else {
    const trMatch = rawDate.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (trMatch) {
      let [, d, m, y] = trMatch;
      if (y.length === 2) y = `20${y}`;
      const year = parseInt(y, 10);
      const month = parseInt(m, 10);
      const day = parseInt(d, 10);
      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }

  if (!iso) return null;
  return {
    isoDate: iso,
    consumedLength: match[0].length,
    remainder: s.slice(match[0].length).trim(),
  };
}

function isSummaryOrNoiseLine(upperLine) {
  if (!upperLine) return true;
  const skipPatterns = [
    'DEVREDEN BAKIYE',
    'ONCEKI BAKIYE',
    'DONEM BASI BAKIYE',
    'DONEM SONU BAKIYE',
    'ACILIS BAKIYESI',
    'KAPANIS BAKIYESI',
    'TOPLAM BORC',
    'TOPLAM ALACAK',
    'GENEL TOPLAM',
    'SAYFA TOPLAMI',
    'BU BELGE 5070',
    'ELEKTRONIK IMZA',
    'MUSTERI HIZMETLERI',
    'TICARET SICIL',
    'MERSIS NO',
  ];
  if (skipPatterns.some((p) => upperLine.includes(p))) return true;
  if (/^SAYFA\s*\d+\s*(\/\s*\d+)?$/.test(upperLine)) return true;
  return false;
}

function isHeaderLine(upperLine) {
  const hasDate = upperLine.includes('TARIH') || upperLine.includes('VALOR');
  const hasCol =
    upperLine.includes('ACIKLAMA') ||
    upperLine.includes('TUTAR') ||
    upperLine.includes('BORC') ||
    upperLine.includes('ALACAK') ||
    upperLine.includes('BAKIYE') ||
    upperLine.includes('DETAY');
  return hasDate && hasCol;
}

function guessDirectionFromDescription(desc) {
  const u = normalizeAsciiUpper(desc);
  if (
    /\b(GELEN|TAHSILAT|ALACAK|YATIRILAN|PARA YATIRMA|POS GECIS|UYE ISYERI|IADE)\b/.test(u) &&
    !/\b(UCRET|KOMISYON|MASRAF|BSMV|GIDEN)\b/.test(u)
  ) {
    return 'alacak';
  }
  if (
    /\b(GIDEN|ODEME|ODEMESI|KOMISYON|MASRAF|UCRET|UCRETI|BSMV|VERGI|SGK|SSK|BAGKUR|MAAS|CEKILEN|PARA CEKME|KREDI|KART ODEME|FATURA ODEME|OTOMATIK ODEME|STOPAJ|DAMGA)\b/.test(
      u
    )
  ) {
    return 'borc';
  }
  return null;
}

/**
 * Bir satırdaki tüm para tutarlarını (ör: -1.450,75 TL, +25.000,00, 120,00 (B), 0,00) bulur.
 * VKN, IBAN, saat, tarih ve yüzdeleri dışlar.
 */
function findAmountsInRemainder(remainder, cellPositions = null) {
  const results = [];
  // Ondalık kuruşlu (.XX veya ,XX) para tutarlarını yakala
  const amountRegex =
    /(?<![%\dA-Za-z.,])([+-]?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d+)[.,]\d{2})(?:\s*(?:TL|TRY|TRL|USD|EUR|GBP|CHF))?(?:\s*\(?([BAba]|BOR[CÇ]|ALACAK|GIRIS|GİRİŞ|CIKIS|ÇIKIŞ)\)?)?(?![\d.,])/g;

  let m;
  while ((m = amountRegex.exec(remainder)) !== null) {
    const rawMatch = m[0];
    const numPart = m[1].replace(/\s+/g, '');
    const dirToken = (m[2] || '').toUpperCase();
    const signedVal = parseTurkishCurrency(numPart);
    const absVal = Math.abs(signedVal);

    const isNegative = numPart.startsWith('-');
    const isPositive = numPart.startsWith('+');

    let explicitDir = null;
    if (isNegative) explicitDir = 'borc';
    else if (isPositive) explicitDir = 'alacak';
    else if (dirToken === 'B' || dirToken.startsWith('BOR') || dirToken.startsWith('CIK') || dirToken.startsWith('ÇIK')) {
      explicitDir = 'borc';
    } else if (dirToken === 'A' || dirToken.startsWith('ALA') || dirToken.startsWith('GIR') || dirToken.startsWith('GİR')) {
      explicitDir = 'alacak';
    }

    // Hücre X koordinatı varsa eşleştir
    let xPos = null;
    if (Array.isArray(cellPositions)) {
      const matchedCell = cellPositions.find((c) => c.text.includes(numPart));
      if (matchedCell) xPos = matchedCell.x;
    }

    results.push({
      index: m.index,
      endIndex: m.index + rawMatch.length,
      rawMatch,
      absVal,
      isNegative,
      isPositive,
      explicitDir,
      x: xPos,
    });
  }

  return results;
}

/**
 * pdf-parse pagerender kancası ile her sayfadaki metin öğelerini Y/X koordinatlarına göre
 * gerçek tablo satırlarına dönüştürür.
 */
async function extractStructuredLinesFromPdf(buffer) {
  const pdfParseFn = getPdfParse();
  if (!pdfParseFn) {
    throw new Error('Sunucuda pdf-parse kurulu değil. Lütfen sunucuda npm install çalıştırın.');
  }

  const allStructuredLines = [];

  const options = {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });

      const items = [];
      for (const item of textContent.items || []) {
        const str = String(item.str || '');
        if (!str.trim()) continue;
        const x = item.transform ? Number(item.transform[4]) || 0 : 0;
        const y = item.transform ? Number(item.transform[5]) || 0 : 0;
        const w = Number(item.width) || str.length * 4.5;
        items.push({ str, x, y, w });
      }

      // Y koordinatına göre satırları grupla (±3.2pt tolerans)
      const rowGroups = [];
      for (const it of items) {
        let group = rowGroups.find((g) => Math.abs(g.y - it.y) <= 3.2);
        if (!group) {
          group = { y: it.y, items: [] };
          rowGroups.push(group);
        }
        group.items.push(it);
      }

      // PDF koordinatlarında sayfa üstü daha büyük Y değerine sahiptir -> yukarıdan aşağıya sırala
      rowGroups.sort((a, b) => b.y - a.y);

      const pageTextLines = [];
      for (const group of rowGroups) {
        group.items.sort((a, b) => a.x - b.x);

        const cells = [];
        for (const it of group.items) {
          const prev = cells[cells.length - 1];
          // Çok yakın karakter parçalarını aynı hücrede birleştir, sütun boşluklarını ayrı hücre tut
          if (prev && it.x - prev.endX < 4.5) {
            const spacer = it.x - prev.endX > 1.2 && !prev.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '';
            prev.text += spacer + it.str;
            prev.endX = Math.max(prev.endX, it.x + it.w);
          } else {
            cells.push({
              x: it.x,
              endX: it.x + it.w,
              text: it.str.trim(),
            });
          }
        }

        const lineText = cells.map((c) => c.text).join('\t').trim();
        if (lineText) {
          allStructuredLines.push({ text: lineText, cells });
          pageTextLines.push(lineText);
        }
      }

      return pageTextLines.join('\n');
    },
  };

  const pdfData = await pdfParseFn(buffer, options);
  return {
    lines: allStructuredLines,
    rawText: pdfData?.text || '',
    pageCount: pdfData?.numpages || 1,
  };
}

/**
 * Koordinatlı veya düz metin satırlarından tamamen kural ve bakiye matematiğiyle (Yapay Zekasız!)
 * tüm Türk bankalarının ekstre hareketlerini çıkarır.
 */
export function parseDeterministicStatementLines(structuredLines) {
  let headerCols = {
    borcX: null,
    alacakX: null,
    tutarX: null,
    bakiyeX: null,
    yonX: null,
  };

  let openingBalance = null;
  const rawTxList = [];
  let pendingDateOnly = null; // Tarih+Açıklama üst satırda, Tutar alt satırda olan PDF'ler için

  for (let idx = 0; idx < structuredLines.length; idx++) {
    const entry =
      typeof structuredLines[idx] === 'string'
        ? { text: structuredLines[idx], cells: null }
        : structuredLines[idx];

    const lineText = String(entry.text || '').replace(/\t+/g, '  ').trim();
    if (!lineText) continue;

    const upper = normalizeAsciiUpper(lineText);

    // Devreden / Dönem Başı Bakiye satırından başlangıç bakiyesini yakala (hareket olarak ekleme)
    if (
      upper.includes('DEVREDEN BAKIYE') ||
      upper.includes('ONCEKI BAKIYE') ||
      upper.includes('DONEM BASI BAKIYE') ||
      upper.includes('ACILIS BAKIYESI')
    ) {
      const balAmounts = findAmountsInRemainder(lineText, entry.cells);
      if (balAmounts.length > 0) {
        const last = balAmounts[balAmounts.length - 1];
        openingBalance = last.isNegative ? -last.absVal : last.absVal;
      }
      pendingDateOnly = null;
      continue;
    }

    // Tablo başlık satırından sütun X koordinatlarını öğren
    if (isHeaderLine(upper)) {
      if (Array.isArray(entry.cells)) {
        for (const c of entry.cells) {
          const cu = normalizeAsciiUpper(c.text);
          const centerX = (c.x + c.endX) / 2;
          if ((cu === 'BORC' || cu.includes('BORC TUTAR') || cu === 'CIKIS') && !cu.includes('ALACAK')) {
            headerCols.borcX = centerX;
          } else if (cu === 'ALACAK' || cu.includes('ALACAK TUTAR') || cu === 'GIRIS') {
            headerCols.alacakX = centerX;
          } else if (cu.includes('TUTAR') || cu === 'MIKTAR') {
            headerCols.tutarX = centerX;
          } else if (cu.includes('BAKIYE')) {
            headerCols.bakiyeX = centerX;
          } else if (cu === 'B/A' || cu === 'BORC/ALACAK' || cu === 'YON') {
            headerCols.yonX = centerX;
          }
        }
      }
      pendingDateOnly = null;
      continue;
    }

    if (isSummaryOrNoiseLine(upper)) {
      pendingDateOnly = null;
      continue;
    }

    const leadingDate = extractLeadingDate(lineText);

    if (leadingDate) {
      const amounts = findAmountsInRemainder(leadingDate.remainder, entry.cells);

      if (amounts.length === 0) {
        // Tarih var ama tutar bir alt satıra sarkmış olabilir
        pendingDateOnly = {
          tarih: leadingDate.isoDate,
          descParts: leadingDate.remainder ? [leadingDate.remainder] : [],
        };
        continue;
      }

      pendingDateOnly = null;
      const parsedTx = buildRawTxFromLine(
        leadingDate.isoDate,
        leadingDate.remainder,
        amounts,
        entry.cells,
        headerCols
      );
      if (parsedTx) {
        rawTxList.push(parsedTx);
      }
    } else {
      // Tarih ile başlamayan satır: ya üstteki tarihin tutar satırıdır ya da açıklama devam satırıdır
      const amounts = findAmountsInRemainder(lineText, entry.cells);

      if (pendingDateOnly && amounts.length > 0) {
        const beforeFirstAmt = lineText.slice(0, amounts[0].index).trim();
        if (beforeFirstAmt) pendingDateOnly.descParts.push(beforeFirstAmt);
        const combinedRemainder = `${pendingDateOnly.descParts.join(' ')}  ${lineText.slice(amounts[0].index)}`;
        const shiftedAmounts = findAmountsInRemainder(combinedRemainder, entry.cells);
        const parsedTx = buildRawTxFromLine(
          pendingDateOnly.tarih,
          combinedRemainder,
          shiftedAmounts,
          entry.cells,
          headerCols
        );
        if (parsedTx) rawTxList.push(parsedTx);
        pendingDateOnly = null;
      } else if (pendingDateOnly && amounts.length === 0) {
        if (lineText.length < 160) {
          pendingDateOnly.descParts.push(lineText);
        } else {
          pendingDateOnly = null;
        }
      } else if (rawTxList.length > 0 && amounts.length === 0) {
        // Önceki hareketin alt satıra taşan açıklaması (sayfa başlığı/IBAN özeti değilse ekle)
        if (
          lineText.length <= 140 &&
          !/^(HESAP|SUBE|MUSTERI|IBAN|DOVIZ|TARIH|SAYFA)\b/i.test(upper)
        ) {
          const prevTx = rawTxList[rawTxList.length - 1];
          prevTx.aciklama = `${prevTx.aciklama} ${lineText}`.replace(/\s+/g, ' ').trim();
        }
      }
    }
  }

  // Bakiye matematiği ile işaretsiz satırların Giriş/Çıkış (alacak/borc) yönünü %100 doğrula
  resolveDirectionsWithRunningBalance(rawTxList, openingBalance);

  return rawTxList.map((tx) => ({
    tarih: tx.tarih,
    aciklama: tx.aciklama || 'Banka Hareketi',
    tutar: tx.tutar,
    tip: tx.tip || guessDirectionFromDescription(tx.aciklama) || 'borc',
  }));
}

function buildRawTxFromLine(isoDate, remainder, amounts, cells, headerCols) {
  if (!amounts || amounts.length === 0) return null;

  let txAmtObj = null;
  let balanceVal = null;
  let lockedTip = null;

  const hasSeparateDebitCredit = headerCols.borcX !== null && headerCols.alacakX !== null;

  if (amounts.length === 1) {
    txAmtObj = amounts[0];
  } else if (amounts.length === 2) {
    const [a0, a1] = amounts;
    // Ayrı Borç / Alacak sütunu olup biri 0,00 diğeri > 0 ise (ve Bakiye sütunu yoksa)
    if (hasSeparateDebitCredit && headerCols.bakiyeX === null && (a0.absVal === 0 || a1.absVal === 0)) {
      if (a0.absVal > 0) {
        txAmtObj = a0;
        lockedTip = 'borc';
      } else if (a1.absVal > 0) {
        txAmtObj = a1;
        lockedTip = 'alacak';
      }
    } else {
      // Standart [İşlem Tutarı, Bakiye]
      txAmtObj = a0;
      balanceVal = a1.isNegative ? -a1.absVal : a1.absVal;
    }
  } else {
    // 3 veya daha fazla tutar: örn [Borç, Alacak, Bakiye] veya açıklama içinde tutar + [Tutar, Bakiye]
    const last3 = amounts.slice(-3);
    const [bCol, aCol, balCol] = last3;
    if (bCol.absVal === 0 && aCol.absVal > 0) {
      txAmtObj = aCol;
      lockedTip = 'alacak';
      balanceVal = balCol.isNegative ? -balCol.absVal : balCol.absVal;
    } else if (bCol.absVal > 0 && aCol.absVal === 0) {
      txAmtObj = bCol;
      lockedTip = 'borc';
      balanceVal = balCol.isNegative ? -balCol.absVal : balCol.absVal;
    } else {
      txAmtObj = amounts[amounts.length - 2];
      const last = amounts[amounts.length - 1];
      balanceVal = last.isNegative ? -last.absVal : last.absVal;
    }
  }

  if (!txAmtObj || txAmtObj.absVal <= 0) return null;

  // Yön tespiti: 1) Açık +/- veya (B)/(A), 2) Ayrı B/A hücresi, 3) Borç/Alacak sütun X koordinatı
  if (!lockedTip && txAmtObj.explicitDir) {
    lockedTip = txAmtObj.explicitDir;
  }

  if (!lockedTip && Array.isArray(cells)) {
    for (const c of cells) {
      const cu = normalizeAsciiUpper(c.text);
      if (cu === 'B' || cu === '(B)' || cu === 'BORC' || cu === 'CIKIS') {
        lockedTip = 'borc';
        break;
      }
      if (cu === 'A' || cu === '(A)' || cu === 'ALACAK' || cu === 'GIRIS') {
        lockedTip = 'alacak';
        break;
      }
    }
  }

  if (!lockedTip && hasSeparateDebitCredit && txAmtObj.x !== null) {
    const distBorc = Math.abs(txAmtObj.x - headerCols.borcX);
    const distAlacak = Math.abs(txAmtObj.x - headerCols.alacakX);
    if (Math.abs(distBorc - distAlacak) > 12) {
      lockedTip = distBorc < distAlacak ? 'borc' : 'alacak';
    }
  }

  // Açıklamayı çıkar: tutarlardan önceki ve sonraki anlamlı metin parçalarını birleştir
  const firstAmountIdx = amounts[0].index;
  const lastAmountEndIdx = amounts[amounts.length - 1].endIndex;
  const cleanPiece = (str) =>
    String(str || '')
      .replace(/^\(?([BAba]|BOR[CÇ]|ALACAK)\)?$/i, '')
      .replace(/\b(TL|TRY|TRL|USD|EUR|GBP)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const leftDesc = cleanPiece(remainder.slice(0, firstAmountIdx));
  const rightDesc = cleanPiece(remainder.slice(lastAmountEndIdx));
  const desc = [leftDesc, rightDesc].filter(Boolean).join(' - ');

  return {
    tarih: isoDate,
    aciklama: desc,
    tutar: txAmtObj.absVal,
    tip: lockedTip, // null ise bakiye geçişinde çözülür
    balance: balanceVal,
  };
}

function resolveDirectionsWithRunningBalance(txList, openingBalance = null) {
  if (txList.length === 0) return;

  const withBal = txList.filter((t) => typeof t.balance === 'number' && Number.isFinite(t.balance));
  if (withBal.length < 2 && openingBalance === null) return;

  // Ekstre eskiden-yeniye (ascending) mi, yeniden-eskiye (descending) mi sıralı tespit et
  let ascMatches = 0;
  let descMatches = 0;

  for (let i = 1; i < txList.length; i++) {
    const prev = txList[i - 1];
    const curr = txList[i];
    if (prev.balance === null || curr.balance === null) continue;

    if (
      Math.abs(prev.balance - curr.tutar - curr.balance) < 0.05 ||
      Math.abs(prev.balance + curr.tutar - curr.balance) < 0.05
    ) {
      ascMatches++;
    }
    if (
      Math.abs(curr.balance - prev.tutar - prev.balance) < 0.05 ||
      Math.abs(curr.balance + prev.tutar - prev.balance) < 0.05
    ) {
      descMatches++;
    }
  }

  const isDescendingOrder = descMatches > ascMatches;

  if (!isDescendingOrder) {
    // Eskiden yeniye: curr.balance = prev.balance ± curr.tutar
    for (let i = 0; i < txList.length; i++) {
      if (txList[i].tip) continue;
      const prevBal = i === 0 ? openingBalance : txList[i - 1].balance;
      const currBal = txList[i].balance;
      if (prevBal === null || currBal === null) continue;

      if (Math.abs(prevBal - txList[i].tutar - currBal) < 0.05) {
        txList[i].tip = 'borc';
      } else if (Math.abs(prevBal + txList[i].tutar - currBal) < 0.05) {
        txList[i].tip = 'alacak';
      }
    }
    // İlk satır için açılış bakiyesi yoksa 2. satırdan geriye doğru kontrol et
    if (!txList[0].tip && txList.length >= 2 && txList[0].balance !== null) {
      // İlk satırın yönü açıklama anahtar kelimesine bırakılır
    }
  } else {
    // Yeniden eskiye: prev(üstteki yeni satır).balance = curr(alttaki eski satır).balance ± prev.tutar
    for (let i = 0; i < txList.length - 1; i++) {
      if (txList[i].tip) continue;
      const newerBal = txList[i].balance;
      const olderBal = txList[i + 1].balance;
      if (newerBal === null || olderBal === null) continue;

      if (Math.abs(olderBal - txList[i].tutar - newerBal) < 0.05) {
        txList[i].tip = 'borc';
      } else if (Math.abs(olderBal + txList[i].tutar - newerBal) < 0.05) {
        txList[i].tip = 'alacak';
      }
    }
  }
}

/**
 * Okunabilir PDF ekstreyi YAPAY ZEKA KULLANMADAN doğrudan koordinat + kural + bakiye matematiğiyle ayrıştırır.
 */
export async function parseBankStatementFile({ fileBase64, fileName = '', mimeType = '' }) {
  if (!fileBase64) {
    throw new Error('Dosya verisi bulunamadı.');
  }

  const rawBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  const buffer = Buffer.from(rawBase64, 'base64');
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  const isPdf = lowerMime === 'application/pdf' || lowerName.endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Bu uç nokta yalnızca PDF ekstre ayrıştırması içindir; Excel/CSV dosyaları doğrudan tarayıcıda okunur.');
  }

  const { lines, rawText, pageCount } = await extractStructuredLinesFromPdf(buffer);

  const nonSpaceLen = (rawText || '').replace(/\s+/g, '').length;
  if (lines.length === 0 || nonSpaceLen < 20) {
    throw new Error(
      'Bu PDF dosyasında seçilebilir metin bulunamadı (taranmış görüntü/fotoğraf PDF). Lütfen internet bankacılığından indirilen orijinal PDF veya Excel ekstresini yükleyin.'
    );
  }

  const rows = parseDeterministicStatementLines(lines);

  if (rows.length === 0) {
    // Yedek: Ham pdf-parse satırları üzerinden de dene
    const fallbackLines = (rawText || '').split(/\r?\n/).filter((l) => l.trim());
    const fallbackRows = parseDeterministicStatementLines(fallbackLines);
    if (fallbackRows.length > 0) {
      return {
        rows: fallbackRows,
        pageCount,
        method: 'pdf-direct-raw',
        provider: 'local',
      };
    }

    const previewSample = lines
      .slice(0, 8)
      .map((l) => l.text)
      .join(' | ')
      .slice(0, 250);
    console.warn(`[BankStatementParser] 0 satır eşleşti (${fileName}). İlk satırlar:`, previewSample);
    throw new Error(
      'PDF metni okundu ancak standart banka hareket tablosu (Tarih + Tutar) tespit edilemedi. Dosya şifreli font içeriyor olabilir.'
    );
  }

  return {
    rows,
    pageCount,
    method: 'pdf-direct',
    provider: 'local',
  };
}
