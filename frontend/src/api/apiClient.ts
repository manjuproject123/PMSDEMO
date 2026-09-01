const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const getFullUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (!API_BASE_URL) return url;

  let cleanBase = API_BASE_URL;
  let cleanUrl = url.startsWith('/') ? url : `/${url}`;

  if (cleanBase.endsWith('/api') && cleanUrl.startsWith('/api/')) {
    cleanUrl = cleanUrl.substring(4);
  }

  return `${cleanBase}${cleanUrl}`;
};

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('pms_token') || localStorage.getItem('pms_access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res: Response, responseType?: string) => {
  if (res.status === 401) {
    localStorage.removeItem('pms_token');
    localStorage.removeItem('pms_access_token');
    localStorage.removeItem('pms_user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/session-expired';
    }
  }

  if (responseType === 'blob') {
    if (!res.ok) {
      const error: any = new Error(`Request failed with status ${res.status}`);
      error.response = { status: res.status, data: null };
      throw error;
    }
    const blob = await res.blob();
    return { data: blob, status: res.status };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error: any = new Error(data?.message || `Request failed with status ${res.status}`);
    error.response = { status: res.status, data };
    throw error;
  }
  return { data, status: res.status };
};

export const apiClient = {
  get: async <T = any>(
    url: string,
    config?: { params?: Record<string, any>; responseType?: 'json' | 'blob' }
  ): Promise<{ data: T; status: number }> => {
    let fullUrl = getFullUrl(url);
    if (config?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(config.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.append(k, String(v));
      });
      const qs = searchParams.toString();
      if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
    }
    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(res, config?.responseType);
  },

  post: async <T = any>(url: string, body?: any): Promise<{ data: T; status: number }> => {
    const res = await fetch(getFullUrl(url), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  put: async <T = any>(url: string, body?: any): Promise<{ data: T; status: number }> => {
    const res = await fetch(getFullUrl(url), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  delete: async <T = any>(url: string): Promise<{ data: T; status: number }> => {
    const res = await fetch(getFullUrl(url), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};

export default apiClient;
