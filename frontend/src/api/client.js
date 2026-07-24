const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('hotspot_token');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  // Jangan pasang Content-Type JSON jika mengirim FormData (untuk upload file)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      localStorage.removeItem('hotspot_token');
      window.location.href = '/admin/login';
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.warn(`[apiFetch Non-JSON ${res.status}]`, text);
      return {
        success: false,
        message: `Server backend sedang dalam perbaikan/booting (Status ${res.status}).`,
      };
    }

    return await res.json();
  } catch (err) {
    console.error(`[apiFetch Network Error ${path}]`, err.message);
    return {
      success: false,
      message: err.message || 'Gagal terhubung ke backend server.',
    };
  }
}

export async function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPut(path, body) {
  return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
}

export async function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}
