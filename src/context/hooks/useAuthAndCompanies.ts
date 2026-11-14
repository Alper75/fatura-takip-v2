import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { User, Company, Vehicle, ViewType } from '@/types';

interface UseAuthAndCompaniesDeps {
  onNavigate: (view: ViewType) => void;
  onFetchMyPersonnel: () => void;
  onReset: () => void;
}

export function useAuthAndCompanies({
  onNavigate,
  onFetchMyPersonnel,
  onReset,
}: UseAuthAndCompaniesDeps) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [companies, setCompanies] = useState<Company[]>(() => {
    try {
      const saved = localStorage.getItem('companies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);

  const login = useCallback(async (tc: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tc, password })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setIsAuthenticated(true);
        setUser(data.user);
        if (data.company) {
          const compList = [data.company];
          setCompanies(compList);
          try { localStorage.setItem('companies', JSON.stringify(compList)); } catch(e){}
        }
        if (data.user.role === 'personnel') {
          onNavigate('personel-dashboard');
          onFetchMyPersonnel();
        } else if (data.user.role === 'depo') {
          onNavigate('stok-yonetimi');
        } else if (data.user.role === 'satis') {
          onNavigate('satis-liste');
        } else {
          onNavigate('dashboard');
        }
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('companies');
    setIsAuthenticated(false);
    setUser(null);
    setCompanies([]);
    setCompanyUsers([]);
    onReset();
  }, [onReset]);

  const changePassword = useCallback(async (newPassword: string) => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await response.json();
      if (data.success) {
        if (user) {
          const updatedUser = { ...user, mustChangePassword: false };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [user]);

  // ==================== RBAC & PERMISSIONS FUNCTIONS ====================
  const canAccess = useCallback((permissionKey: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (user.permissions && typeof user.permissions[permissionKey] === 'boolean') {
      return user.permissions[permissionKey]!;
    }
    return false;
  }, [user]);

  const fetchCompanyUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/users');
      if (res.success && res.data) {
        setCompanyUsers(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch company users:', e);
    }
  }, []);

  const addCompanyUser = useCallback(async (data: any) => {
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.success) {
        toast.success(res.message || 'Kullanıcı başarıyla oluşturuldu.');
        await fetchCompanyUsers();
        return { success: true };
      }
      toast.error(res.message || 'Kullanıcı oluşturulamadı.');
      return { success: false, message: res.message };
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu.');
      return { success: false, message: err.message };
    }
  }, [fetchCompanyUsers]);

  const updateCompanyUser = useCallback(async (id: number, data: any) => {
    try {
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.success) {
        toast.success(res.message || 'Kullanıcı yetkileri güncellendi.');
        await fetchCompanyUsers();
        return { success: true };
      }
      toast.error(res.message || 'Güncelleme başarısız.');
      return { success: false, message: res.message };
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu.');
      return { success: false, message: err.message };
    }
  }, [fetchCompanyUsers]);

  const deleteCompanyUser = useCallback(async (id: number) => {
    try {
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      if (res.success) {
        toast.success(res.message || 'Kullanıcı silindi.');
        await fetchCompanyUsers();
        return { success: true };
      }
      toast.error(res.message || 'Kullanıcı silinemedi.');
      return { success: false, message: res.message };
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu.');
      return { success: false, message: err.message };
    }
  }, [fetchCompanyUsers]);

  const resetUserPassword = useCallback(async (id: number, newPassword?: string) => {
    try {
      const res = await apiFetch(`/api/admin/users/${id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (res.success) {
        toast.success(res.message || 'Şifre sıfırlandı.');
        return { success: true, message: res.message };
      }
      toast.error(res.message || 'Şifre sıfırlanamadı.');
      return { success: false, message: res.message };
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu.');
      return { success: false, message: err.message };
    }
  }, []);


  // ==================== SUPER ADMIN FUNCTIONS ====================
  const fetchCompanies = useCallback(async () => {
    try {
      if (user?.role === 'super_admin') {
        const data = await apiFetch('/api/super/companies');
        if (data.success && data.data) {
          setCompanies(data.data);
          try { localStorage.setItem('companies', JSON.stringify(data.data)); } catch(e){}
        }
      } else if (user) {
        const data = await apiFetch('/api/my-company');
        if (data.success && data.data) {
          const compList = [data.data];
          setCompanies(compList);
          try { localStorage.setItem('companies', JSON.stringify(compList)); } catch(e){}
        }
      }
    } catch (error) { console.error('Fetch companies error:', error); }
  }, [user]);

  const addCompany = useCallback(async (data: Omit<Company, 'id'>) => {
    try {
      const result = await apiFetch('/api/super/companies', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

  const updateCompany = useCallback(async (id: number, data: Partial<Company>) => {
    try {
      const result = await apiFetch(`/api/super/companies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

  const updateMyCompany = useCallback(async (data: Partial<Company>) => {
    try {
      const result = await apiFetch('/api/my-company', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (result.success) {
        await fetchCompanies();
      }
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchCompanies]);

  const activeCompany = useMemo(() => {
    return companies.find(c => Number(c.id) === Number(user?.companyId)) || (companies.length > 0 ? companies[0] : null);
  }, [companies, user?.companyId]);

  const isIsletmeDefteri = useMemo(() => {
    if (!activeCompany?.company_type) return false;
    const type = String(activeCompany.company_type).toUpperCase();
    return type.includes('İŞLETME') || type.includes('ISLETME');
  }, [activeCompany?.company_type]);

  const deleteCompany = useCallback(async (id: number) => {
    try {
      const result = await apiFetch(`/api/super/companies/${id}`, {
        method: 'DELETE'
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

  // ==================== ARAÇ YÖNETİMİ ====================
  const addVehicle = useCallback(async (data: Omit<Vehicle, 'id'>) => {
    try {
      const result = await apiFetch('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

  const deleteVehicle = useCallback(async (id: number) => {
    try {
      const result = await apiFetch(`/api/vehicles/${id}`, {
        method: 'DELETE'
      });
      if (result.success) fetchCompanies();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchCompanies]);

  return {
    isAuthenticated,
    user,
    login,
    logout,
    changePassword,
    canAccess,
    companyUsers,
    fetchCompanyUsers,
    addCompanyUser,
    updateCompanyUser,
    deleteCompanyUser,
    resetUserPassword,
    companies,
    activeCompany,
    isIsletmeDefteri,
    fetchCompanies,
    addCompany,
    updateCompany,
    updateMyCompany,
    deleteCompany,
    addVehicle,
    deleteVehicle,
  };
}
