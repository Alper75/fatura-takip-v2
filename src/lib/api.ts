
const getToken = () => localStorage.getItem('token') || '';

const API_BASE = '';

/**
 * Standardized API Fetch Utility for the application.
 * Ensures consistent authentication headers and error handling.
 */
export async function apiFetch(path: string, options?: RequestInit) {
  const isFormData = options?.body instanceof FormData;
  
  const headers: any = { 
    'Authorization': `Bearer ${getToken()}`,
    ...(options?.headers || {})
  };

  if (!isFormData && !headers['Content-Type'] && options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { 
      ...options, 
      headers 
    });
    
    // Auto-logout or other systemic behaviors could be added here if needed
    
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return { success: false, message: 'Oturum süreniz doldu, lütfen tekrar giriş yapın.' };
    }

    if (!res.ok) {
      const errorText = await res.text();
      try {
        const errorJson = JSON.parse(errorText);
        return { success: false, message: errorJson.message || 'API Hatası' };
      } catch {
        return { success: false, message: `Sunucu Hatası (${res.status}): ${errorText.substring(0, 50)}` };
      }
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      // Unify the response format: if it already has 'success', return as is.
      if (data && typeof data === 'object' && !Array.isArray(data) && 'success' in data) {
        return data;
      }
      return { success: true, data };
    } else {
      const text = await res.text();
      return { success: true, data: text };
    }
  } catch (error: any) {
    console.error(`[API] Fetch error for ${path}:`, error);
    return { success: false, message: error.message || 'Bağlantı hatası' };
  }
}

export { getToken };
