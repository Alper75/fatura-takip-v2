const fs = require('fs');

const endpoints = `
// ==========================================
// YAPAY ZEKA (AKILLI ÖĞRENME) KURALLARI
// ==========================================

app.get('/api/yapay-zeka-kurallari', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM yapay_zeka_kurallari WHERE company_id = ? ORDER BY olusturma_tarihi DESC',
      args: [req.user.companyId]
    });
    res.json({ success: true, kurallar: rs.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/yapay-zeka-kurallari', authMiddleware, async (req, res) => {
  try {
    const { kural_tipi, kural_adi, anahtar_kelime, muhasebe_kodu } = req.body;
    const id = uuidv4();
    await client.execute({
      sql: 'INSERT INTO yapay_zeka_kurallari (id, company_id, kural_tipi, kural_adi, anahtar_kelime, muhasebe_kodu) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, req.user.companyId, kural_tipi, kural_adi, anahtar_kelime, muhasebe_kodu]
    });
    res.json({ success: true, message: 'Kural eklendi', id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/yapay-zeka-kurallari/:id', authMiddleware, async (req, res) => {
  try {
    await client.execute({
      sql: 'DELETE FROM yapay_zeka_kurallari WHERE id = ? AND company_id = ?',
      args: [req.params.id, req.user.companyId]
    });
    res.json({ success: true, message: 'Kural silindi' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// YAPAY ZEKA ÖĞRENME ENDPOINTI
app.post('/api/ai/learn', authMiddleware, async (req, res) => {
  try {
    const { muavinBase64, muavinFileName, faturalarBase64, faturalarFileName, kuralTipi } = req.body;
    
    // AI API Keys
    const rsSettings = await client.execute({
      sql: "SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN ('gemini_api_key', 'gemini_model')",
      args: [req.user.companyId]
    });
    
    let apiKey = process.env.GEMINI_API_KEY;
    let aiModel = 'gemini-1.5-pro'; // Better for large context
    
    rsSettings.rows.forEach(r => {
      if (r.setting_key === 'gemini_api_key') apiKey = r.setting_value || apiKey;
      if (r.setting_key === 'gemini_model' && r.setting_value) aiModel = r.setting_value;
    });

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Yapay zeka anahtarı (Gemini API Key) bulunamadı. Lütfen ayarlardan tanımlayın.' });
    }

    // Process Excel/JSON files (for now we send the raw texts/base64 to Gemini depending on size, but we can do simple parsing)
    // Here we construct a prompt and attach the data
    const prompt = \`Sen kıdemli bir mali müşavir ve veri analistisin. Sana bir firmanın geçmiş dönem "Muavin Defter" dökümü ve "Fatura Listesi (veya Banka Listesi)" verilerini vereceğim.
Amacın, geçmiş işlemlere bakarak deterministik muhasebe kodu atama kuralları çıkarmaktır.

Verilen kural tipi: \${kuralTipi} (fatura veya banka)

ÇIKTI FORMATI:
Sadece JSON dizisi döndür. Başka hiçbir açıklama yazma.
Örnek Çıktı:
[
  { "anahtar_kelime": "YEMEKSEPETİ", "muhasebe_kodu": "770.01.001", "kural_adi": "Yemek Giderleri" },
  { "anahtar_kelime": "GARANTİ EFT", "muhasebe_kodu": "102.01", "kural_adi": "Banka Hareketi" }
]

KURALLAR:
1. Kurallar mantıklı ve spesifik olmalıdır. "A.Ş." gibi çok genel kelimeler kullanma.
2. Sadece en çok tekrar eden ve en emin olduğun kuralları çıkar (max 20 adet).

VERİLER:
Muavin Verisi: \${muavinBase64.substring(0, 10000)}... [Veri boyutu nedeniyle kırpılmış olabilir]
Dış Veri: \${faturalarBase64.substring(0, 10000)}...
\`;

    const { default: axios } = require('axios');
    const safeModelName = aiModel.trim();
    
    const geminiRes = await axios.post(\`https://generativelanguage.googleapis.com/v1beta/models/\${safeModelName}:generateContent?key=\${apiKey.trim()}\`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });

    const aiText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const jsonMatch = aiText.match(/\\[[\\s\\S]*\\]/);
    let rules = [];
    if (jsonMatch) {
      try {
        rules = JSON.parse(jsonMatch[0]);
      } catch(e) {}
    }

    res.json({ success: true, rules });

  } catch (error) {
    console.error("AI Learn Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
`;

let code = fs.readFileSync('api/index.js', 'utf8');
const target = "app.use('/uploads', express.static(uploadsDir));";
code = code.replace(target, endpoints + '\n' + target);
fs.writeFileSync('api/index.js', code, 'utf8');
console.log('Endpoints injected successfully!');
