import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, refresh } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await refresh();
        if (data) { setUser(data.user); setTenant(data.tenant); }
      } finally { setLoading(false); }
    })();
  }, []);

  const login = async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.accessToken);
    setUser(data.user); setTenant(data.tenant);
    return data.user;
  };

  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setToken(null); setUser(null); setTenant(null);
  };

  const markPasswordChanged = () => setUser((u) => ({ ...u, mustChangePassword: false }));

  return (
    <AuthCtx.Provider value={{ user, tenant, loading, login, logout, markPasswordChanged }}>
      {children}
    </AuthCtx.Provider>
  );
}
