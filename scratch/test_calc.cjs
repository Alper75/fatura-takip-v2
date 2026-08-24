// calculateFaturaHesaplamalari test — 4 fatura tipi
const parseTevkifat = (oran) => {
  if (!oran || oran === '0' || !oran.includes('/')) return 0;
  const [pay, payda] = oran.split('/').map(Number);
  return payda > 0 ? (pay / payda) : 0;
};

const calculateFaturaHesaplamalari = (tutar, kdvStr, tevStr, stopajStr, tutarTuru = 'dahil') => {
  const kdvOrani = parseFloat(kdvStr) / 100;
  const stopajOrani = parseFloat(stopajStr || '0') / 100;
  const tevkifatCarpani = parseTevkifat(tevStr);

  let matrah = 0;
  if (tutarTuru === 'haric') {
    matrah = !isNaN(tutar) ? tutar : 0;
  } else {
    const carpan = 1 + kdvOrani - stopajOrani - (kdvOrani * tevkifatCarpani);
    matrah = (carpan > 0 && !isNaN(tutar)) ? tutar / carpan : 0;
  }

  const kdvTutari = matrah * kdvOrani || 0;
  const stopajTutari = matrah * stopajOrani || 0;
  const tevkifatTutari = kdvTutari * tevkifatCarpani || 0;
  const toplamNet = matrah + kdvTutari - stopajTutari - tevkifatTutari;

  return {
    matrah: Math.round(matrah * 100) / 100,
    kdvTutari: Math.round(kdvTutari * 100) / 100,
    stopajTutari: Math.round(stopajTutari * 100) / 100,
    tevkifatTutari: Math.round(tevkifatTutari * 100) / 100,
    toplamNet: Math.round(toplamNet * 100) / 100
  };
};

console.log('=== TEST 1: Normal Fatura (KDV %20, Matrah 20000) ===');
const t1 = calculateFaturaHesaplamalari(20000, '20', '0', '0', 'haric');
console.log(t1);
console.assert(t1.matrah === 20000, 'Matrah yanlış');
console.assert(t1.kdvTutari === 4000, 'KDV yanlış');
console.assert(t1.toplamNet === 24000, 'Toplam yanlış');
console.log('✓ Normal fatura DOĞRU\n');

console.log('=== TEST 2: Tevkifatlı Fatura (%20 KDV, 3/10 Tevkifat, Matrah 20000) ===');
const t2 = calculateFaturaHesaplamalari(20000, '20', '3/10', '0', 'haric');
console.log(t2);
console.assert(t2.matrah === 20000, 'Matrah yanlış');
console.assert(t2.kdvTutari === 4000, 'KDV yanlış');
console.assert(t2.tevkifatTutari === 1200, 'Tevkifat yanlış');
console.assert(t2.toplamNet === 22800, 'Toplam yanlış');
console.log('✓ Tevkifatlı fatura DOĞRU\n');

console.log('=== TEST 3: Stopajlı Fatura (%20 KDV, %15 Stopaj, Matrah 20000) ===');
const t3 = calculateFaturaHesaplamalari(20000, '20', '0', '15', 'haric');
console.log(t3);
console.assert(t3.matrah === 20000, 'Matrah yanlış');
console.assert(t3.kdvTutari === 4000, 'KDV yanlış');
console.assert(t3.stopajTutari === 3000, 'Stopaj yanlış');
console.assert(t3.toplamNet === 21000, 'Toplam yanlış');
console.log('✓ Stopajlı fatura DOĞRU\n');

console.log('=== TEST 4: Tevkifat + Stopaj (%20 KDV, 3/10 Tevkifat, %15 Stopaj, Matrah 20000) ===');
const t4 = calculateFaturaHesaplamalari(20000, '20', '3/10', '15', 'haric');
console.log(t4);
console.assert(t4.matrah === 20000, 'Matrah yanlış');
console.assert(t4.kdvTutari === 4000, 'KDV yanlış');
console.assert(t4.tevkifatTutari === 1200, 'Tevkifat yanlış');
console.assert(t4.stopajTutari === 3000, 'Stopaj yanlış');
console.assert(t4.toplamNet === 19800, 'Toplam yanlış — kullanıcı 19800 bekliyor');
console.log('✓ Tevkifat+Stopaj karma fatura DOĞRU\n');

console.log('=== TEST 5: Karma Fatura — Ters Hesap (Net 19800 üzerinden) ===');
const t5 = calculateFaturaHesaplamalari(19800, '20', '3/10', '15', 'dahil');
console.log(t5);
console.assert(t5.matrah === 20000, 'Matrah yanlış');
console.assert(t5.kdvTutari === 4000, 'KDV yanlış');
console.assert(t5.tevkifatTutari === 1200, 'Tevkifat yanlış');
console.assert(t5.stopajTutari === 3000, 'Stopaj yanlış');
console.assert(t5.toplamNet === 19800, 'Toplam yanlış');
console.log('✓ Ters hesap (net tutardan matrah bulma) DOĞRU\n');

console.log('=== TEST 6: Normal Fatura — Ters Hesap (Net 24000 üzerinden) ===');
const t6 = calculateFaturaHesaplamalari(24000, '20', '0', '0', 'dahil');
console.log(t6);
console.assert(t6.matrah === 20000, 'Matrah yanlış');
console.assert(t6.kdvTutari === 4000, 'KDV yanlış');
console.assert(t6.toplamNet === 24000, 'Toplam yanlış');
console.log('✓ Normal ters hesap DOĞRU\n');

console.log('=== TÜM TESTLER BAŞARILI ===');
