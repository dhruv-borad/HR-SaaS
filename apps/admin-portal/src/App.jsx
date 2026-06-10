import { useState } from 'react';
import { getToken, setStoredToken } from './lib/api.js';
import Login from './pages/Login.jsx';
import Tenants from './pages/Tenants.jsx';

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div>
          <span className="font-bold">HR Platform</span>
          <span className="ml-2 text-xs bg-amber-500 text-gray-900 px-2 py-0.5 rounded-full font-semibold">SUPER ADMIN</span>
        </div>
        <button className="text-sm text-gray-300 hover:text-white" onClick={() => { setStoredToken(null); setAuthed(false); }}>Sign out</button>
      </header>
      <main className="p-6 max-w-5xl mx-auto">
        <Tenants />
      </main>
    </div>
  );
}
