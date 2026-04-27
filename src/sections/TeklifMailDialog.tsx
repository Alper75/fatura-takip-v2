import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, Settings, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teklif: any;
}

export function TeklifMailDialog({ open, onOpenChange, teklif }: Props) {
  const [activeTab, setActiveTab] = useState('send');
  const [loading, setLoading] = useState(false);

  // Send state
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Settings state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [template, setTemplate] = useState('Sayın [müşteri],\n\nSize özel hazırladığımız teklifimizi aşağıdaki linkten inceleyebilirsiniz:\n\n[link]\n\nİyi çalışmalar dileriz.');

  useEffect(() => {
    if (open) {
      loadSettings();
      if (teklif) {
        setTo(teklif.musteri_eposta || '');
        setSubject(`Teklif Detayınız - ${teklif.teklif_no}`);
      }
    }
  }, [open, teklif]);

  const loadSettings = async () => {
    try {
      const res = await apiFetch('/api/settings/smtp');
      if (res.success && res.settings) {
        if (res.settings.smtp_host) setSmtpHost(res.settings.smtp_host);
        if (res.settings.smtp_port) setSmtpPort(res.settings.smtp_port);
        if (res.settings.smtp_user) setSmtpUser(res.settings.smtp_user);
        if (res.settings.smtp_pass) setSmtpPass(res.settings.smtp_pass);
        if (res.settings.smtp_secure) setSmtpSecure(res.settings.smtp_secure === 'true');
        if (res.settings.email_template) setTemplate(res.settings.email_template);
      }
    } catch (error) {
      console.error('SMTP ayarları yüklenemedi', error);
    }
  };

  useEffect(() => {
    if (teklif && template) {
      const origin = window.location.origin;
      const link = `${origin}/?teklif=${teklif.onay_token}`;
      const musteriAd = teklif.musteri_adi || 'Müşterimiz';
      
      let finalMessage = template.replace(/\[müşteri\]/g, musteriAd);
      finalMessage = finalMessage.replace(/\[link\]/g, link);
      setMessage(finalMessage);
    }
  }, [teklif, template]);

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/settings/smtp', {
        method: 'POST',
        body: JSON.stringify({
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
          smtp_secure: smtpSecure.toString(),
          email_template: template
        })
      });
      if (res.success) {
        toast.success('SMTP ve Şablon ayarları kaydedildi.');
        setActiveTab('send');
      } else {
        toast.error(res.message || 'Ayarlar kaydedilemedi.');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!to) return toast.error('Alıcı e-posta adresi gerekli.');
    
    setLoading(true);
    try {
      const res = await apiFetch(`/api/teklifler/${teklif.id}/send-email`, {
        method: 'POST',
        body: JSON.stringify({ to, subject, message })
      });
      if (res.success) {
        toast.success('Teklif başarıyla müşteriye e-postalandı!');
        onOpenChange(false);
      } else {
        toast.error(res.message || 'Gönderim başarısız.');
        if (res.message && res.message.includes('eksik')) {
           setActiveTab('settings');
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Teklif E-Posta Gönderimi
          </DialogTitle>
          <DialogDescription>
            {teklif?.teklif_no} numaralı teklifi doğrudan müşterinize ulaştırın.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send" className="gap-2"><Send className="w-4 h-4" /> Gönder</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> SMTP & Şablon Ayarları</TabsTrigger>
          </TabsList>

          {/* SEND TAB */}
          <TabsContent value="send" className="space-y-4 mt-6">
            <div className="grid gap-2">
              <Label>Alıcı E-posta</Label>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="musteri@firma.com" />
            </div>
            <div className="grid gap-2">
              <Label>Konu</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Mesaj (Şablondan Otomatik Oluşturuldu)</Label>
              <Textarea 
                value={message} 
                onChange={e => setMessage(e.target.value)} 
                className="min-h-[150px]"
              />
            </div>
            <DialogFooter className="mt-4">
              <Button disabled={loading} onClick={handleSend} className="w-full gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                E-postayı Gönder
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>SMTP Sunucusu (Host)</Label>
                <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div className="grid gap-2">
                <Label>Port</Label>
                <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="465 veya 587" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>SMTP Kullanıcı (E-Posta)</Label>
                <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="mail@firmaniz.com" />
              </div>
              <div className="grid gap-2">
                <Label>SMTP Şifre (App Password)</Label>
                <Input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="Şifreniz" />
              </div>
            </div>
            <div className="flex items-center space-x-2 my-2">
              <Checkbox id="secure" checked={smtpSecure} onCheckedChange={(val: boolean) => setSmtpSecure(val)} />
              <Label htmlFor="secure" className="text-sm font-normal">
                Güvenli Bağlantı Kullan (SSL/TLS - Port 465 i&ccedil;in önerilir)
              </Label>
            </div>
            <hr />
            <div className="grid gap-2">
              <Label>E-Posta Varsayılan Şablonu</Label>
              <p className="text-xs text-slate-500">
                Şablonda müşteri isminin gelmesini istediğiniz yere <b>[müşteri]</b>, onay linkinin gelmesini istediğiniz yere <b>[link]</b> yazın.
              </p>
              <Textarea 
                value={template} 
                onChange={e => setTemplate(e.target.value)} 
                className="min-h-[120px]"
              />
            </div>
            <DialogFooter className="mt-4">
              <Button disabled={loading} variant="secondary" onClick={handleSaveSettings} className="w-full gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                Ayarları ve Şablonu Kaydet
              </Button>
            </DialogFooter>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
