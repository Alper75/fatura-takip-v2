'use client';
import { useState, useEffect } from 'react';

const getTodayDateStr = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

export default function InvoiceList() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [startDate, setStartDate] = useState(getTodayDateStr());
    const [endDate, setEndDate] = useState(getTodayDateStr());
    const [previewHtml, setPreviewHtml] = useState('');

    const fetchInvoices = async () => {
        setLoading(true);
        setError('');
        try {
            // Convert YYYY-MM-DD to DD/MM/YYYY for API
            const formattedStart = startDate.split('-').reverse().join('/');
            const formattedEnd = endDate.split('-').reverse().join('/');
            
            const res = await fetch(`/api/invoices?startDate=${formattedStart}&endDate=${formattedEnd}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Faturalar alınamadı');
            
            setInvoices(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handlePreview = async (uuid) => {
        try {
            const res = await fetch(`/api/get-html?uuid=${uuid}&signed=false`);
            const html = await res.text();
            
            // Yeni pencerede aç ve yazdırma diyaloğunu tetikle
            const newWindow = window.open('', '_blank');
            newWindow.document.write(html);
            newWindow.document.close();
            
            // HTML tam yüklendikten sonra yazdır
            newWindow.onload = () => {
                newWindow.focus();
                newWindow.print();
            };
        } catch (err) {
            alert('Fatura görüntülenemedi: ' + err.message);
        }
    };

    return (
        <div className="glass-panel" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label className="input-label">Başlangıç Tarihi</label>
                    <input 
                        type="date" 
                        className="input-field" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                    />
                </div>
                <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label className="input-label">Bitiş Tarihi</label>
                    <input 
                        type="date" 
                        className="input-field" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                    />
                </div>
                <button 
                    onClick={fetchInvoices} 
                    disabled={loading}
                    className="submit-btn" 
                    style={{ flex: 1, padding: '12px' }}
                >
                    {loading ? 'Yükleniyor...' : 'Sorgula'}
                </button>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</div>}

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-color)' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                            <th style={{ padding: '12px' }}>Tarih</th>
                            <th style={{ padding: '12px' }}>Belge No</th>
                            <th style={{ padding: '12px' }}>Alıcı</th>
                            <th style={{ padding: '12px' }}>Tutar</th>
                            <th style={{ padding: '12px' }}>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Kayıt bulunamadı.</td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.ettn} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px' }}>{inv.belgeTarihi}</td>
                                    <td style={{ padding: '12px' }}>{inv.belgeNumarasi || 'Taslak'}</td>
                                    <td style={{ padding: '12px' }}>{inv.aliciUnvanAdSoyad}</td>
                                    <td style={{ padding: '12px' }}>
                                        {inv.odenecekTutar || inv.toplamTutar || inv.vergilerDahilToplamTutar || inv.faturaTutari || inv.tutar || '0.00'} {inv.paraBirimi || 'TRY'}
                                    </td>
                                    <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handlePreview(inv.ettn)}
                                            style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
                                        >
                                            Yazdır / PDF
                                        </button>
                                        <a 
                                            href={`/api/download?uuid=${inv.ettn}&signed=false`}
                                            style={{ background: '#4b5563', color: 'white', textDecoration: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.9rem', display: 'inline-block' }}
                                        >
                                            ZIP İndir
                                        </a>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
