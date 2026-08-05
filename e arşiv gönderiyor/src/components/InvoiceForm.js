"use client";

import { useState } from 'react';

export default function InvoiceForm({ credentials }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [invoiceHtml, setInvoiceHtml] = useState(null);

  const getTodayDateStr = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getCurrentTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({
    title: '',
    taxIDOrTRID: '',
    fullAddress: '',
    itemName: '',
    quantity: 1,
    unitPrice: 0,
    VATRate: 20,
    invoiceType: 'SATIS',
    stopajRate: 0,
    tevkifatCode: '',
    tevkifatRate: 0, // Pay (Örn: 5 -> 5/10)
    date: getTodayDateStr(),
    time: getCurrentTimeStr(),
    sign: false
  });

  const tevkifatCodes = [
    { code: '601', name: '601 - Yapım İşleri (3/10)', rate: 3 },
    { code: '602', name: '602 - Danışmanlık, Denetim vb. (9/10)', rate: 9 },
    { code: '603', name: '603 - Bakım Onarım (7/10)', rate: 7 },
    { code: '604', name: '604 - Yemek Servis (5/10)', rate: 5 },
    { code: '607', name: '607 - Özel Güvenlik (9/10)', rate: 9 },
    { code: '612', name: '612 - Temizlik Hizmeti (9/10)', rate: 9 },
    { code: '622', name: '622 - Pamuk, Yün, Post vb. (2/10)', rate: 2 },
    { code: '624', name: '624 - Yük Taşımacılığı (2/10)', rate: 2 },
    { code: '625', name: '625 - Ticari Reklam (10/10)', rate: 10 },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'tevkifatCode') {
        const selected = tevkifatCodes.find(c => c.code === value);
        setFormData(prev => ({ 
            ...prev, 
            tevkifatCode: value,
            tevkifatRate: selected ? selected.rate : 0
        }));
    } else {
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    }
  };

  const calculateTotals = () => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.unitPrice) || 0;
    const vatRate = parseFloat(formData.VATRate) || 0;
    const stopajRate = parseFloat(formData.stopajRate) || 0;
    const tevkifatRatePay = parseFloat(formData.tevkifatRate) || 0;
    
    const subtotal = qty * price;
    const vatAmount = subtotal * (vatRate / 100);
    const stopajAmount = subtotal * (stopajRate / 100);
    const tevkifatAmount = formData.invoiceType === 'TEVKIFAT' ? (vatAmount * (tevkifatRatePay / 10)) : 0;
    
    const grandTotal = subtotal + vatAmount - stopajAmount - tevkifatAmount;

    return { subtotal, vatAmount, stopajAmount, tevkifatAmount, grandTotal };
  };

  const loadHtml = async (uuid, token) => {
    try {
      console.log("HTML yükleniyor...", uuid);
      const res = await fetch('/api/get-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uuid, signed: formData.sign, env: credentials.env })
      });
      if (res.ok) {
        const html = await res.text();
        console.log("HTML Başarıyla yüklendi");
        setInvoiceHtml(html);
      } else {
        console.error("HTML yükleme hatası:", await res.text());
      }
    } catch(err) {
      console.error("HTML yüklenemedi", err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setInvoiceHtml(null);

    const totals = calculateTotals();

    const invoiceDetails = {
      date: formData.date,
      time: formData.time,
      taxIDOrTRID: formData.taxIDOrTRID || "11111111111",
      title: formData.title,
      invoiceType: formData.invoiceType,
      fullAddress: formData.fullAddress,
      items: [
        {
          name: formData.itemName,
          quantity: parseFloat(formData.quantity),
          unitPrice: parseFloat(formData.unitPrice),
          price: parseFloat(formData.unitPrice),
          VATRate: parseFloat(formData.VATRate),
          VATAmount: totals.vatAmount,
          tevkifatKodu: formData.invoiceType === 'TEVKIFAT' ? formData.tevkifatCode : "",
          tevkifatOrani: formData.invoiceType === 'TEVKIFAT' ? formData.tevkifatRate : 0,
          tevkifatAmount: totals.tevkifatAmount,
          stopajRate: parseFloat(formData.stopajRate),
          stopajAmount: totals.stopajAmount
        }
      ],
      subtotal: totals.subtotal,
      totalVAT: totals.vatAmount,
      totalStopaj: totals.stopajAmount,
      totalTevkifat: totals.tevkifatAmount,
      gelirVergisiOrani: parseFloat(formData.stopajRate),
      gelirVergisiTevkifatiTutari: totals.stopajAmount.toFixed(2),
      grandTotalInclVAT: totals.subtotal + totals.vatAmount,
      paymentTotal: totals.grandTotal
    };

    try {
      const res = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          env: credentials.env,
          sign: formData.sign,
          invoiceDetails
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Fatura oluşturulamadı');
      }

      setMessage(`Fatura başarıyla oluşturuldu! UUID: ${data.uuid}`);
      await loadHtml(data.uuid, data.token);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vatAmount, stopajAmount, tevkifatAmount, grandTotal } = calculateTotals();

  return (
    <div className="glass-panel">
      <h2 className="section-title">Yeni Fatura Oluştur</h2>
      
      <form onSubmit={handleCreate}>
        <div className="flex-row">
          <div className="input-group">
            <label className="input-label">Alıcı Ünvanı / Ad Soyad</label>
            <input name="title" value={formData.title} onChange={handleChange} required className="input-field" placeholder="Müşteri Adı" />
          </div>
          <div className="input-group">
            <label className="input-label">VKN / TCKN</label>
            <input name="taxIDOrTRID" value={formData.taxIDOrTRID} onChange={handleChange} required className="input-field" placeholder="11111111111" />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Adres</label>
          <input name="fullAddress" value={formData.fullAddress} onChange={handleChange} required className="input-field" placeholder="Açık Adres" />
        </div>

        <div className="flex-row">
          <div className="input-group">
            <label className="input-label">Fatura Tarihi (GG/AA/YYYY)</label>
            <input name="date" value={formData.date} onChange={handleChange} required className="input-field" placeholder="DD/MM/YYYY" />
          </div>
          <div className="input-group">
            <label className="input-label">Fatura Saati</label>
            <input name="time" value={formData.time} onChange={handleChange} required className="input-field" placeholder="HH:MM:SS" />
          </div>
        </div>

        <div className="flex-row">
            <div className="input-group">
                <label className="input-label">Fatura Tipi</label>
                <select name="invoiceType" value={formData.invoiceType} onChange={handleChange} className="input-field">
                    <option value="SATIS">SATIŞ</option>
                    <option value="TEVKIFAT">TEVKİFAT</option>
                    <option value="ISTISNA">İSTİSNA</option>
                </select>
            </div>
            <div className="input-group">
                <label className="input-label">Stopaj Oranı (%)</label>
                <select name="stopajRate" value={formData.stopajRate} onChange={handleChange} className="input-field">
                    <option value="0">0</option>
                    <option value="20">20 (Serbest Meslek)</option>
                    <option value="17">17</option>
                    <option value="15">15</option>
                    <option value="3">3</option>
                    <option value="2">2</option>
                </select>
            </div>
        </div>

        {formData.invoiceType === 'TEVKIFAT' && (
            <div className="input-group">
                <label className="input-label">Tevkifat Kodu</label>
                <select name="tevkifatCode" value={formData.tevkifatCode} onChange={handleChange} className="input-field" required>
                    <option value="">Kod Seçiniz...</option>
                    {tevkifatCodes.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                </select>
            </div>
        )}

        <h3 className="section-title" style={{ fontSize: '1.1rem', marginTop: '1rem' }}>Ürün / Hizmet Bilgisi</h3>

        <div className="input-group">
          <label className="input-label">Ürün Adı</label>
          <input name="itemName" value={formData.itemName} onChange={handleChange} required className="input-field" placeholder="Hizmet Adı" />
        </div>

        <div className="flex-row">
          <div className="input-group">
            <label className="input-label">Miktar</label>
            <input type="number" step="0.01" name="quantity" value={formData.quantity} onChange={handleChange} required className="input-field" />
          </div>
          <div className="input-group">
            <label className="input-label">Birim Fiyat (₺)</label>
            <input type="number" step="0.01" name="unitPrice" value={formData.unitPrice} onChange={handleChange} required className="input-field" />
          </div>
          <div className="input-group">
            <label className="input-label">KDV Oranı (%)</label>
            <select name="VATRate" value={formData.VATRate} onChange={handleChange} className="input-field">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Ara Toplam:</span>
            <span>{subtotal.toFixed(2)} ₺</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>KDV Tutarı:</span>
            <span>{vatAmount.toFixed(2)} ₺</span>
          </div>
          {stopajAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#f87171' }}>
                <span style={{ color: 'var(--text-muted)' }}>Stopaj Tutarı (-):</span>
                <span>{stopajAmount.toFixed(2)} ₺</span>
            </div>
          )}
          {tevkifatAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#f87171' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tevkifat Tutarı (-):</span>
                <span>{tevkifatAmount.toFixed(2)} ₺</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ color: 'var(--primary)' }}>Ödenecek Tutar:</span>
            <span>{grandTotal.toFixed(2)} ₺</span>
          </div>
        </div>

        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="sign" name="sign" checked={formData.sign} onChange={handleChange} style={{ width: '1.2rem', height: '1.2rem' }} />
          <label htmlFor="sign" className="input-label" style={{ marginBottom: 0 }}>Oluşturulduktan sonra otomatik imzala (Dikkat: Mali değeri vardır!)</label>
        </div>

        {error && <div className="error-text" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>{error}</div>}
        {message && <div className="success-text" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '0.5rem' }}>{message}</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <div className="spinner"></div> : 'Fatura Taslağı Oluştur'}
        </button>
      </form>

      {invoiceHtml && (
        <div style={{ marginTop: '2rem' }}>
          <h3 className="section-title">Fatura Önizleme</h3>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', maxHeight: '500px' }}>
            <iframe 
              srcDoc={invoiceHtml} 
              style={{ width: '100%', height: '500px', border: 'none', background: 'white' }} 
              title="Fatura HTML"
            />
          </div>
        </div>
      )}
    </div>
  );
}
