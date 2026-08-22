const fs = require('fs');
let code = fs.readFileSync('src/sections/BankaEkstreListesi.tsx', 'utf8');

// 1. Add hook for yapayZekaKurallari at the top
const hookStr = `
  const [yapayZekaKurallari, setYapayZekaKurallari] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/yapay-zeka-kurallari', { headers: { Authorization: \`Bearer \${token}\` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setYapayZekaKurallari(data.kurallar.filter((k: any) => k.kural_tipi === 'banka'));
        }
      })
      .catch(console.error);
  }, []);
`;

if (!code.includes('setYapayZekaKurallari')) {
  code = code.replace(
    "const [kuralForm, setKuralForm] = useState({",
    hookStr + "\n  const [kuralForm, setKuralForm] = useState({"
  );
}

// 2. Modify handleKurallariUygula
const applyStrTarget = `  const handleKurallariUygula = () => {
    let count = 0;
    for (const h of cariHareketler) {`;

const applyStrReplace = `  const handleKurallariUygula = () => {
    let count = 0;
    
    // Convert AI rules to the same format as masrafKurallari so they can be processed easily
    const aiRulesConverted = yapayZekaKurallari.map(ai => ({
       anahtarKelime: ai.anahtar_kelime,
       muhasebeKodu: ai.muhasebe_kodu,
       islemTuru: 'genel_gider', // default assumption for bank AI rules
       kategoriId: ''
    }));
    
    const combinedRules = [...masrafKurallari, ...aiRulesConverted];
    
    for (const h of cariHareketler) {
      if (!h.aciklama) continue;
      
      const aciklamaUpper = h.aciklama.toLocaleUpperCase('tr-TR');
      let matchedRule = combinedRules.find(k => aciklamaUpper.includes((k.anahtarKelime || '').toLocaleUpperCase('tr-TR')));
      
      if (matchedRule) {
        const updates: Partial<CariHareket> = {};
        let needsUpdate = false;
        
        if (matchedRule.islemTuru && h.islemTuru !== matchedRule.islemTuru) {
           let targetIslemTuru = matchedRule.islemTuru;
           if (matchedRule.kategoriId) {
             const cat = giderKategorileri.find(c => c.id === matchedRule.kategoriId);
             if (cat?.tip === 'GELIR' && targetIslemTuru === 'genel_gider') {
               targetIslemTuru = 'diger_gelir';
             }
           }
           updates.islemTuru = targetIslemTuru;
           needsUpdate = true;
        }
        
        if (h.cariId && h.cariId !== 'sistem') {
           updates.cariId = 'sistem';
           needsUpdate = true;
        }

        if (matchedRule.kategoriId && h.kategoriId !== matchedRule.kategoriId) {
           updates.kategoriId = matchedRule.kategoriId;
           needsUpdate = true;
           
           if (!matchedRule.muhasebeKodu) {
             const cat = giderKategorileri.find(k => k.id === matchedRule.kategoriId);
             if (cat?.muhasebeKodu && h.muhasebeKodu !== cat.muhasebeKodu) {
               updates.muhasebeKodu = cat.muhasebeKodu;
             }
           }
        }
        
        if (matchedRule.muhasebeKodu && h.muhasebeKodu !== matchedRule.muhasebeKodu) {
           updates.muhasebeKodu = matchedRule.muhasebeKodu;
           needsUpdate = true;
        }
        
        if (needsUpdate) {
           updateCariHareket(h.id, updates);
           count++;
        }
      }
    }
    toast.success(\`Kurallar \${count} adet geçmiş harekete uygulandı.\`);
  };
  
  // Prevent duplicate definition by commenting out old one
  /*
  const handleKurallariUygulaOld = () => {`;

if (!code.includes('const combinedRules')) {
  // First, we need to find the end of handleKurallariUygula to close the comment block
  code = code.replace(applyStrTarget, applyStrReplace);
  
  // Find where handleTransferleriBul starts to end the comment block
  code = code.replace(
    "  const handleTransferleriBul = () => {",
    "  */\n  const handleTransferleriBul = () => {"
  );
}

fs.writeFileSync('src/sections/BankaEkstreListesi.tsx', code);
console.log('BankaEkstreListesi updated');
