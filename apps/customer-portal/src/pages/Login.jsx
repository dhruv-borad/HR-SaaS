import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Field, inputCls, btnPrimary, ErrorMsg } from '../lib/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-indigo-700 mb-1">HR Platform</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>
        <ErrorMsg error={error} />
        <Field label="Email">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button className={`${btnPrimary} w-full justify-center mt-2`} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
