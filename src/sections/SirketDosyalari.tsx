import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Folder, File, UploadCloud, ChevronRight, Download, Trash2, 
  Plus, ArrowLeft, Loader2, FileText, Image as ImageIcon, 
  FileSpreadsheet, FileArchive, FolderPlus, FilePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { formatBytes } from '@/lib/utils';
import type { CompanyFolder, CompanyFile } from '@/types';

export function SirketDosyalari() {
  const { currentView } = useApp();
  const [folders, setFolders] = useState<CompanyFolder[]>([]);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [currentFolder, setCurrentFolder] = useState<CompanyFolder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<CompanyFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchContents = async (folderId?: string | null) => {
    setIsLoading(true);
    try {
      const q = folderId ? `?parentId=${folderId}` : '';
      const fq = folderId ? `?folderId=${folderId}` : '';
      
      const [foldersRes, filesRes] = await Promise.all([
        apiFetch(`/api/company/folders${q}`),
        apiFetch(`/api/company/files${fq}`)
      ]);
      
      if (foldersRes.success) setFolders(foldersRes.data);
      if (filesRes.success) setFiles(filesRes.data);
    } catch (e: any) {
      toast.error('İçerik yüklenemedi: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'sirket-dosyalari') {
      fetchContents(currentFolder?.id);
    }
  }, [currentView, currentFolder]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await apiFetch('/api/company/folders', {
        method: 'POST',
        body: JSON.stringify({ name: newFolderName.trim(), parentId: currentFolder?.id || null })
      });
      if (res.success) {
        toast.success('Klasör oluşturuldu');
        setIsNewFolderOpen(false);
        setNewFolderName('');
        fetchContents(currentFolder?.id);
      }
    } catch (e: any) {
      toast.error('Klasör oluşturulamadı: ' + e.message);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu klasörü ve içindeki her şeyi silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/api/company/folders/${id}`, { method: 'DELETE' });
      toast.success('Klasör silindi');
      fetchContents(currentFolder?.id);
    } catch (err: any) {
      toast.error('Klasör silinemedi: ' + err.message);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/api/company/files/${id}`, { method: 'DELETE' });
      toast.success('Dosya silindi');
      fetchContents(currentFolder?.id);
    } catch (err: any) {
      toast.error('Dosya silinemedi: ' + err.message);
    }
  };

  const navigateToFolder = (folder: CompanyFolder | null) => {
    if (!folder) {
      setCurrentFolder(null);
      setBreadcrumbs([]);
      return;
    }
    setCurrentFolder(folder);
    
    // Breadcrumb mantığı
    const existsIndex = breadcrumbs.findIndex(b => b.id === folder.id);
    if (existsIndex >= 0) {
      setBreadcrumbs(breadcrumbs.slice(0, existsIndex + 1));
    } else {
      setBreadcrumbs([...breadcrumbs, folder]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu çok büyük (Max: 10MB)');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await apiFetch('/api/company/files', {
          method: 'POST',
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            file_data: base64,
            folderId: currentFolder?.id || null
          })
        });
        if (res.success) {
          toast.success('Dosya başarıyla yüklendi');
          fetchContents(currentFolder?.id);
        }
      } catch (err: any) {
        toast.error('Dosya yükleme hatası: ' + err.message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadFile = async (id: string, name: string) => {
    try {
      const res = await apiFetch(`/api/company/files/download/${id}`);
      if (res.success && res.file_data) {
        const a = document.createElement('a');
        a.href = res.file_data;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        toast.error('Dosya indirilemedi');
      }
    } catch (e: any) {
      toast.error('Dosya indirme hatası: ' + e.message);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
    if (type.includes('zip') || type.includes('rar')) return <FileArchive className="w-8 h-8 text-amber-500" />;
    return <File className="w-8 h-8 text-slate-400" />;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-100px)]">
      {/* HEADER */}
      <div className="p-4 border-b flex items-center justify-between bg-slate-50/50 rounded-t-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-500" />
            Şirket Dosyaları
          </h2>
          <p className="text-xs text-slate-500 mt-1">Şirketinize ait tüm evrakları burada saklayın.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsNewFolderOpen(true)}>
            <FolderPlus className="w-4 h-4 mr-2 text-amber-500" /> Klasör Oluştur
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePlus className="w-4 h-4 mr-2" />}
            Dosya Yükle
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {/* BREADCRUMB */}
      <div className="px-4 py-3 bg-white border-b flex items-center text-sm font-medium text-slate-600 overflow-x-auto">
        <button 
          onClick={() => navigateToFolder(null)}
          className="hover:text-indigo-600 flex items-center gap-1 transition-colors"
        >
          Ana Dizin
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <div key={crumb.id} className="flex items-center">
            <ChevronRight className="w-4 h-4 text-slate-400 mx-1 flex-shrink-0" />
            <button 
              onClick={() => navigateToFolder(crumb)}
              className={`transition-colors ${idx === breadcrumbs.length - 1 ? 'text-slate-900 font-bold' : 'hover:text-indigo-600'}`}
            >
              {crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>İçerik yükleniyor...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            
            {currentFolder && (
              <div 
                onClick={() => navigateToFolder(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null)}
                className="bg-white border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:bg-indigo-50">
                  <ArrowLeft className="w-6 h-6 text-slate-500 group-hover:text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Geri Dön</span>
              </div>
            )}

            {folders.map(folder => (
              <div 
                key={folder.id}
                onClick={() => navigateToFolder(folder)}
                className="bg-white border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group relative"
              >
                <button 
                  onClick={(e) => handleDeleteFolder(folder.id, e)}
                  className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <Folder className="w-12 h-12 text-amber-400 mb-3 group-hover:scale-110 transition-transform" fill="currentColor" />
                <span className="text-sm font-semibold text-slate-700 text-center line-clamp-2 w-full">{folder.name}</span>
              </div>
            ))}

            {files.map(file => (
              <div 
                key={file.id}
                className="bg-white border rounded-xl p-4 flex flex-col items-center justify-center relative group hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => downloadFile(file.id, file.name)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteFile(file.id)} className="p-1.5 bg-red-50 text-red-500 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mb-3 group-hover:scale-105 transition-transform">
                  {getFileIcon(file.type)}
                </div>
                <span className="text-xs font-semibold text-slate-700 text-center line-clamp-2 w-full break-words" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">{formatBytes(file.size)}</span>
              </div>
            ))}

            {folders.length === 0 && files.length === 0 && !currentFolder && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                <Folder className="w-16 h-16 text-slate-200 mb-4" />
                <p>Şirketinize ait henüz bir dosya veya klasör bulunmuyor.</p>
                <Button variant="link" onClick={() => setIsNewFolderOpen(true)}>Hemen bir klasör oluşturun</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Klasör Oluştur</DialogTitle>
            <DialogDescription>
              {currentFolder ? `'${currentFolder.name}' içerisine yeni bir klasör ekliyorsunuz.` : 'Ana dizine yeni bir klasör ekliyorsunuz.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              autoFocus
              placeholder="Örn: 2026 Faturaları, İK Evrakları vs."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderOpen(false)}>İptal</Button>
            <Button onClick={handleCreateFolder}>Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
