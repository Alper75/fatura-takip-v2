import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Building2, 
  Plus, 
  Search, 
  Mail, 
  MapPin, 
  FileText,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export function SuperAdminPanel() {
  const { companies, addCompany, updateCompany, deleteCompany } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    tax_no: '',
    address: '',
    email: '',
    company_type: 'BİLANÇO',
    admin_tc: '',
    admin_password: '',
    status: 'active' as 'active' | 'passive'
  });

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tax_no?.includes(searchTerm)
  );

  const handleOpenModal = (company?: any) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        tax_no: company.tax_no || '',
        address: company.address || '',
        email: company.email || '',
        company_type: company.company_type || 'BİLANÇO',
        admin_tc: '',
        admin_password: '',
        status: company.status || 'active'
      });
    } else {
      setEditingCompany(null);
      setFormData({ name: '', tax_no: '', address: '', email: '', company_type: 'BİLANÇO', admin_tc: '', admin_password: '', status: 'active' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Şirket ismi gerekli.');

    try {
      if (editingCompany) {
        const res = await updateCompany(editingCompany.id, formData);
        if (res.success) toast.success('Şirket güncellendi.');
      } else {
        const res = await addCompany(formData);
        if (res.success) toast.success('Şirket oluşturuldu.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu.');
    }
  };

  const handleDelete = async (id: number) => {
    if (id === 1) return toast.error('Varsayılan şirket silinemez.');
    if (!confirm('Bu şirketi silmek istediğinize emin misiniz?')) return;

    try {
      const res = await deleteCompany(id);
      if (res.success) toast.success('Şirket silindi.');
    } catch (err: any) {
      toast.error(err.message || 'Silme işlemi başarısız.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Süper Admin Paneli
          </h2>
          <p className="text-slate-500 mt-1">Platformdaki tüm şirketleri ve abonelikleri yönetin.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2 shadow-md">
          <Plus className="w-4 h-4" />
          Yeni Şirket Ekle
        </Button>
      </div>

      {/* Stats Cards (Mockup for high-end look) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Toplam Şirket</CardTitle>
            <div className="flex items-center justify-between mt-1">
              <span className="text-3xl font-bold text-slate-900">{companies.length}</span>
              <Building2 className="w-8 h-8 text-primary/40" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Aktif Şirketler</CardTitle>
            <div className="flex items-center justify-between mt-1">
              <span className="text-3xl font-bold text-green-700">{companies.length}</span>
              <CheckCircle2 className="w-8 h-8 text-green-500/40" />
            </div>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Yeni Kayıt (Ay)</CardTitle>
            <div className="flex items-center justify-between mt-1">
              <span className="text-3xl font-bold text-blue-700">1</span>
              <CheckCircle2 className="w-8 h-8 text-blue-500/40" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Filters and List */}
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b border-slate-50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg">Şirket Listesi</CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Şirket adı veya VKN ile ara..." 
                className="pl-10 bg-slate-50 border-slate-100 focus:bg-white transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Şirket Bilgisi</th>
                  <th className="px-6 py-4">İletişim</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                          {company.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 flex items-center gap-2">
                            {company.name}
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md uppercase">
                              {company.company_type || 'BİLANÇO'}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {company.tax_no || 'VKN Belirtilmemiş'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="space-y-1">
                        <p className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {company.email || '-'}
                        </p>
                        <p className="flex items-center gap-2 truncate max-w-[200px]">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {company.address || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {company.status === 'passive' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                          <XCircle className="w-3 h-3" />
                          Pasif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
                          Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(company)} title="Düzenle">
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)} className="hover:text-red-600" title="Sil">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Şirkete Git">
                          <ExternalLink className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal - Şirket Ekle/Düzenle */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">
                {editingCompany ? 'Şirketi Düzenle' : 'Yeni Şirket Tanımla'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <XCircle className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Şirket Adı</label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Örn: ABC Yazılım Ltd. Şti." 
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Şirket Türü</label>
                  <select 
                    className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.company_type}
                    onChange={(e) => setFormData({...formData, company_type: e.target.value})}
                  >
                    <option value="BİLANÇO">BİLANÇO</option>
                    <option value="İŞLETME DEFTERİ">İŞLETME DEFTERİ</option>
                    <option value="SERBEST MESLEK MENSUBU">SERBEST MESLEK MENSUBU</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">VKN / TCKN</label>
                  <Input 
                    value={formData.tax_no}
                    onChange={(e) => setFormData({...formData, tax_no: e.target.value})}
                    placeholder="1234567890" 
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">E-Posta</label>
                  <Input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="info@sirket.com" 
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Adres</label>
                <textarea 
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Şirket resmi adresi..."
                />
              </div>

              {!editingCompany ? (
                <div className="bg-slate-50 p-4 rounded-2xl space-y-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Yönetici (Admin) Hesabı</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Admin TC/Kullanıcı</label>
                      <Input 
                        value={formData.admin_tc}
                        onChange={(e) => setFormData({...formData, admin_tc: e.target.value})}
                        placeholder="admin_username" 
                        className="rounded-xl bg-white"
                        required={!editingCompany}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Şifre</label>
                      <Input 
                        type="password"
                        value={formData.admin_password}
                        onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
                        placeholder="******" 
                        className="rounded-xl bg-white"
                        required={!editingCompany}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic font-medium">Bu bilgilerle şirketin ilk yöneticisi sisteme giriş yapacaktır.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 text-primary">Şirket Durumu</label>
                  <select 
                    className="w-full rounded-xl border border-input bg-slate-50 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="active">Aktif (Giriş Yapılabilir)</option>
                    <option value="passive">Pasif (Giriş Engellenir)</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 rounded-xl" type="button" onClick={() => setIsModalOpen(false)}>
                  Vazgeç
                </Button>
                <Button className="flex-1 rounded-xl shadow-lg" type="submit">
                  {editingCompany ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
