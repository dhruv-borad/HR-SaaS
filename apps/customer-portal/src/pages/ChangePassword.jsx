import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Field, inputCls, btnPrimary, ErrorMsg, Card } from '../lib/ui.jsx';

export default function ChangePassword({ forced = false }) {
  const { markPasswordChanged } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) { setError('New passwords do not match'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      markPasswordChanged();
      setDone(true);
      if (!forced) setTimeout(() => navigate('/'), 800);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const form = (
    <form onSubmit={submit}>
      {forced && <p className="text-sm text-gray-600 mb-4">For security, please set a new password before continuing.</p>}
      <ErrorMsg error={error} />
      {done && <p className="text-sm text-green-700 mb-2">Password updated.</p>}
      <Field label={forced ? 'Temporary password' : 'Current password'}>
        <input className={inputCls} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="New password (min 8 characters)">
        <input className={inputCls} type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
      </Field>
      <Field label="Confirm new password">
        <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <button className={`${btnPrimary} w-full justify-center mt-2`} disabled={busy}>
        {busy ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );

  if (forced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
          <h1 className="text-lg font-bold text-gray-800 mb-4">Change your password</h1>
          {form}
        </div>
      </div>
    );
  }
  return <div className="max-w-sm"><Card title="Change password">{form}</Card></div>;
}
