import { useState } from 'react';
import { api, setStoredToken } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { accessToken } = await api('/admin/login', { method: 'POST', body: { username, password } });
      setStoredToken(accessToken);
      onLogin();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-lg font-bold mb-1">Super Admin</h1>
        <p className="text-sm text-gray-500 mb-6">Internal provisioning tool</p>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1">Username</span>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </label>
        <label className="block mb-4">
          <span className="block text-sm font-medium mb-1">Password</span>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
