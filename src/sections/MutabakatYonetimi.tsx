import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileSignature, FileUp, Download, CheckCircle2, XCircle, 
  Clock, FileText, UploadCloud, Loader2, Sparkles, AlertTriangle,
  Trash2, Eye, Save, Mail, MessageSquare, Printer, Copy, Send, Calculator
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MutabakatYonetimi() {
  const { apiFetch, cariler, satisFaturalari, alisFaturalari, cariHareketler, companies, user } = useApp();
  const activeCompany = companies?.find(c => c.id === (user?.companyId || 1));
  const [mutabakatlar, setMutabakatlar] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('liste');
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'nvidia' | 'openai' | 'grok' | 'evren'>('openai');
  const [evrenKey, setEvrenKey] = useState('');
  const [evrenModel, setEvrenModel] = useState('dots-ocr');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-3.8-flash');
  const [isCustomGemini, setIsCustomGemini] = useState(false);
  const [nvidiaKey, setNvidiaKey] = useState('');
  const [nvidiaModel, setNvidiaModel] = useState('stepfun-ai/step-5-preview');
  const [isCustomNvidia, setIsCustomNvidia] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [isCustomOpenai, setIsCustomOpenai] = useState(false);
  const [xaiKey, setXaiKey] = useState('');
  const [xaiModel, setXaiModel] = useState('grok-2-vision-1212');
  const [isCustomXai, setIsCustomXai] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // SMTP / E-Posta Tanımlama State'leri
  const [smtpCompanyName, setSmtpCompanyName] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpSecure, setSmtpSecure] = useState('true');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [sendingMailId, setSendingMailId] = useState<string | null>(null);

  // Sistemden Otomatik BA/BS & Cari Bakiye Hesaplama State'leri
  const [sendSourceMode, setSendSourceMode] = useState<'sistem' | 'excel'>('sistem');
  const [selectedDonem, setSelectedDonem] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [systemCariContacts, setSystemCariContacts] = useState<Record<string, { eposta: string; telefon: string }>>({});
  const [selectedSystemCariIds, setSelectedSystemCariIds] = useState<string[]>([]);
  const [editingContactRow, setEditingContactRow] = useState<{ id: string; unvan: string; eposta: string; telefon: string } | null>(null);

  const PRESET_EVREN_MODELS = [
    { value: 'dots-ocr', label: 'dots-ocr (🇹🇷 Adanmış OCR - Fiş, Fatura, Termal Kağıt & Tablo Ayrıştırma - Önerilen)' },
    { value: 'deepseek-ocr-2', label: 'deepseek-ocr-2 (Adanmış OCR - Gelişmiş Belge & Metin Okuma)' },
    { value: 'qwen3-vl-30b', label: 'qwen3-vl-30b (🔥 30B Çok Modlu Görsel & Belge Anlama Modeli)' },
    { value: 'deepseek-v4-flash', label: 'deepseek-v4-flash (⚡ Çok Hızlı Akıl Yürütme & Veri Çıkarımı)' },
    { value: 'glm-5.3', label: 'glm-5.3 (Kapsamlı Mantık & Türkçe Muhasebe Analizi)' },
    { value: 'qwen3.8-flash-next', label: 'qwen3.8-flash-next (Yeni Nesil Hızlı Dil Modeli)' },
  ];

  const PRESET_XAI_MODELS = [
    { value: 'grok-2-vision-1212', label: 'Grok 2 Vision (🔥 Çok Hızlı, Görsel & Fiş Analizi - Önerilen)' },
    { value: 'grok-vision-beta', label: 'Grok Vision Beta (Gelişmiş Görsel Model)' },
    { value: 'grok-2-1212', label: 'Grok 2 (Metin & Tablo Odaklı)' },
    { value: 'grok-beta', label: 'Grok Beta' },
  ];

  const PRESET_OPENAI_MODELS = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (🔥 Çok Hızlı, Ekonomik & Yüksek Doğruluk - Önerilen)' },
    { value: 'gpt-4o', label: 'GPT-4o (Omni - Üst Düzey Zeka & Detaylı Analiz)' },
    { value: 'o3-mini', label: 'o3-mini (Akıl Yürütme Modeli)' },
  ];

  const PRESET_GEMINI_MODELS = [
    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Önerilen - En Güncel & Hızlı)' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Klasik & Kararlı)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Çok Detaylı & Zeki)' },
  ];

  const PRESET_NVIDIA_MODELS = [
    { value: 'stepfun-ai/step-5-preview', label: 'StepFun Step 5 Vision (🔥 En Hızlı & En Başarılı OCR - Önerilen)' },
    { value: 'meta/llama-3.2-11b-vision-instruct', label: 'Meta Llama 3.2 11B Vision (Alternatif Görsel Model)' },
    { value: 'meta/llama-3.2-90b-vision-instruct', label: 'Meta Llama 3.2 90B Vision (Büyük Model - Yavaş Yanıt)' },
  ];
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Progress state
  const [sendProgress, setSendProgress] = useState<{ total: number, current: number, logs: string[] } | null>(null);
  
  // Detail Dialog state
  const [viewDetail, setViewDetail] = useState<any>(null);

  // Detaylı / Basit mode
  const [importMode, setImportMode] = useState<'basit' | 'detayli'>('basit');
  
  const mizanFileRef = useRef<HTMLInputElement>(null);
  const muavinFileRef = useRef<HTMLInputElement>(null);
  const [mizanFile, setMizanFile] = useState<File | null>(null);
  const [muavinFile, setMuavinFile] = useState<File | null>(null);


  // Auth-aware download helper — direct link.click() doesn't send Bearer token
  const downloadMuavin = async (mutabakatId: string, fileName: string) => {
    setDownloadingId(mutabakatId);
    try {
      const token = localStorage.getItem('token') || '';
      const response = await fetch(`/api/mutabakatlar/${mutabakatId}/download-muavin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'İndirme başarısız.' }));
        toast.error(err.message || 'Dosya indirilemedi.');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'muavin.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error('İndirme hatası: ' + e.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchSettings = async () => {
    try {
      const [
        resProvider, resKey, resModel, resNvidiaKey, resNvidiaModel, resOpenaiKey, resOpenaiModel, resXaiKey, resXaiModel, resEvrenKey, resEvrenModel,
        resSmtpCompany, resSmtpHost, resSmtpPort, resSmtpSecure, resSmtpUser, resSmtpPass
      ] = await Promise.all([
        apiFetch('/api/settings/ai_provider').catch(() => null),
        apiFetch('/api/settings/gemini_api_key').catch(() => null),
        apiFetch('/api/settings/gemini_model').catch(() => null),
        apiFetch('/api/settings/nvidia_api_key').catch(() => null),
        apiFetch('/api/settings/nvidia_model').catch(() => null),
        apiFetch('/api/settings/openai_api_key').catch(() => null),
        apiFetch('/api/settings/openai_model').catch(() => null),
        apiFetch('/api/settings/xai_api_key').catch(() => null),
        apiFetch('/api/settings/xai_model').catch(() => null),
        apiFetch('/api/settings/evren_api_key').catch(() => null),
        apiFetch('/api/settings/evren_model').catch(() => null),
        apiFetch('/api/settings/company_name').catch(() => null),
        apiFetch('/api/settings/smtp_host').catch(() => null),
        apiFetch('/api/settings/smtp_port').catch(() => null),
        apiFetch('/api/settings/smtp_secure').catch(() => null),
        apiFetch('/api/settings/smtp_user').catch(() => null),
        apiFetch('/api/settings/smtp_pass').catch(() => null),
      ]);

      if (resProvider?.success && resProvider.value) setAiProvider(resProvider.value as any);
      if (resEvrenKey?.success) setEvrenKey(resEvrenKey.value || '');
      if (resEvrenModel?.success && resEvrenModel.value) setEvrenModel(resEvrenModel.value);
      if (resKey?.success) setGeminiKey(resKey.value || '');
      if (resModel?.success && resModel.value) {
        setGeminiModel(resModel.value);
        if (!PRESET_GEMINI_MODELS.some(m => m.value === resModel.value)) {
          setIsCustomGemini(true);
        }
      }
      if (resNvidiaKey?.success) setNvidiaKey(resNvidiaKey.value || '');
      if (resNvidiaModel?.success && resNvidiaModel.value) {
        setNvidiaModel(resNvidiaModel.value);
        if (!PRESET_NVIDIA_MODELS.some(m => m.value === resNvidiaModel.value)) {
          setIsCustomNvidia(true);
        }
      }
      if (resOpenaiKey?.success) setOpenaiKey(resOpenaiKey.value || '');
      if (resOpenaiModel?.success && resOpenaiModel.value) {
        setOpenaiModel(resOpenaiModel.value);
        if (!PRESET_OPENAI_MODELS.some(m => m.value === resOpenaiModel.value)) {
          setIsCustomOpenai(true);
        }
      }
      if (resXaiKey?.success) setXaiKey(resXaiKey.value || '');
      if (resXaiModel?.success && resXaiModel.value) {
        setXaiModel(resXaiModel.value);
        if (!PRESET_XAI_MODELS.some(m => m.value === resXaiModel.value)) {
          setIsCustomXai(true);
        }
      }
      if (resSmtpCompany?.success && resSmtpCompany.value) setSmtpCompanyName(resSmtpCompany.value);
      else if (activeCompany?.name) setSmtpCompanyName(activeCompany.name);
      if (resSmtpHost?.success) setSmtpHost(resSmtpHost.value || '');
      if (resSmtpPort?.success && resSmtpPort.value) setSmtpPort(resSmtpPort.value);
      if (resSmtpSecure?.success && resSmtpSecure.value) setSmtpSecure(resSmtpSecure.value);
      if (resSmtpUser?.success) {
        setSmtpUser(resSmtpUser.value || '');
        if (!testEmailTo && resSmtpUser.value) setTestEmailTo(resSmtpUser.value);
      }
      if (resSmtpPass?.success) setSmtpPass(resSmtpPass.value || '');
    } catch (e) {}
  };

  const handleSaveSmtpSettings = async () => {
    setIsSavingSmtp(true);
    try {
      await Promise.all([
        apiFetch('/api/settings/company_name', { method: 'POST', body: JSON.stringify({ value: smtpCompanyName }) }),
        apiFetch('/api/settings/smtp_host', { method: 'POST', body: JSON.stringify({ value: smtpHost.trim() }) }),
        apiFetch('/api/settings/smtp_port', { method: 'POST', body: JSON.stringify({ value: smtpPort.trim() }) }),
        apiFetch('/api/settings/smtp_secure', { method: 'POST', body: JSON.stringify({ value: smtpSecure }) }),
        apiFetch('/api/settings/smtp_user', { method: 'POST', body: JSON.stringify({ value: smtpUser.trim() }) }),
        apiFetch('/api/settings/smtp_pass', { method: 'POST', body: JSON.stringify({ value: smtpPass }) }),
      ]);
      toast.success('E-Posta (SMTP) ayarları başarıyla kaydedildi.');
    } catch (e: any) {
      toast.error('E-Posta ayarları kaydedilemedi: ' + e.message);
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    try {
      await handleSaveSmtpSettings();
      const res = await apiFetch('/api/mutabakatlar/test-smtp', {
        method: 'POST',
        body: JSON.stringify({
          company_name: smtpCompanyName,
          smtp_host: smtpHost.trim(),
          smtp_port: smtpPort.trim(),
          smtp_secure: smtpSecure,
          smtp_user: smtpUser.trim(),
          smtp_pass: smtpPass,
          test_to: testEmailTo.trim() || smtpUser.trim()
        })
      });
      if (res.success) {
        toast.success(res.message || 'Test maili başarıyla gönderildi!');
      } else {
        toast.error(res.message || 'SMTP testi başarısız.');
      }
    } catch (e: any) {
      toast.error('SMTP Test Hatası: ' + e.message);
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const getPublicMutabakatUrl = (token: string) => `${window.location.origin}/?mutabakat=${token}`;

  const handleSendSmtpMail = async (m: any, customEmail?: string) => {
    const email = (customEmail || m.cariEposta || '').trim();
    if (!email) {
      setEditingContactRow({ id: m.id, unvan: m.cariUnvan, eposta: m.cariEposta || '', telefon: m.cariTelefon || '' });
      toast.info('Lütfen önce müşterinin e-posta adresini tanımlayın.');
      return;
    }
    setSendingMailId(m.id);
    try {
      const res = await apiFetch(`/api/mutabakatlar/${m.id}/send-mail`, {
        method: 'POST',
        body: JSON.stringify({ toEmail: email })
      });
      if (res.success) {
        toast.success(`${m.cariUnvan} (${email}) adresine mutabakat e-postası gönderildi!`);
        fetchMutabakatlar();
      } else {
        toast.error(res.message || 'Mail gönderilemedi.');
      }
    } catch (e: any) {
      toast.error('Mail gönderim hatası: ' + e.message);
    } finally {
      setSendingMailId(null);
    }
  };

  const handleSendMailto = (m: any) => {
    const url = getPublicMutabakatUrl(m.token);
    const bakiyeFormatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(Number(m.bakiye) || 0));
    const yon = Number(m.bakiye) >= 0 ? 'BORÇLU (Alacağımız)' : 'ALACAKLI (Borcumuz)';
    const companyTitle = smtpCompanyName || activeCompany?.name || 'Şirketimiz';
    const subject = encodeURIComponent(`${companyTitle} - ${m.donem} Dönemi Cari & BA/BS Mutabakat Mektubu`);
    const body = encodeURIComponent(
      `Sayın ${m.cariUnvan},\n\n` +
      `Şirketimiz kayıtlarına göre ${m.donem} dönemi itibarıyla cari hesap mutabakat bilgilerimiz aşağıdadır:\n\n` +
      `• Dönem: ${m.donem}\n` +
      `• Toplam Borç: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(m.borc) || 0)}\n` +
      `• Toplam Alacak: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(m.alacak) || 0)}\n` +
      `• Net Bakiye: ${bakiyeFormatted} (${yon})\n` +
      (m.aciklama ? `• Detay / BA-BS: ${m.aciklama}\n` : '') +
      `\nMutabakatı tek tıkla ONAYLAMAK veya REDDETMEK için aşağıdaki bağlantıya tıklayabilirsiniz:\n${url}\n\n` +
      `İyi çalışmalar dileriz.\n${companyTitle}`
    );
    window.open(`mailto:${m.cariEposta || ''}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleSendWhatsApp = (m: any) => {
    const url = getPublicMutabakatUrl(m.token);
    const bakiyeFormatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(Number(m.bakiye) || 0));
    const yon = Number(m.bakiye) >= 0 ? 'BORÇLU' : 'ALACAKLI';
    const companyTitle = smtpCompanyName || activeCompany?.name || 'Şirketimiz';
    const text = encodeURIComponent(
      `📄 *CARİ & BA/BS MUTABAKAT BİLDİRİMİ*\n\n` +
      `Sayın *${m.cariUnvan}*,\n` +
      `*${companyTitle}* kayıtlarına göre *${m.donem}* dönemi cari mutabakat özetiniz:\n\n` +
      `🔹 *Borç:* ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(m.borc) || 0)}\n` +
      `🔸 *Alacak:* ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(m.alacak) || 0)}\n` +
      `💰 *Net Bakiye:* *${bakiyeFormatted} (${yon})*\n` +
      (m.aciklama ? `📌 *Detay:* ${m.aciklama}\n` : '') +
      `\n👇 Mutabakatı tek tıkla *Onaylamak* veya *Yanıtlamak* için tıklayın:\n${url}`
    );
    const rawPhone = String(m.cariTelefon || '').replace(/\D/g, '');
    const normalizedPhone = rawPhone.startsWith('0') ? '90' + rawPhone.slice(1) : (rawPhone.length === 10 ? '90' + rawPhone : rawPhone);
    const waUrl = normalizedPhone.length >= 10
      ? `https://wa.me/${normalizedPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyLink = (m: any) => {
    const url = getPublicMutabakatUrl(m.token);
    navigator.clipboard.writeText(url);
    toast.success('Canlı mutabakat onay linki panoya kopyalandı!');
  };

  const handlePrintPdfMektup = (m: any) => {
    const url = getPublicMutabakatUrl(m.token);
    const companyTitle = smtpCompanyName || activeCompany?.name || 'ŞİRKET UNVANI';
    const bakiyeFormatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(Number(m.bakiye) || 0));
    const yon = Number(m.bakiye) >= 0 ? 'BORÇLU (Alacağımız)' : 'ALACAKLI (Borcumuz)';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Cari & BA/BS Mutabakat Mektubu - ${m.cariUnvan}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1e293b; padding: 36px; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
            .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 13px; }
            th { background: #eef2ff; color: #312e81; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }
            .sig-box { border: 1px dashed #94a3b8; border-radius: 8px; padding: 20px; height: 110px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2 style="margin:0;color:#312e81;">CARİ HESAP & BA/BS MUTABAKAT MEKTUBU</h2>
              <p style="margin:4px 0 0 0;font-size:13px;color:#64748b;">Dönem: <b>${m.donem}</b> | Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:bold;font-size:15px;">${companyTitle}</div>
              <div style="font-size:12px;color:#64748b;">Durum: ${m.durum}</div>
            </div>
          </div>
          <div class="box">
            <p style="margin:0 0 6px 0;"><b>Sayın:</b> ${m.cariUnvan}</p>
            <p style="margin:0 0 6px 0;font-size:13px;"><b>VKN / TCKN:</b> ${m.cariVkn || '-'} | <b>Muhasebe Kodu:</b> ${m.cariMuhasebeKodu || '-'}</p>
            <p style="margin:0;font-size:13px;"><b>E-Posta:</b> ${m.cariEposta || '-'} | <b>Telefon:</b> ${m.cariTelefon || '-'}</p>
          </div>
          <p style="font-size:14px;line-height:1.6;">
            Şirketimiz nezdinizdeki cari hesabınızın <b>${m.donem}</b> dönemi itibarıyla bakiyesi ve BA/BS belge özetimiz aşağıda belirtilmiştir. Mutabık olup olmadığınızı kaşe/imza ile veya dijital onay linkimiz üzerinden bildirmenizi rica ederiz.
          </p>
          <table>
            <thead>
              <tr>
                <th>Dönem</th>
                <th>Toplam Borç</th>
                <th>Toplam Alacak</th>
                <th>Net Bakiye</th>
                <th>Bakiye Yönü</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>${m.donem}</b></td>
                <td>${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(m.borc) || 0)}</td>
                <td>${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(m.alacak) || 0)}</td>
                <td><b>${bakiyeFormatted}</b></td>
                <td><b>${yon}</b></td>
              </tr>
            </tbody>
          </table>
          ${m.aciklama ? `<div class="box" style="font-size:13px;"><b>Detay / BA-BS Fatura Özeti:</b><br/>${m.aciklama}</div>` : ''}
          <div style="font-size:12px;color:#475569;margin-top:16px;">
            <b>Dijital Onay Linki:</b> ${url}
          </div>
          <div class="signatures">
            <div class="sig-box">
              <b>${companyTitle}</b><br/><span style="font-size:12px;color:#64748b;">Kaşe / İmza</span>
            </div>
            <div class="sig-box">
              <b>${m.cariUnvan}</b><br/><span style="font-size:12px;color:#64748b;">Mutabıkız / Mutabık Değiliz (Kaşe / İmza)</span>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  const handleSaveCariContact = async () => {
    if (!editingContactRow) return;
    try {
      const res = await apiFetch(`/api/mutabakatlar/${editingContactRow.id}/update-contact`, {
        method: 'POST',
        body: JSON.stringify({
          eposta: editingContactRow.eposta.trim(),
          telefon: editingContactRow.telefon.trim()
        })
      });
      if (res.success) {
        toast.success('Cari iletişim bilgileri güncellendi.');
        setMutabakatlar(prev => prev.map(m => m.id === editingContactRow.id ? {
          ...m,
          cariEposta: editingContactRow.eposta.trim(),
          cariTelefon: editingContactRow.telefon.trim()
        } : m));
        setEditingContactRow(null);
      }
    } catch (e: any) {
      toast.error('Güncelleme hatası: ' + e.message);
    }
  };

  // Sistemdeki Cari, Fatura ve Banka Hareketlerinden Otomatik BA/BS & Bakiye Özeti
  const systemCalculatedRows = useMemo(() => {
    const normDonem = selectedDonem.replace('/', '-'); // e.g. 2026-11
    return (cariler || []).map(c => {
      const cVkn = String(c.vknTckn || '').trim();
      const cName = String(c.unvan || '').toLocaleLowerCase('tr-TR').trim();

      // Satış Faturaları (BS - Müşteri Borçlanır)
      const matchedSatis = (satisFaturalari || []).filter(sf => {
        if (sf.durum === 'iptal') return false;
        const fMatch = (sf.cariId && sf.cariId === c.id) || (cVkn && sf.tcVkn && String(sf.tcVkn).trim() === cVkn) ||
          (`${sf.ad || ''} ${sf.soyad || ''}`.toLocaleLowerCase('tr-TR').trim() === cName && cName.length > 3);
        if (!fMatch) return false;
        if (selectedDonem === 'TUMU') return true;
        return String(sf.faturaTarihi || '').startsWith(normDonem);
      });

      // Alış Faturaları (BA - Tedarikçi Alacaklanır)
      const matchedAlis = (alisFaturalari || []).filter(af => {
        if (af.durum === 'iptal') return false;
        const fMatch = (af.cariId && af.cariId === c.id) || (cVkn && af.tedarikciVkn && String(af.tedarikciVkn).trim() === cVkn) ||
          (String(af.tedarikciAdi || '').toLocaleLowerCase('tr-TR').trim() === cName && cName.length > 3);
        if (!fMatch) return false;
        if (selectedDonem === 'TUMU') return true;
        return String(af.faturaTarihi || '').startsWith(normDonem);
      });

      // Banka / Cari Hareketler
      const matchedHareket = (cariHareketler || []).filter(ch => {
        if (ch.cariId !== c.id) return false;
        if (selectedDonem === 'TUMU') return true;
        return String(ch.tarih || '').startsWith(normDonem);
      });

      const satisToplam = matchedSatis.reduce((s, f) => s + (Number(f.alinanUcret) || 0), 0);
      const satisMatrah = matchedSatis.reduce((s, f) => s + (Number(f.matrah) || ((Number(f.alinanUcret) || 0) - (Number(f.kdvTutari) || 0))), 0);
      const alisToplam = matchedAlis.reduce((s, f) => s + (Number(f.toplamTutar) || 0), 0);
      const alisMatrah = matchedAlis.reduce((s, f) => s + (Number(f.matrah) || 0), 0);

      let bankaBorc = 0; // Bizden çıkan ödeme
      let bankaAlacak = 0; // Bize gelen tahsilat
      for (const h of matchedHareket) {
        if (h.islemTuru === 'tahsilat') bankaAlacak += Number(h.tutar) || 0;
        else if (h.islemTuru === 'odeme') bankaBorc += Number(h.tutar) || 0;
      }

      const borc = Math.round((satisToplam + bankaBorc) * 100) / 100;
      const alacak = Math.round((alisToplam + bankaAlacak) * 100) / 100;
      const bakiye = Math.round((borc - alacak) * 100) / 100;

      const baBsParts: string[] = [];
      if (matchedSatis.length > 0) {
        baBsParts.push(`BS (Satış): ${matchedSatis.length} Adet Fatura - KDV Hariç ${satisMatrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`);
      }
      if (matchedAlis.length > 0) {
        baBsParts.push(`BA (Alış): ${matchedAlis.length} Adet Fatura - KDV Hariç ${alisMatrah.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`);
      }

      const override = systemCariContacts[c.id];
      return {
        cariId: c.id,
        unvan: c.unvan,
        vknTckn: c.vknTckn || '',
        muhasebeKodu: c.muhasebeKodu || '',
        eposta: override?.eposta !== undefined ? override.eposta : (c.eposta || ''),
        telefon: override?.telefon !== undefined ? override.telefon : (c.telefon || ''),
        satisAdet: matchedSatis.length,
        alisAdet: matchedAlis.length,
        borc,
        alacak,
        bakiye,
        aciklama: baBsParts.join(' | ') || `${selectedDonem} Dönemi Cari Hesap Mutabakatı`
      };
    }).filter(r => r.borc > 0 || r.alacak > 0 || Math.abs(r.bakiye) > 0);
  }, [cariler, satisFaturalari, alisFaturalari, cariHareketler, selectedDonem, systemCariContacts]);

  const handleCreateFromSystem = async (autoSendSmtp: boolean) => {
    const selectedRows = systemCalculatedRows.filter(r => selectedSystemCariIds.includes(r.cariId));
    if (selectedRows.length === 0) {
      toast.warning('Lütfen listeden en az 1 cari seçin.');
      return;
    }
    setIsLoading(true);
    try {
      const payload = selectedRows.map(r => ({
        cariId: r.cariId,
        muhasebeKodu: r.muhasebeKodu,
        vknTckn: r.vknTckn,
        eposta: r.eposta,
        telefon: r.telefon,
        donem: selectedDonem,
        borc: r.borc,
        alacak: r.alacak,
        bakiye: r.bakiye,
        aciklama: r.aciklama
      }));

      const res = await apiFetch('/api/mutabakatlar/bulk', {
        method: 'POST',
        body: JSON.stringify({
          mutabakatlar: payload,
          allowWithoutEmail: true
        })
      });

      if (res.success && res.created?.length > 0) {
        if (autoSendSmtp) {
          const withEmails = res.created.filter((c: any) => c.eposta);
          if (withEmails.length > 0) {
            setSendProgress({ total: withEmails.length, current: 0, logs: [] });
            for (let i = 0; i < withEmails.length; i++) {
              const item = withEmails[i];
              setSendProgress(prev => ({
                ...prev!,
                current: i + 1,
                logs: [`${item.unvan} (${item.eposta}) için mail gönderiliyor...`, ...(prev?.logs || [])]
              }));
              try {
                await apiFetch(`/api/mutabakatlar/${item.id}/send-mail`, {
                  method: 'POST',
                  body: JSON.stringify({ toEmail: item.eposta })
                });
              } catch {
                setSendProgress(prev => ({
                  ...prev!,
                  logs: [`HATA: ${item.unvan} maili gönderilemedi.`, ...(prev?.logs || [])]
                }));
              }
            }
            setTimeout(() => setSendProgress(null), 1500);
          }
        }
        toast.success(`${res.created.length} cari için mutabakat kaydı oluşturuldu! Listeden E-Posta, Mail Uygulaması, WhatsApp veya PDF ile gönderebilirsiniz.`);
        setSelectedSystemCariIds([]);
        setActiveTab('liste');
        fetchMutabakatlar();
      } else {
        toast.error(res.message || 'Mutabakat oluşturulamadı.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setIsSavingKey(true);
    try {
      await Promise.all([
        apiFetch('/api/settings/ai_provider', { method: 'POST', body: JSON.stringify({ value: aiProvider }) }),
        apiFetch('/api/settings/evren_api_key', { method: 'POST', body: JSON.stringify({ value: evrenKey }) }),
        apiFetch('/api/settings/evren_model', { method: 'POST', body: JSON.stringify({ value: evrenModel }) }),
        apiFetch('/api/settings/openai_api_key', { method: 'POST', body: JSON.stringify({ value: openaiKey }) }),
        apiFetch('/api/settings/openai_model', { method: 'POST', body: JSON.stringify({ value: openaiModel }) }),
        apiFetch('/api/settings/xai_api_key', { method: 'POST', body: JSON.stringify({ value: xaiKey }) }),
        apiFetch('/api/settings/xai_model', { method: 'POST', body: JSON.stringify({ value: xaiModel }) }),
        apiFetch('/api/settings/gemini_api_key', { method: 'POST', body: JSON.stringify({ value: geminiKey }) }),
        apiFetch('/api/settings/gemini_model', { method: 'POST', body: JSON.stringify({ value: geminiModel }) }),
        apiFetch('/api/settings/nvidia_api_key', { method: 'POST', body: JSON.stringify({ value: nvidiaKey }) }),
        apiFetch('/api/settings/nvidia_model', { method: 'POST', body: JSON.stringify({ value: nvidiaModel }) }),
      ]);
      toast.success('Yapay zeka ayarları başarıyla kaydedildi.');
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const fetchMutabakatlar = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/mutabakatlar');
      if (res.success) {
        setMutabakatlar(res.data);
      }
    } catch (e: any) {
      toast.error('Mutabakatlar çekilemedi: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'liste') {
      fetchMutabakatlar();
    }
    if (activeTab === 'ayarlar') {
      fetchSettings();
    }
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu mutabakat kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await apiFetch(`/api/mutabakatlar/${id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Mutabakat silindi.');
        setMutabakatlar(prev => prev.filter(m => m.id !== id));
        setSelectedIds(prev => prev.filter(sid => sid !== id));
      }
    } catch (e: any) {
      toast.error('Silme hatası: ' + e.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`${selectedIds.length} adet mutabakatı silmek istediğinize emin misiniz?`)) return;
    
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/mutabakatlar/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.success) {
        toast.success('Seçili mutabakatlar silindi.');
        setMutabakatlar(prev => prev.filter(m => !selectedIds.includes(m.id)));
        setSelectedIds([]);
      }
    } catch (e: any) {
      toast.error('Toplu silme hatası: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIAnalyze = async (id: string, existingResult?: string) => {
    if (existingResult) {
      try {
        setSelectedAnalysis(JSON.parse(existingResult));
        return;
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    setIsAnalyzing(id);
    try {
      const res = await apiFetch(`/api/mutabakatlar/analyze/${id}`, { method: 'POST' });
      if (res.success) {
        setSelectedAnalysis(res.analysis);
        fetchMutabakatlar();
        toast.success('Yapay zeka analizi tamamlandı.');
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error('Analiz sırasında hata: ' + e.message);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const processAndSendMutabakat = async () => {
    if (!mizanFile) {
      toast.error('Lütfen Mizan (Bakiye listesi) dosyasını yükleyin.');
      return;
    }

    if (importMode === 'detayli' && !muavinFile) {
      toast.error('Detaylı mod seçtiniz, lütfen kendi Muavin dosyanızı da ekleyin.');
      return;
    }

    setIsLoading(true);
    try {
      const mizanData = await mizanFile.arrayBuffer();
      const mizanWb = XLSX.read(mizanData);
      const mizanRows = XLSX.utils.sheet_to_json(mizanWb.Sheets[mizanWb.SheetNames[0]]);

      let muavinBase64 = null;
      if (muavinFile) {
        const reader = new FileReader();
        muavinBase64 = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(muavinFile);
        });
      }

      const payloadRows = mizanRows.map((row: any) => ({
        muhasebeKodu: String(row['Muhasebe Kodu'] || row['Hesap Kodu'] || ''),
        vknTckn: String(row['Vergi veya T.C. No'] || row['VKN'] || row['TCKN'] || ''),
        donem: String(row['Dönem'] || ''),
        borc: parseFloat(row['Borç']) || 0,
        alacak: parseFloat(row['Alacak']) || 0,
        bakiye: parseFloat(row['Bakiye']) || 0,
        aciklama: String(row['Açıklama'] || '')
      })).filter(r => r.muhasebeKodu || r.vknTckn);

      if (payloadRows.length === 0) {
        toast.error('Mizan dosyasında geçerli satır bulunamadı.');
        setIsLoading(false);
        return;
      }

      // Step 1: Create records
      const res = await apiFetch('/api/mutabakatlar/bulk', {
        method: 'POST',
        body: JSON.stringify({ 
          mutabakatlar: payloadRows,
          bizeAitMuavinBase64: muavinBase64
        })
      });

      if (res.success && res.created && res.created.length > 0) {
        const createdList = res.created;
        setSendProgress({ total: createdList.length, current: 0, logs: [] });
        
        // Step 2: Loop and send emails
        for (let i = 0; i < createdList.length; i++) {
          const item = createdList[i];
          setSendProgress(prev => ({
            ...prev!,
            current: i + 1,
            logs: [`${item.unvan} için mail gönderiliyor...`, ...(prev?.logs || [])]
          }));

          try {
            await apiFetch(`/api/mutabakatlar/${item.id}/send-mail`, { method: 'POST' });
          } catch (err: any) {
             setSendProgress(prev => ({
               ...prev!,
               logs: [`HATA: ${item.unvan} maili gönderilemedi.`, ...(prev?.logs || [])]
             }));
          }
        }
        
        toast.success(`${createdList.length} adet mutabakat oluşturuldu ve mailler gönderildi.`);
        setMizanFile(null);
        setMuavinFile(null);
        setTimeout(() => {
          setSendProgress(null);
          setActiveTab('liste');
        }, 2000);
      } else {
        toast.error(res.message || 'Gönderim sırasında hata oluştu.');
      }
    } catch (e: any) {
      toast.error('Hata: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDurumBadge = (durum: string) => {
    switch(durum) {
      case 'Mutabık': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1"/> Mutabık</Badge>;
      case 'Onaysız': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1"/> Mutabık Değil</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><Clock className="w-3 h-3 mr-1"/> Bekliyor</Badge>;
    }
  };

  const handleDownloadMizanTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Muhasebe Kodu': '120.01.001', 'Vergi veya T.C. No': '1234567890', 'Dönem': '2026/04', 'Müşteri/Tedarikçi Adı': 'Örnek Firma A.Ş.', 'Borç': 50000, 'Alacak': 10000, 'Bakiye': 40000, 'Açıklama': '1. Çeyrek Mutabakatı' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mutabakat Aktarım");
    XLSX.writeFile(wb, "mutabakat_mizan_sablonu.xlsx");
  };

  const handleDownloadMuavinTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Tarih': '2026-04-01', 'Evrak No': 'FTR12345', 'Açıklama': 'Satış Faturası', 'Borç': 10000, 'Alacak': 0, 'Bakiye': 10000 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Muavin");
    XLSX.writeFile(wb, "kendi_muavin_sablonu.xlsx");
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === mutabakatlar.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mutabakatlar.map(m => m.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-indigo-600" />
            Mutabakat Yönetimi
          </h2>
          <p className="text-sm text-slate-500 mt-1">Carilerinize e-mutabakat formları gönderin ve cevaplarını otomatik takip edin.</p>
        </div>
        {selectedIds.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-2">
            <Trash2 className="w-4 h-4" /> {selectedIds.length} Seçiliyi Sil
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
          <TabsTrigger value="liste" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Aktif Mutabakatlar</TabsTrigger>
          <TabsTrigger value="gonder" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">BA/BS & Bakiye Mutabakatı Oluştur</TabsTrigger>
          <TabsTrigger value="sablon" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Şablonlar</TabsTrigger>
          <TabsTrigger value="ayarlar" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">✉️ E-Posta (SMTP) & AI Ayarları</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Gönderilen Mutabakatlar</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  İstediğiniz cariye <b>Sistemden Otomatik Mail (SMTP)</b>, <b>Mail Programı (Outlook/Gmail)</b>, <b>WhatsApp</b> veya <b>PDF Mektup</b> ile gönderebilirsiniz.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveTab('ayarlar')} className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50">
                  <Mail className="w-3.5 h-3.5 mr-1.5" /> E-Posta Tanımla
                </Button>
                <Button variant="outline" size="sm" onClick={fetchMutabakatlar} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
                  Yenile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedIds.length > 0 && selectedIds.length === mutabakatlar.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Tarih & Dönem</TableHead>
                    <TableHead>Cari (Muhatap)</TableHead>
                    <TableHead>İletişim (Mail & Tel)</TableHead>
                    <TableHead className="text-right">Bakiye & BA/BS</TableHead>
                    <TableHead className="text-right">Durum</TableHead>
                    <TableHead className="text-right">Gönderim Kanalları & İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mutabakatlar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-500">Gönderilmiş bir mutabakat bulunmuyor.</TableCell>
                    </TableRow>
                  ) : mutabakatlar.map(m => (
                    <TableRow key={m.id} className={selectedIds.includes(m.id) ? 'bg-indigo-50/30' : ''}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.includes(m.id)}
                          onCheckedChange={() => toggleSelect(m.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{new Date(m.gonderim_tarihi).toLocaleDateString('tr-TR')}</div>
                        <div className="text-xs text-slate-500">Dönem: {m.donem}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{m.cariUnvan}</div>
                        <div className="text-xs text-slate-400">VKN: {m.cariVkn || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="text-xs">
                            <div className={m.cariEposta ? 'text-slate-700 font-medium' : 'text-amber-600 italic'}>
                              ✉️ {m.cariEposta || 'E-posta tanımlanmamış'}
                            </div>
                            <div className="text-slate-400 text-[11px]">
                              📞 {m.cariTelefon || 'Telefon yok'}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] text-indigo-600 hover:bg-indigo-50"
                            onClick={() => setEditingContactRow({
                              id: m.id,
                              unvan: m.cariUnvan,
                              eposta: m.cariEposta || '',
                              telefon: m.cariTelefon || ''
                            })}
                          >
                            Tanımla
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-slate-800">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(Number(m.bakiye) || 0))}
                          <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${Number(m.bakiye) >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {Number(m.bakiye) >= 0 ? 'B' : 'A'}
                          </span>
                        </div>
                        {m.aciklama && (
                          <div className="text-[10px] text-slate-500 max-w-[210px] ml-auto truncate" title={m.aciklama}>
                            {m.aciklama}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {getDurumBadge(m.durum)}
                        {m.yanit_tarihi && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(m.yanit_tarihi).toLocaleDateString('tr-TR')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sendingMailId === m.id}
                            onClick={() => handleSendSmtpMail(m)}
                            className="h-7 px-2 text-[11px] border-indigo-200 text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100"
                            title="Sistem üzerinden doğrudan e-posta (SMTP) gönder"
                          >
                            {sendingMailId === m.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                            Mail Gönder
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendMailto(m)}
                            className="h-7 px-2 text-[11px] border-sky-200 text-sky-700 bg-sky-50/70 hover:bg-sky-100"
                            title="Bilgisayardaki varsayılan Mail Programıyla (Outlook / Gmail) aç"
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Mail App
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendWhatsApp(m)}
                            className="h-7 px-2 text-[11px] border-emerald-200 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100"
                            title="WhatsApp üzerinden canlı onay linkli mutabakat mesajı gönder"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            WhatsApp
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-600 hover:text-indigo-700"
                            onClick={() => handlePrintPdfMektup(m)}
                            title="Resmi PDF Mutabakat Mektubu Yazdır / İndir"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-600 hover:text-indigo-700"
                            onClick={() => handleCopyLink(m)}
                            title="Canlı Onay Linkini Kopyala"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400 hover:text-indigo-600" 
                            onClick={() => setViewDetail(m)}
                            title="Detayları Gör"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {(m.karsi_muavin_data || m.karsi_muavin_path) && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                              disabled={downloadingId === m.id}
                              onClick={() => downloadMuavin(m.id, m.karsi_muavin_filename || 'muavin.xlsx')}
                              title="Muavin İndir"
                            >
                              {downloadingId === m.id 
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Download className="w-3.5 h-3.5" />}
                            </Button>
                          )}

                          {m.durum === 'Onaysız' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              disabled={isAnalyzing === m.id}
                              onClick={() => handleAIAnalyze(m.id, m.ai_analiz_sonucu)}
                              className="text-xs h-7 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                            >
                              {isAnalyzing === m.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3 mr-1"/>}
                              {m.ai_analiz_sonucu ? 'Analizi Gör' : 'AI Analiz'}
                            </Button>
                          )}

                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDelete(m.id)} title="Sil">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gonder" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-5xl mx-auto">
            <button
              type="button"
              onClick={() => setSendSourceMode('sistem')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                sendSourceMode === 'sistem'
                  ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-indigo-200'
              }`}
            >
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                ⚡ Sistemdeki Kayıtlardan Otomatik BA/BS & Bakiye Hesapla
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Excel yüklemeden, sistemdeki Satış/Alış faturalarınız ve Banka hareketlerinizden cari bakiyeleri ve BA/BS fatura adetlerini otomatik çıkarır.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSendSourceMode('excel')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                sendSourceMode === 'excel'
                  ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-indigo-200'
              }`}
            >
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <FileUp className="w-4 h-4 text-indigo-600" />
                📂 Dışarıdan Mizan / Muavin Excel Dosyası Yükle
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Luca veya başka bir muhasebe programından aldığınız Mizan (.xlsx) dosyasını yükleyerek toplu mutabakat oluşturun.
              </p>
            </button>
          </div>

          {sendSourceMode === 'sistem' ? (
            <Card className="border-0 shadow-sm max-w-5xl mx-auto">
              <CardHeader className="border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Otomatik BA/BS & Cari Bakiye Mutabakat Hazırlayıcı</CardTitle>
                  <CardDescription>
                    Müşteri/tedarikçi e-posta veya telefon bilgilerini tablodan doğrudan tanımlayabilir, istediğiniz kanaldan gönderebilirsiniz.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold whitespace-nowrap">Dönem:</Label>
                  <Input
                    value={selectedDonem}
                    onChange={(e) => setSelectedDonem(e.target.value)}
                    placeholder="2026/11 veya TUMU"
                    className="w-32 h-9 text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDonem('TUMU')}
                    className="h-9 text-xs"
                  >
                    Tüm Dönemler
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border">
                  <div className="text-xs text-slate-600">
                    Hareket gören <b>{systemCalculatedRows.length}</b> cari bulundu • Seçili: <b>{selectedSystemCariIds.length}</b>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        if (selectedSystemCariIds.length === systemCalculatedRows.length) {
                          setSelectedSystemCariIds([]);
                        } else {
                          setSelectedSystemCariIds(systemCalculatedRows.map(r => r.cariId));
                        }
                      }}
                    >
                      {selectedSystemCariIds.length === systemCalculatedRows.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={isLoading || selectedSystemCariIds.length === 0}
                      onClick={() => handleCreateFromSystem(false)}
                      variant="outline"
                      className="h-8 text-xs border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                    >
                      💬 Oluştur (WhatsApp / Mail App / PDF İçin)
                    </Button>
                    <Button
                      size="sm"
                      disabled={isLoading || selectedSystemCariIds.length === 0}
                      onClick={() => handleCreateFromSystem(true)}
                      className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      📧 Oluştur ve Otomatik Mail (SMTP) Gönder
                    </Button>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden max-h-[440px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-10">
                          <Checkbox
                            checked={systemCalculatedRows.length > 0 && selectedSystemCariIds.length === systemCalculatedRows.length}
                            onCheckedChange={() => {
                              if (selectedSystemCariIds.length === systemCalculatedRows.length) setSelectedSystemCariIds([]);
                              else setSelectedSystemCariIds(systemCalculatedRows.map(r => r.cariId));
                            }}
                          />
                        </TableHead>
                        <TableHead>Cari Unvan & VKN</TableHead>
                        <TableHead>Müşteri E-Posta (Tanımla)</TableHead>
                        <TableHead>WhatsApp Telefon</TableHead>
                        <TableHead className="text-center">BA / BS Adet</TableHead>
                        <TableHead className="text-right">Net Bakiye</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systemCalculatedRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-slate-400 text-xs">
                            Seçilen dönemde fatura veya banka hareketi olan cari bulunamadı. "Tüm Dönemler" butonuna tıklayabilirsiniz.
                          </TableCell>
                        </TableRow>
                      ) : systemCalculatedRows.map(r => (
                        <TableRow key={r.cariId}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSystemCariIds.includes(r.cariId)}
                              onCheckedChange={(checked) => {
                                setSelectedSystemCariIds(prev => checked ? [...prev, r.cariId] : prev.filter(id => id !== r.cariId));
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-xs text-slate-800">{r.unvan}</div>
                            <div className="text-[10px] text-slate-400">VKN: {r.vknTckn || '-'} | Kod: {r.muhasebeKodu || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.eposta}
                              onChange={(e) => setSystemCariContacts(prev => ({
                                ...prev,
                                [r.cariId]: { eposta: e.target.value, telefon: r.telefon }
                              }))}
                              placeholder="ornek@firma.com"
                              className="h-7 text-xs w-44"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={r.telefon}
                              onChange={(e) => setSystemCariContacts(prev => ({
                                ...prev,
                                [r.cariId]: { eposta: r.eposta, telefon: e.target.value }
                              }))}
                              placeholder="05XX XXX XX XX"
                              className="h-7 text-xs w-36"
                            />
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium mr-1">BS: {r.satisAdet}</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">BA: {r.alisAdet}</span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs">
                            {Math.abs(r.bakiye).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺{' '}
                            <span className={r.bakiye >= 0 ? 'text-blue-600' : 'text-amber-600'}>
                              ({r.bakiye >= 0 ? 'Borçlu' : 'Alacaklı'})
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm max-w-4xl mx-auto">
              <CardHeader className="border-b">
                <CardTitle>Excel Mizan ile Toplu Mutabakat Gönderimi</CardTitle>
                <CardDescription>
                  Mizan (toplam bakiye) dosyanızı yükleyerek tüm carilere tek tuşla mutabakat oluşturabilirsiniz.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                   <div onClick={() => setImportMode('basit')} className={`border rounded-xl p-4 cursor-pointer ${importMode === 'basit' ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}>
                     <div className="flex items-center gap-3 mb-2 font-semibold text-slate-900">
                       <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === 'basit' ? 'border-indigo-600' : 'border-slate-300'}`}>
                          {importMode === 'basit' && <div className="w-2 h-2 bg-indigo-600 rounded-full"/>}
                       </div>
                       Basit Gönderim
                     </div>
                     <p className="text-xs text-slate-500 ml-7">Sadece bakiye bildirimi yapılır.</p>
                   </div>
                   <div onClick={() => setImportMode('detayli')} className={`border rounded-xl p-4 cursor-pointer ${importMode === 'detayli' ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 hover:border-primary/50'}`}>
                     <div className="flex items-center gap-3 mb-2 font-semibold text-slate-900">
                       <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === 'detayli' ? 'border-primary' : 'border-slate-300'}`}>
                          {importMode === 'detayli' && <div className="w-2 h-2 bg-primary rounded-full"/>}
                       </div>
                       Detaylı (AI Destekli)
                     </div>
                     <p className="text-xs text-slate-500 ml-7">Muavin yükleyerek uyuşmazlık analizini aktifleştirin.</p>
                   </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t">
                   <div>
                     <Label className="text-sm font-medium mb-1.5 block">1. Mizan Dosyası (Zorunlu)</Label>
                     <Button type="button" variant="outline" onClick={() => mizanFileRef.current?.click()} className="w-full flex justify-between border-dashed border-2 px-4 h-11">
                       <span className="flex items-center"><UploadCloud className="w-4 h-4 mr-2"/> {mizanFile ? mizanFile.name : 'Mizan Seç (.xlsx)'}</span>
                       {mizanFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                     </Button>
                     <input type="file" ref={mizanFileRef} onChange={(e) => setMizanFile(e.target.files?.[0] || null)} accept=".xlsx,.xls" className="hidden" />
                   </div>
                   {importMode === 'detayli' && (
                     <div>
                       <Label className="text-sm font-medium mb-1.5 block text-primary">2. Kendi Muavin Dosyanız (Zorunlu)</Label>
                       <Button type="button" variant="outline" onClick={() => muavinFileRef.current?.click()} className="w-full flex justify-between border-primary/30 border-dashed border-2 px-4 h-11 bg-primary/5 text-primary">
                         <span className="flex items-center"><FileText className="w-4 h-4 mr-2"/> {muavinFile ? muavinFile.name : 'Muavin Seç (.xlsx)'}</span>
                         {muavinFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                       </Button>
                       <input type="file" ref={muavinFileRef} onChange={(e) => setMuavinFile(e.target.files?.[0] || null)} accept=".xlsx,.xls" className="hidden" />
                     </div>
                   )}
                 </div>

                 <Button onClick={processAndSendMutabakat} disabled={isLoading} className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md">
                   {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <FileUp className="w-4 h-4 mr-2" />}
                   Mutabakat Mail'lerini Başlat
                 </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sablon">
           <Card className="border-0 shadow-sm max-w-4xl mx-auto">
             <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-2xl p-6 text-center hover:bg-slate-50 cursor-pointer" onClick={handleDownloadMizanTemplate}>
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileUp className="w-8 h-8" /></div>
                  <h3 className="font-bold mb-2">Mizan Şablonu</h3>
                  <Button variant="outline" size="sm" className="w-full mt-2">İndir</Button>
                </div>
                <div className="border rounded-2xl p-6 text-center hover:bg-slate-50 cursor-pointer" onClick={handleDownloadMuavinTemplate}>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8" /></div>
                  <h3 className="font-bold mb-2">Muavin Şablonu</h3>
                  <Button variant="outline" size="sm" className="w-full mt-2">İndir</Button>
                </div>
             </CardContent>
           </Card>
        </TabsContent>
        
        <TabsContent value="ayarlar" className="space-y-6">
           {/* E-POSTA (SMTP) TANIMLAMA KARTI */}
           <Card className="border-0 shadow-sm max-w-2xl mx-auto">
             <CardHeader className="border-b bg-indigo-50/40">
               <CardTitle className="flex items-center gap-2 text-indigo-900">
                 <Mail className="w-5 h-5 text-indigo-600" />
                 Kurumsal E-Posta (SMTP) Gönderim Ayarları
               </CardTitle>
               <CardDescription>
                 Mutabakat mektuplarını doğrudan kendi e-posta adresinizden göndermek için SMTP bilgilerinizi tanımlayın. (Tanımlamadan da Mail Uygulaması veya WhatsApp seçeneklerini kullanabilirsiniz.)
               </CardDescription>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
               <div className="flex flex-wrap gap-2">
                 <span className="text-xs font-semibold text-slate-500 self-center mr-1">Hızlı Şablon:</span>
                 <Button
                   type="button"
                   size="sm"
                   variant="outline"
                   className="h-7 text-xs"
                   onClick={() => { setSmtpHost('smtp.gmail.com'); setSmtpPort('465'); setSmtpSecure('true'); }}
                 >
                   Gmail (smtp.gmail.com)
                 </Button>
                 <Button
                   type="button"
                   size="sm"
                   variant="outline"
                   className="h-7 text-xs"
                   onClick={() => { setSmtpHost('smtp.office365.com'); setSmtpPort('587'); setSmtpSecure('false'); }}
                 >
                   Outlook / Office 365
                 </Button>
                 <Button
                   type="button"
                   size="sm"
                   variant="outline"
                   className="h-7 text-xs"
                   onClick={() => { setSmtpHost('smtp.yandex.com.tr'); setSmtpPort('465'); setSmtpSecure('true'); }}
                 >
                   Yandex Kurumsal
                 </Button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-1.5 sm:col-span-2">
                   <Label className="text-xs font-semibold">Gönderici Şirket Unvanı (Mail Başlığı)</Label>
                   <Input
                     value={smtpCompanyName}
                     onChange={(e) => setSmtpCompanyName(e.target.value)}
                     placeholder="Örn: ABC Muhasebe ve Danışmanlık Ltd. Şti."
                     className="text-xs"
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs font-semibold">SMTP Sunucusu (Host)</Label>
                   <Input
                     value={smtpHost}
                     onChange={(e) => setSmtpHost(e.target.value)}
                     placeholder="smtp.gmail.com veya mail.sirketiniz.com"
                     className="text-xs font-mono"
                   />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <div className="space-y-1.5">
                     <Label className="text-xs font-semibold">Port</Label>
                     <Input
                       value={smtpPort}
                       onChange={(e) => setSmtpPort(e.target.value)}
                       placeholder="465 veya 587"
                       className="text-xs font-mono"
                     />
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-xs font-semibold">Güvenlik (SSL)</Label>
                     <Select value={smtpSecure} onValueChange={setSmtpSecure}>
                       <SelectTrigger className="text-xs">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="true">SSL (Port 465)</SelectItem>
                         <SelectItem value="false">TLS / STARTTLS (587)</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs font-semibold">E-Posta Adresi (Kullanıcı Adı)</Label>
                   <Input
                     value={smtpUser}
                     onChange={(e) => setSmtpUser(e.target.value)}
                     placeholder="muhasebe@sirketiniz.com"
                     className="text-xs"
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs font-semibold">E-Posta Şifresi / Uygulama Şifresi</Label>
                   <Input
                     type="password"
                     value={smtpPass}
                     onChange={(e) => setSmtpPass(e.target.value)}
                     placeholder="••••••••••••"
                     className="text-xs font-mono"
                   />
                 </div>
               </div>

               <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                 <div className="flex items-center gap-2 w-full sm:w-auto">
                   <Input
                     value={testEmailTo}
                     onChange={(e) => setTestEmailTo(e.target.value)}
                     placeholder="Test alıcı e-posta..."
                     className="h-9 text-xs w-48"
                   />
                   <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     disabled={isTestingSmtp}
                     onClick={handleTestSmtp}
                     className="h-9 text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 whitespace-nowrap"
                   >
                     {isTestingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                     Test Maili Gönder
                   </Button>
                 </div>
                 <Button
                   type="button"
                   onClick={handleSaveSmtpSettings}
                   disabled={isSavingSmtp}
                   className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs w-full sm:w-auto"
                 >
                   {isSavingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                   E-Posta Ayarlarını Kaydet
                 </Button>
               </div>
             </CardContent>
           </Card>

           <Card className="border-0 shadow-sm max-w-2xl mx-auto">
             <CardHeader className="border-b">
               <CardTitle className="flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-indigo-600" />
                 Yapay Zeka (AI) Sağlayıcı Ayarları
               </CardTitle>
               <CardDescription>
                 Fiş/fatura tarama, muavin karşılaştırma ve analizler için yapay zeka servisinizi seçin.
               </CardDescription>
             </CardHeader>
             <CardContent className="p-6 space-y-6">
                
                {/* Sağlayıcı Seçimi */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-900">Aktif Yapay Zeka Motoru</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <button
                      type="button"
                      onClick={() => setAiProvider('evren')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-2 ${
                        aiProvider === 'evren' 
                          ? 'border-red-600 bg-red-50/60 shadow-sm ring-2 ring-red-600/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          🇹🇷 EVREN OCR
                          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded">Milli LLM</span>
                        </span>
                        {aiProvider === 'evren' && <span className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">dots-ocr & deepseek-ocr-2. SAYZEK / Savunma Sanayii Başkanlığı adanmış OCR ucu.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiProvider('openai')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-2 ${
                        aiProvider === 'openai' 
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-600/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          OpenAI (ChatGPT)
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">Önerilen</span>
                        </span>
                        {aiProvider === 'openai' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">GPT-4o Mini & GPT-4o. Çok hızlı, yüksek doğruluk ve kesintisiz çalışır.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiProvider('grok')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-2 ${
                        aiProvider === 'grok' 
                          ? 'border-violet-600 bg-violet-50/60 shadow-sm ring-2 ring-violet-600/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          xAI (Grok)
                          <span className="bg-violet-100 text-violet-800 text-[10px] font-bold px-1.5 py-0.5 rounded">Yeni</span>
                        </span>
                        {aiProvider === 'grok' && <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">Grok 2 Vision (xAI). Çok hızlı, güçlü görsel OCR ve harika algılama.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiProvider('gemini')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-2 ${
                        aiProvider === 'gemini' 
                          ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-600/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-sm text-slate-900">Google Gemini</span>
                        {aiProvider === 'gemini' && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">Gemini 3.8 & 1.5 Flash modelleri. Ücretsiz katmanda 20 fiş/dakika sınırı vardır.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiProvider('nvidia')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-2 ${
                        aiProvider === 'nvidia' 
                          ? 'border-teal-600 bg-teal-50/60 shadow-sm ring-2 ring-teal-600/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          NVIDIA Build
                          <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.5 rounded">1.000 Kredi</span>
                        </span>
                        {aiProvider === 'nvidia' && <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">StepFun & Llama 3.2 Vision modelleri.</p>
                    </button>
                  </div>
                </div>

                {/* EVREN (MİLLİ OCR) AYARLARI */}
                {aiProvider === 'evren' && (
                  <div className="space-y-4 pt-3 border-t border-slate-100 animate-in fade-in">
                    <div className="p-3 bg-red-50/60 border border-red-200 rounded-xl flex items-start gap-3">
                      <span className="text-xl">🇹🇷</span>
                      <div className="text-xs text-red-900 leading-relaxed">
                        <strong>T.C. Savunma Sanayii Başkanlığı / SAYZEK EVREN Platformu:</strong> Tüm veriler Türkiye sınırları içerisindeki milli GPU sunucularında adanmış <code className="bg-white px-1.5 py-0.5 rounded text-red-800 font-mono text-[11px]">https://evren-llmapi.ssyz.org.tr/v1/ocr</code> ucu üzerinden taranır. KVKK ve ticari sır mevzuatına tam uyumludur.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">EVREN API Anahtarı (Bearer Token)</Label>
                      <Input 
                        type="password" 
                        placeholder="EVREN platformundan aldığınız API Key..." 
                        value={evrenKey}
                        onChange={(e) => setEvrenKey(e.target.value.trim())}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-500">
                        API anahtarınızı <a href="https://evren.ssyz.org.tr/" target="_blank" rel="noreferrer" className="text-red-700 hover:underline font-semibold">evren.ssyz.org.tr</a> platformundan alabilirsiniz.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">EVREN OCR Modeli</Label>
                      <Select 
                        value={evrenModel} 
                        onValueChange={setEvrenModel}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="Model seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_EVREN_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* OPENAI (CHATGPT) AYARLARI */}
                {aiProvider === 'openai' && (
                  <div className="space-y-4 pt-3 border-t border-slate-100 animate-in fade-in">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">OpenAI API Key (sk-proj-...)</Label>
                      <Input 
                        type="password" 
                        placeholder="sk-proj-..." 
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value.trim())}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-500">
                        API anahtarınızı <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">platform.openai.com/api-keys</a> sayfasından alabilirsiniz. (5$ bakiye ile binlerce fiş/ekstre okunabilir).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">OpenAI Modeli</Label>
                      <Select 
                        value={isCustomOpenai ? 'custom' : openaiModel} 
                        onValueChange={(val) => {
                          if (val === 'custom') {
                            setIsCustomOpenai(true);
                          } else {
                            setIsCustomOpenai(false);
                            setOpenaiModel(val);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="Model seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_OPENAI_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                          <SelectItem value="custom" className="font-semibold text-emerald-600">✍️ Özel Model Adı Yaz...</SelectItem>
                        </SelectContent>
                      </Select>

                      {isCustomOpenai && (
                        <div className="space-y-1.5 pt-1.5 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in fade-in">
                          <Label className="text-[11px] font-semibold text-emerald-900">Özel OpenAI Model Kodu</Label>
                          <Input 
                            type="text" 
                            placeholder="Örn: gpt-4o-mini veya gpt-4o" 
                            value={openaiModel}
                            onChange={(e) => setOpenaiModel(e.target.value.trim())}
                            className="font-mono text-xs bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* XAI GROK AYARLARI */}
                {aiProvider === 'grok' && (
                  <div className="space-y-4 pt-3 border-t border-slate-100 animate-in fade-in">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">xAI Grok API Key (xai-...)</Label>
                      <Input 
                        type="password" 
                        placeholder="xai-..." 
                        value={xaiKey}
                        onChange={(e) => setXaiKey(e.target.value.trim())}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-500">
                        Grok API anahtarınızı <a href="https://console.x.ai/" target="_blank" rel="noreferrer" className="text-violet-600 hover:underline font-medium">console.x.ai</a> sayfasından alabilirsiniz.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">xAI Grok Modeli</Label>
                      <Select 
                        value={isCustomXai ? 'custom' : xaiModel} 
                        onValueChange={(val) => {
                          if (val === 'custom') {
                            setIsCustomXai(true);
                          } else {
                            setIsCustomXai(false);
                            setXaiModel(val);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="Model seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_XAI_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                          <SelectItem value="custom" className="font-semibold text-violet-600">✍️ Özel Model Adı Yaz...</SelectItem>
                        </SelectContent>
                      </Select>

                      {isCustomXai && (
                        <div className="space-y-1.5 pt-1.5 p-3 bg-violet-50/50 rounded-xl border border-violet-100 animate-in fade-in">
                          <Label className="text-[11px] font-semibold text-violet-900">Özel Grok Model Kodu</Label>
                          <Input 
                            type="text" 
                            placeholder="Örn: grok-2-vision-1212 veya grok-vision-beta" 
                            value={xaiModel}
                            onChange={(e) => setXaiModel(e.target.value.trim())}
                            className="font-mono text-xs bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* GOOGLE GEMINI AYARLARI */}
                {aiProvider === 'gemini' && (
                  <div className="space-y-4 pt-3 border-t border-slate-100 animate-in fade-in">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Gemini API Key</Label>
                      <Input 
                        type="password" 
                        placeholder="AIzaSy..." 
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-500">
                        Anahtarınızı <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 hover:underline font-medium">Google AI Studio</a> üzerinden alabilirsiniz.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Gemini Modeli</Label>
                      <Select 
                        value={isCustomGemini ? 'custom' : geminiModel} 
                        onValueChange={(val) => {
                          if (val === 'custom') {
                            setIsCustomGemini(true);
                          } else {
                            setIsCustomGemini(false);
                            setGeminiModel(val);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="Model seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_GEMINI_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                          <SelectItem value="custom" className="font-semibold text-indigo-600">✍️ Özel Model Adı Yaz...</SelectItem>
                        </SelectContent>
                      </Select>

                      {isCustomGemini && (
                        <div className="space-y-1.5 pt-1.5 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in">
                          <Label className="text-[11px] font-semibold text-indigo-900">Özel Gemini Model Kodu / Adı</Label>
                          <Input 
                            type="text" 
                            placeholder="Örn: gemini-3.8-flash veya gemini-1.5-flash-latest" 
                            value={geminiModel}
                            onChange={(e) => setGeminiModel(e.target.value.trim())}
                            className="font-mono text-xs bg-white"
                          />
                          <p className="text-[10px] text-slate-500">
                            Google AI Studio'da erişiminiz olan herhangi bir modelin adını yazabilirsiniz.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* NVIDIA BUILD AYARLARI */}
                {aiProvider === 'nvidia' && (
                  <div className="space-y-4 pt-3 border-t border-slate-100 animate-in fade-in">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">NVIDIA API Key</Label>
                      <Input 
                        type="password" 
                        placeholder="nvapi-..." 
                        value={nvidiaKey}
                        onChange={(e) => setNvidiaKey(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-500">
                        API anahtarınızı <a href="https://build.nvidia.com/" target="_blank" className="text-emerald-600 hover:underline font-medium">build.nvidia.com</a> adresinden ücretsiz 1.000 kredi ile alabilirsiniz.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">NVIDIA Vision Modeli</Label>
                      <Select 
                        value={isCustomNvidia ? 'custom' : nvidiaModel} 
                        onValueChange={(val) => {
                          if (val === 'custom') {
                            setIsCustomNvidia(true);
                          } else {
                            setIsCustomNvidia(false);
                            setNvidiaModel(val);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="NVIDIA Modeli seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_NVIDIA_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                          <SelectItem value="custom" className="font-semibold text-emerald-600">✍️ Özel Model Adı Yaz (build.nvidia.com)...</SelectItem>
                        </SelectContent>
                      </Select>

                      {isCustomNvidia && (
                        <div className="space-y-1.5 pt-1.5 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in fade-in">
                          <Label className="text-[11px] font-semibold text-emerald-900">Özel NVIDIA NIM Model Kodu (Adres / Path)</Label>
                          <Input 
                            type="text" 
                            placeholder="Örn: stepfun-ai/step-5-preview veya meta/llama-3.2-11b-vision-instruct" 
                            value={nvidiaModel}
                            onChange={(e) => setNvidiaModel(e.target.value.trim())}
                            className="font-mono text-xs bg-white"
                          />
                          <p className="text-[10px] text-slate-500">
                            <a href="https://build.nvidia.com/explore/discover" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-medium">build.nvidia.com/explore/discover</a> sayfasındaki resim destekli (vision) sohbet modellerini yazabilirsiniz. (Not: <code>nvidia/nemotron-parse</code> gibi chat desteklemeyen salt parse modelleri veya kapanan kimi-k3/phi-3 modelleri çalışmaz).
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={handleSaveAiSettings} 
                    disabled={isSavingKey}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  >
                    {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2" />}
                    Ayarları Kaydet
                  </Button>
                </div>

                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-bold">Önemli Hatırlatma:</p>
                    <p>Yapay zeka analizi, müşterileriniz reddettiğinde ve kendi muavin dosyalarını yüklediklerinde aktif olur. Basit mutabakatlarda AI kullanılmaz.</p>
                  </div>
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Progress Modal */}
      <Dialog open={!!sendProgress} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md text-center py-10">
          <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-6">
             <div className="relative w-12 h-12">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                   %{sendProgress ? Math.round((sendProgress.current / sendProgress.total) * 100) : 0}
                </div>
             </div>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 mb-2">Mutabakatlar Gönderiliyor</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
             Lütfen pencereyi kapatmayın. ({sendProgress?.current} / {sendProgress?.total})
          </DialogDescription>
          
          <div className="mt-6 bg-slate-50 rounded-xl p-4 h-32 overflow-y-auto text-left space-y-2 border border-slate-100">
             {sendProgress?.logs.map((log, idx) => (
               <div key={idx} className={`text-xs ${log.startsWith('HATA') ? 'text-red-500' : 'text-slate-600'} animate-in fade-in slide-in-from-left-2`}>
                  {log}
               </div>
             ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!viewDetail} onOpenChange={(open) => !open && setViewDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mutabakat Detayları</DialogTitle>
            <DialogDescription>{viewDetail?.cariUnvan} - {viewDetail?.donem}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border">
                   <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Durum</p>
                   {viewDetail && getDurumBadge(viewDetail.durum)}
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border">
                   <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Bakiye</p>
                   <p className="font-bold text-slate-900">
                      {viewDetail && new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(viewDetail.bakiye)}
                   </p>
                </div>
             </div>

             <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Müşteri Açıklaması</p>
                <div className="p-4 bg-white border rounded-xl min-h-[80px] text-sm text-slate-600">
                   {viewDetail?.aciklama || "Müşteri tarafından henüz bir açıklama eklenmedi."}
                </div>
             </div>

             {(viewDetail?.karsi_muavin_data || viewDetail?.karsi_muavin_path) && (
               <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                     <div>
                        <p className="text-sm font-bold text-emerald-900">Müşteri Muavin Dosyası</p>
                        <p className="text-[10px] text-emerald-600">{viewDetail?.karsi_muavin_filename || 'muavin.xlsx'}</p>
                     </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={downloadingId === viewDetail?.id}
                    className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100" 
                    onClick={() => downloadMuavin(viewDetail.id, viewDetail.karsi_muavin_filename || 'muavin.xlsx')}
                  >
                     {downloadingId === viewDetail?.id 
                       ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       : <Download className="w-4 h-4 mr-2" />}
                     İndir
                   </Button>
               </div>
             )}
          </div>
          
          <DialogFooter>
             <Button variant="outline" onClick={() => setViewDetail(null)} className="w-full">Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog open={!!selectedAnalysis} onOpenChange={(open) => !open && setSelectedAnalysis(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
              Yapay Zeka Mutabakat Analizi
            </DialogTitle>
            <DialogDescription>
              İki firma arasındaki muavin kayıtları karşılaştırılmış ve aşağıdaki uyumsuzluklar tespit edilmiştir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {selectedAnalysis?.uyusmazliklar?.length > 0 ? (
              <div className="rounded-xl border border-red-100 bg-red-50/30 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-red-700">Tarih</TableHead>
                      <TableHead className="text-red-700">Açıklama</TableHead>
                      <TableHead className="text-red-700 text-right">Tutar</TableHead>
                      <TableHead className="text-red-700">Uyumsuzluk Nedeni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAnalysis.uyusmazliklar.map((u: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-medium">{u.tarih}</TableCell>
                        <TableCell className="text-xs">{u.aciklama}</TableCell>
                        <TableCell className="text-xs text-right font-bold">{u.tutar}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="bg-white text-red-600 border-red-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {u.sebep}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                 <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                 <h4 className="font-bold text-slate-800">Kayıtlar Eşleşiyor!</h4>
                 <p className="text-sm text-slate-500">Yapay zeka satırlar arasında kritik bir fark bulamadı.</p>
              </div>
            )}

            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
               <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">AI Özeti / Tavsiye</h4>
               <p className="text-sm text-indigo-900 leading-relaxed italic">
                 "{selectedAnalysis?.ozet || 'Analiz özeti hazırlanamadı.'}"
               </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setSelectedAnalysis(null)} className="w-full bg-slate-900">Anladım, Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cari İletişim (E-Posta & Telefon) Tanımlama Modalı */}
      <Dialog open={!!editingContactRow} onOpenChange={(open) => !open && setEditingContactRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              Müşteri / Tedarikçi İletişim Bilgisi Tanımla
            </DialogTitle>
            <DialogDescription>
              <b>{editingContactRow?.unvan}</b> için e-posta veya WhatsApp telefon numarasını kaydedin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">E-Posta Adresi (Mail Gönderimi İçin)</Label>
              <Input
                type="email"
                value={editingContactRow?.eposta || ''}
                onChange={(e) => setEditingContactRow(prev => prev ? { ...prev, eposta: e.target.value } : null)}
                placeholder="muhasebe@musterifirma.com"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Telefon Numarası (WhatsApp Gönderimi İçin)</Label>
              <Input
                value={editingContactRow?.telefon || ''}
                onChange={(e) => setEditingContactRow(prev => prev ? { ...prev, telefon: e.target.value } : null)}
                placeholder="0532 XXX XX XX"
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingContactRow(null)}>Vazgeç</Button>
            <Button onClick={handleSaveCariContact} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Save className="w-4 h-4 mr-1.5" /> Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileSpreadsheet({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h2" /><path d="M8 17h2" /><path d="M14 13h2" /><path d="M14 17h2" />
    </svg>
  );
}
