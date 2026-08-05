"use client";

import { useState } from 'react';
import InvoiceForm from '@/components/InvoiceForm';
import InvoiceList from '@/components/InvoiceList';

export default function Home() {
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [env, setEnv] = useState('PROD');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, env })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Giriş başarısız');
      }

      setCredentials({ username, password, env, token: data.token });
      // Set token cookie for API routes
      document.cookie = `gib_token=${data.token}; path=/; max-age=86400`;
      document.cookie = `gib_env=${env}; path=/; max-age=86400`;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCredentials(null);
    document.cookie = 'gib_token=; path=/; max-age=0';
    document.cookie = 'gib_env=; path=/; max-age=0';
  };

  return (
    <main className="container">
      <div className="center-wrapper" style={credentials ? { alignItems: 'flex-start', paddingTop: '2rem' } : {}}>
        <div style={{ width: '100%' }}>
          <h1 className="header-title">e-Arşiv Fatura</h1>
          <p className="header-subtitle">Hızlı, güvenli ve kolay fatura yönetimi</p>

          {!credentials ? (
            <div className="glass-panel" style={{ maxWidth: '400px', margin: '0 auto' }}>
              <h2 className="section-title">Giriş Yap</h2>
              <form onSubmit={handleLogin}>
                <div className="input-group">
                  <label className="input-label">Ortam</label>
                  <select 
                    className="input-field"
                    value={env}
                    onChange={(e) => setEnv(e.target.value)}
                  >
                    <option value="PROD">Canlı (PROD)</option>
                    <option value="TEST">Test (TEST)</option>
                  </select>
                </div>
                
                <div className="input-group">
                  <label className="input-label">Kullanıcı Adı (GİB)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                    placeholder="33333333"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Parola</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                    placeholder="••••••••"
                  />
                </div>

                {error && <div className="error-text" style={{ marginBottom: '1rem' }}>{error}</div>}

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <div className="spinner"></div> : 'Sisteme Bağlan'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="glass-panel" style={{ padding: '0.8rem 1.5rem', display: 'inline-block', width: 'auto', marginBottom: 0 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Bağlı Kullanıcı: </span>
                  <strong>{credentials.username}</strong>
                </div>
                <button onClick={handleLogout} className="btn-primary" style={{ width: 'auto', background: 'transparent', border: '1px solid var(--glass-border)' }}>Çıkış Yap</button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                <button 
                  onClick={() => setActiveTab('create')}
                  style={{ 
                    padding: '10px 20px', 
                    background: activeTab === 'create' ? 'var(--primary-color)' : 'transparent', 
                    border: 'none', 
                    color: 'white', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'create' ? 'bold' : 'normal'
                  }}
                >
                  Fatura Oluştur
                </button>
                <button 
                  onClick={() => setActiveTab('list')}
                  style={{ 
                    padding: '10px 20px', 
                    background: activeTab === 'list' ? 'var(--primary-color)' : 'transparent', 
                    border: 'none', 
                    color: 'white', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'list' ? 'bold' : 'normal'
                  }}
                >
                  Faturalarım
                </button>
              </div>
              
              {activeTab === 'create' ? (
                <div className="dashboard-grid">
                  <InvoiceForm credentials={credentials} />
                  
                  <div className="glass-panel" style={{ height: 'fit-content' }}>
                    <h3 className="section-title">Bilgi</h3>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      Sol taraftaki formu doldurarak e-Arşiv sisteminde yeni bir taslak fatura oluşturabilirsiniz. 
                      <br/><br/>
                      Oluşturulan fatura GİB portalınıza taslak olarak eklenecektir. İsterseniz otomatik olarak imzalama seçeneğini de kullanabilirsiniz (sadece canlı ortamda geçerlidir).
                    </p>
                  </div>
                </div>
              ) : (
                <InvoiceList />
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
