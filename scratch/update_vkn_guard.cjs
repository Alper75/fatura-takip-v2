const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '../../luca_extension');

// Read luca_content.js and update verifyCompanyGuard to strictly match by VKN / TCKN
const lucaContentPath = path.join(extDir, 'luca_content.js');
let lucaContent = fs.readFileSync(lucaContentPath, 'utf8');

// Replace verifyCompanyGuard function
const newVerifyCompanyGuard = `  // ==================== 🛡️ FİRMA DOĞRULAMA GÜVENLİK KİLİDİ (SADECE VKN / TCKN) ====================
  function getLucaActiveCompanyInfo() {
    try {
      const topDoc = window.top ? window.top.document : document;
      const allText = (topDoc.body ? topDoc.body.innerText : '') + ' ' + (topDoc.title || '');
      
      // Luca üst banner ve müşteri bilgi alanları
      const elMusteri = topDoc.getElementById('musteriAdi') || topDoc.querySelector('.musteri-adi') || topDoc.querySelector('#sirketAdi') || topDoc.querySelector('.customer-name');
      const unvan = elMusteri ? elMusteri.innerText.trim() : (topDoc.title || '');
      
      // Tüm metindeki 10 veya 11 haneli sayıları (VKN/TCKN) tara
      const vknMatches = allText.match(/\\b\\d{10,11}\\b/g) || [];

      return { unvan, allText, vknMatches };
    } catch(e) {
      return { unvan: '', allText: '', vknMatches: [] };
    }
  }

  function verifyCompanyGuard(targetCompany) {
    if (!targetCompany || !targetCompany.vkn) {
      return { ok: true }; // VKN belirtilmemişse geç
    }

    const targetVkn = targetCompany.vkn.toString().replace(/\\D/g, '').trim();
    if (!targetVkn || (targetVkn.length !== 10 && targetVkn.length !== 11)) {
      return { ok: true };
    }

    const { allText, vknMatches } = getLucaActiveCompanyInfo();

    // 🎯 SADECE VE DOĞRUDAN VKN/TCKN EŞLEŞTİRMESİ
    // Ünvan değişse, kısaltılsa veya farklı yazılsa bile VKN benzersizdir!
    if (vknMatches.includes(targetVkn) || allText.includes(targetVkn)) {
      return { ok: true, matchedBy: 'VKN: ' + targetVkn };
    }

    return {
      ok: false,
      targetVkn,
      targetUnvan: targetCompany.unvan || ''
    };
  }`;

// Update luca_content.js with the new strict VKN guard
lucaContent = lucaContent.replace(/\/\/ ==================== 🛡️ FİRMA DOĞRULAMA GÜVENLİK KİLİDİ[\s\S]*?return \{\s*ok: false,\s*targetVkn,\s*targetUnvan\s*\};\s*\}/, newVerifyCompanyGuard);

fs.writeFileSync(lucaContentPath, lucaContent, 'utf8');
console.log('luca_content.js updated with STRICT VKN MATCHING!');
