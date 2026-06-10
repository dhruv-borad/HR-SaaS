const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const getToken = () => sessionStorage.getItem('sa_token');
export const setStoredToken = (t) => t ? sessionStorage.setItem('sa_token', t) : sessionStorage.removeItem('sa_token');

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { setStoredToken(null); window.location.reload(); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
