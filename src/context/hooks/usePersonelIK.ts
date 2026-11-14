import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { Personnel, User } from '@/types';

export function usePersonelIK({ user }: { user: User | null }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [currentPersonnel, setCurrentPersonnel] = useState<Personnel | null>(null);

  // ==================== PERSONEL FUNCTIONS ====================
  const fetchPersonnel = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/personnel');
      if (data.success) setPersonnel(data.personnel);
    } catch (error) {
      console.error('Fetch personnel error:', error);
    }
  }, []);

  const fetchMyPersonnel = useCallback(async () => {
    try {
      const data = await apiFetch('/api/personnel/me');
      if (data.success) setCurrentPersonnel(data.personnel);
    } catch (error) {
      console.error('Fetch my personnel error:', error);
    }
  }, []);

  const bulkUploadPersonnel = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await apiFetch('/api/admin/personnel/bulk-upload', {
        method: 'POST',
        body: formData
      });
      if (data.success) {
        fetchPersonnel();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchPersonnel]);

  const addPersonnel = useCallback(async (data: any) => {
    try {
      const result = await apiFetch('/api/admin/personnel', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (result.success) {
        fetchPersonnel();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchPersonnel]);

  const updatePersonnel = useCallback(async (id: number, data: any) => {
    try {
      const result = await apiFetch(`/api/admin/personnel/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (result.success) {
        fetchPersonnel();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPersonnel]);

  const deletePersonnel = useCallback(async (id: number) => {
    try {
      const result = await apiFetch(`/api/admin/personnel/${id}`, {
        method: 'DELETE'
      });
      if (result.success) {
        fetchPersonnel();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPersonnel]);

  const [leaves, setLeaves] = useState<any[]>([]);
  const fetchLeaves = useCallback(async () => {
    try {
      const endpoint = (user?.role === 'admin' || user?.role === 'super_admin') ? '/api/admin/leaves' : '/api/personnel/leaves';
      const data = await apiFetch(endpoint);
      if (data.success) setLeaves(data.data);
    } catch (error) { console.error('Fetch leaves error:', error); }
  }, [user]);

  const submitLeaveRequest = useCallback(async (data: any | FormData) => {
    try {
      const result = await apiFetch('/api/personnel/leaves', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data)
      });
      if (result.success) fetchLeaves();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchLeaves]);

  const updateLeaveStatus = useCallback(async (id: number, status: string) => {
    try {
      const data = await apiFetch(`/api/admin/leaves/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (data.success) {
        fetchLeaves();
        fetchPersonnel(); 
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchLeaves, fetchPersonnel]);

  const [pointages, setPointages] = useState<any[]>([]);
  const fetchPointages = useCallback(async () => {
    try {
      const endpoint = (user?.role === 'admin' || user?.role === 'super_admin') ? '/api/admin/pointage' : '/api/personnel/pointage';
      const data = await apiFetch(endpoint);
      if (data.success) setPointages(data.data);
    } catch (error) { console.error('Fetch pointages error:', error); }
  }, [user]);

  const bulkLockPointage = useCallback(async (personnelId: number, year: number, month: number, lockStatus: boolean) => {
    try {
      const result = await apiFetch('/api/admin/pointage/bulk-lock', {
        method: 'POST',
        body: JSON.stringify({ personnel_id: personnelId, year, month, lock_status: lockStatus })
      });
      if (result.success) {
        fetchPointages();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPointages]);

  const bulkLockAllPersonnel = useCallback(async (year: number, month: number, lockStatus: boolean) => {
    try {
      const result = await apiFetch('/api/admin/pointage/bulk-lock-all', {
        method: 'POST',
        body: JSON.stringify({ year, month, lock_status: lockStatus })
      });
      if (result.success) {
        fetchPointages();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPointages]);

  const downloadPuantajTemplate = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pointage/template', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'puantaj_sablon.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Template download error:', error);
    }
  }, []);

  const uploadPuantajExcel = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await apiFetch('/api/admin/pointage/bulk-upload', {
        method: 'POST',
        body: formData
      });
      if (data.success) {
        fetchPointages();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [fetchPointages]);

  const [requests, setRequests] = useState<any[]>([]);
  const fetchRequests = useCallback(async () => {
    try {
      const endpoint = (user?.role === 'admin' || user?.role === 'super_admin') ? '/api/admin/requests' : '/api/personnel/requests';
      const data = await apiFetch(endpoint);
      if (data.success) setRequests(data.data);
    } catch (error) { console.error('Fetch requests error:', error); }
  }, [user]);

  const updateRequestStatus = useCallback(async (id: number, status: string) => {
    try {
      const result = await apiFetch(`/api/admin/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (result.success) fetchRequests();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchRequests]);

  const submitExpenseRequest = useCallback(async (data: any | FormData) => {
    try {
      const result = await apiFetch('/api/personnel/requests', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data)
      });
      if (result.success) fetchRequests();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchRequests]);

  const uploadPersonnelDocument = useCallback(async (file: File, type: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      return await apiFetch('/api/personnel/documents', {
        method: 'POST',
        body: formData
      });
    } catch (error: any) { return { success: false, message: error.message }; }
  }, []);


  const submitPointage = useCallback(async (data: any) => {
    try {
      const response = await fetch('/api/pointage', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) fetchPointages();
      return result;
    } catch (error: any) { return { success: false, message: error.message }; }
  }, [fetchPointages]);


  return {
    personnel,
    setPersonnel,
    currentPersonnel,
    setCurrentPersonnel,
    fetchPersonnel,
    fetchMyPersonnel,
    bulkUploadPersonnel,
    addPersonnel,
    updatePersonnel,
    deletePersonnel,
    leaves,
    setLeaves,
    fetchLeaves,
    submitLeaveRequest,
    updateLeaveStatus,
    pointages,
    setPointages,
    fetchPointages,
    bulkLockPointage,
    bulkLockAllPersonnel,
    downloadPuantajTemplate,
    uploadPuantajExcel,
    requests,
    setRequests,
    fetchRequests,
    updateRequestStatus,
    submitExpenseRequest,
    uploadPersonnelDocument,
    submitPointage,
  };
}
