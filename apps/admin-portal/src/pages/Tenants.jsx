import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
const btn = 'rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50';
const PLANS = [
  ['SMALL_BUSINESS', 'Small Business (10–100)'],
  ['GROWING_BUSINESS', 'Growing Business (100–500)'],
  ['ENTERPRISE', 'Enterprise (500+)'],
];
const blank = { name: '', plan: 'SMALL_BUSINESS', adminEmail: '', adminFirstName: '', adminLastName: '', headcount: '', billingContactName: '', billingContactEmail: '' };

function Field({ label, children }) {
  return <label className="block mb-3"><span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>{children}</label>;
}

export default function Tenants() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [provisioned, setProvisioned] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const { data: tenants = [], isLoading } = useQuery({ queryKey: ['tenants'], queryFn: () => api('/admin/tenants') });
  const { data: detail } = useQuery({ queryKey: ['tenant', detailId], queryFn: () => api(`/admin/tenants/${detailId}`), enabled: Boolean(detailId) });

  const provision = useMutation({
    mutationFn: () => api('/admin/tenants', { method: 'POST', body: { ...form, headcount: Number(form.headcount) || 0 } }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setProvisioned(data); setShowForm(false); setForm(blank); setError('');
    },
    onError: (e) => setError(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, action }) => api(`/admin/tenants/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); qc.invalidateQueries({ queryKey: ['tenant', detailId] }); },
    onError: (e) => alert(e.message),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Customers</h1>
        <button className={`${btn} bg-gray-900 text-white hover:bg-gray-700`} onClick={() => { setShowForm(true); setProvisioned(null); }}>
          Provision customer
        </button>
      </div>

      {provisioned && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm">
          <p className="font-semibold text-green-800 mb-1">Customer provisioned ✓</p>
          <p>Tenant ID: <code className="bg-white px-1.5 rounded border">{provisioned.tenantId}</code></p>
          <p>Admin login: <b>{provisioned.adminEmail}</b> · Temporary password: <code className="bg-white px-1.5 rounded border">{provisioned.temporaryPassword}</code></p>
          <p className="text-green-700 mt-1">A welcome email was sent if email is configured. The password above is shown once — share it securely if needed.</p>
          <button className="text-green-800 underline mt-1" onClick={() => setProvisioned(null)}>dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">New customer (spec 5.3)</h2>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Company name"><input className={input} value={form.name} onChange={set('name')} /></Field>
            <Field label="Plan tier">
              <select className={input} value={form.plan} onChange={set('plan')}>
                {PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Primary admin email (their first login)"><input className={input} type="email" value={form.adminEmail} onChange={set('adminEmail')} /></Field>
            <Field label="Headcount (for plan validation)"><input className={input} type="number" min="0" value={form.headcount} onChange={set('headcount')} /></Field>
            <Field label="Admin first name"><input className={input} value={form.adminFirstName} onChange={set('adminFirstName')} /></Field>
            <Field label="Admin last name"><input className={input} value={form.adminLastName} onChange={set('adminLastName')} /></Field>
            <Field label="Billing contact name"><input className={input} value={form.billingContactName} onChange={set('billingContactName')} /></Field>
            <Field label="Billing contact email"><input className={input} type="email" value={form.billingContactEmail} onChange={set('billingContactEmail')} /></Field>
          </div>
          <div className="flex gap-2">
            <button className={`${btn} bg-gray-900 text-white hover:bg-gray-700`} disabled={provision.isPending} onClick={() => provision.mutate()}>
              {provision.isPending ? 'Provisioning…' : 'Provision Customer'}
            </button>
            <button className={`${btn} border border-gray-300`} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {isLoading ? <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>
          : !tenants.length ? <p className="text-sm text-gray-500 py-4 text-center">No customers yet. Provision the first one above.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">Provisioned</th>
                <th className="py-2 pr-4 font-medium">Users</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 pr-4 font-medium">{t.name}</td>
                  <td className="py-2 pr-4">{t.plan.replace('_', ' ')}</td>
                  <td className="py-2 pr-4">{new Date(t.provisionedAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{t.users}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>{t.status}</span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button className="text-indigo-600 text-xs hover:underline mr-3" onClick={() => setDetailId(t.id)}>Details</button>
                    {t.status === 'ACTIVE'
                      ? <button className="text-red-600 text-xs hover:underline" onClick={() => setStatus.mutate({ id: t.id, action: 'suspend' })}>Suspend</button>
                      : <button className="text-green-700 text-xs hover:underline" onClick={() => setStatus.mutate({ id: t.id, action: 'activate' })}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{detail.name}</h2>
            <button className="text-gray-500 text-xs hover:underline" onClick={() => setDetailId(null)}>close</button>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            <p>Tenant ID: <code className="text-xs">{detail.id}</code></p>
            <p>Plan: <b>{detail.plan.replace('_', ' ')}</b> · Status: <b>{detail.status}</b></p>
            <p>Headcount (declared): {detail.headcount}</p>
            <p>Users: {detail._count.users} · Leave: {detail._count.leaveRequests} · Travel: {detail._count.travelRequests} · Expenses: {detail._count.expenseClaims} · Payroll runs: {detail._count.payrollRuns}</p>
            <p>Billing: {detail.billingContactName || '—'} {detail.billingContactEmail && `(${detail.billingContactEmail})`}</p>
            <p>Admins: {detail.users.map((u) => u.email).join(', ') || '—'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
