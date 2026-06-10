const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

let accessToken = null;
export const setToken = (t) => { accessToken = t; };
export const getToken = () => accessToken;

async function refresh() {
  const res = await fetch(`${API}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.accessToken;
  return data;
}

export { refresh };

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const doFetch = () => fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let res = await doFetch();
  if (res.status === 401 && path !== '/api/auth/login') {
    const r = await refresh();
    if (r) res = await doFetch();
  }
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function download(path, filename) {
  const res = await api(path, { raw: true });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const apiBase = API;
