import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

// ─── Styles ──────────────────────────────────────────────────────────────────
const inp = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';
const btn = 'rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 transition-colors';
const btnPrimary = `${btn} bg-gray-900 text-white hover:bg-gray-700`;
const btnOutline = `${btn} border border-gray-300 hover:bg-gray-50`;
const btnGreen   = `${btn} bg-green-700 text-white hover:bg-green-800`;

const PLANS = [
  ['SMALL_BUSINESS',   'Small Business (10–100)'],
  ['GROWING_BUSINESS', 'Growing Business (100–500)'],
  ['ENTERPRISE',       'Enterprise (500+)'],
];

const blankForm = {
  name: '', plan: 'SMALL_BUSINESS',
  adminEmail: '', adminFirstName: '', adminLastName: '',
  headcount: '', billingContactName: '', billingContactEmail: '',
  databaseUrl: '',
};

function Field({ label, children, hint }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-0.5">{hint}</span>}
    </label>
  );
}

function PlanBadge({ plan }) {
  const colors = { SMALL_BUSINESS: 'bg-blue-100 text-blue-800', GROWING_BUSINESS: 'bg-purple-100 text-purple-800', ENTERPRISE: 'bg-amber-100 text-amber-800' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[plan] || 'bg-gray-100 text-gray-700'}`}>{plan.replace(/_/g, ' ')}</span>;
}

// ─── Per-tenant live stats ────────────────────────────────────────────────────
function TenantHealth({ tenantId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenant-health', tenantId],
    queryFn: () => api(`/admin/tenants/${tenantId}`),
    staleTime: 60_000,
  });
  if (isLoading) return <span className="text-gray-400 text-xs">loading…</span>;
  if (isError)   return <span className="text-red-400 text-xs">unavailable</span>;
  const c = data?._count || {};
  return (
    <span className="text-xs text-gray-600">
      {c.users ?? 0} users · {c.leaveRequests ?? 0} leaves · {c.travelRequests ?? 0} trips · {c.expenseClaims ?? 0} expenses
    </span>
  );
}

// ─── Provision form ───────────────────────────────────────────────────────────
function ProvisionForm({ onClose, onSuccess }) {
  const [form, setForm] = useState(blankForm);
  const [step, setStep] = useState('details'); // 'details' | 'database'
  const [neonResult, setNeonResult] = useState(null);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const autoCreate = useMutation({
    mutationFn: () => api('/admin/neon/create-project', {
      method: 'POST',
      body: { projectName: `hr-${form.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}` },
    }),
    onSuccess: (data) => {
      setNeonResult(data);
      setForm((f) => ({ ...f, databaseUrl: data.databaseUrl }));
    },
    onError: (e) => setError(e.message),
  });

  const provision = useMutation({
    mutationFn: () => api('/admin/tenants', {
      method: 'POST',
      body: {
        name: form.name, plan: form.plan,
        adminEmail: form.adminEmail,
        adminFirstName: form.adminFirstName,
        adminLastName: form.adminLastName,
        headcount: Number(form.headcount) || 0,
        billingContactName: form.billingContactName,
        billingContactEmail: form.billingContactEmail,
        databaseUrl: form.databaseUrl,
      },
    }),
    onSuccess: (data) => { onSuccess(data); onClose(); },
    onError: (e) => setError(e.message),
  });

  const isBusy = autoCreate.isPending || provision.isPending;
  const canProceed = form.name && form.plan && form.adminEmail;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Provision new customer</h2>
        <button className="text-gray-400 text-xs hover:underline" onClick={onClose}>close</button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-5">
        {['details', 'database'].map((s, i) => (
          <div key={s} className={`flex items-center gap-1.5 text-sm ${step === s ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</span>
            {s === 'details' ? 'Company details' : 'Database'}
            {i < 1 && <span className="text-gray-300 ml-1">›</span>}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Step 1: Company details */}
      {step === 'details' && (
        <>
          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Company name"><input className={inp} value={form.name} onChange={set('name')} /></Field>
            <Field label="Plan">
              <select className={inp} value={form.plan} onChange={set('plan')}>
                {PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Admin email"><input className={inp} type="email" value={form.adminEmail} onChange={set('adminEmail')} /></Field>
            <Field label="Headcount"><input className={inp} type="number" min="0" value={form.headcount} onChange={set('headcount')} /></Field>
            <Field label="Admin first name"><input className={inp} value={form.adminFirstName} onChange={set('adminFirstName')} /></Field>
            <Field label="Admin last name"><input className={inp} value={form.adminLastName} onChange={set('adminLastName')} /></Field>
            <Field label="Billing contact name"><input className={inp} value={form.billingContactName} onChange={set('billingContactName')} /></Field>
            <Field label="Billing contact email"><input className={inp} type="email" value={form.billingContactEmail} onChange={set('billingContactEmail')} /></Field>
          </div>
          <div className="flex gap-2 mt-1">
            <button className={btnPrimary} disabled={!canProceed} onClick={() => { setError(''); setStep('database'); }}>Next: Database →</button>
            <button className={btnOutline} onClick={onClose}>Cancel</button>
          </div>
        </>
      )}

      {/* Step 2: Database */}
      {step === 'database' && (
        <>
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            An isolated Neon database will be created for <b>{form.name}</b> and migrations will run automatically.
          </div>

          {/* Auto-create */}
          <div className="border border-gray-200 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-gray-900">✦ Auto-create via Neon API</p>
                <p className="text-xs text-gray-500 mt-0.5">Recommended — creates an isolated Neon project instantly.</p>
              </div>
              <button className={btnGreen} disabled={isBusy} onClick={() => { setError(''); autoCreate.mutate(); }}>
                {autoCreate.isPending ? 'Creating…' : 'Create DB'}
              </button>
            </div>
            {neonResult && (
              <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                ✓ Project <b>{neonResult.projectName}</b> created — ready to provision.
              </p>
            )}
          </div>

          {/* Manual fallback */}
          <div className="border border-gray-200 rounded-xl p-4 mb-4">
            <p className="font-medium text-sm text-gray-900 mb-2">Or enter connection string manually</p>
            <Field label="Neon connection string" hint="Create a project on neon.tech and paste the full connection string">
              <input className={inp} type="password" placeholder="postgresql://user:pass@host/db?sslmode=require" value={form.databaseUrl} onChange={set('databaseUrl')} />
            </Field>
          </div>

          <div className="flex gap-2">
            <button className={btnOutline} onClick={() => setStep('details')}>← Back</button>
            <button className={btnPrimary} disabled={isBusy || !form.databaseUrl} onClick={() => { setError(''); provision.mutate(); }}>
              {provision.isPending ? 'Provisioning…' : 'Provision customer'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Tenants() {
  const qc = useQueryClient();
  const [showProvision, setShowProvision] = useState(false);
  const [provisioned, setProvisioned] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [migrateTarget, setMigrateTarget] = useState(null);
  const [migrateStatus, setMigrateStatus] = useState(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api('/admin/tenants'),
    refetchInterval: 30_000,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, action }) => api(`/admin/tenants/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
    onError: (e) => alert(e.message),
  });

  const migrate = useMutation({
    mutationFn: (id) => api(`/admin/tenants/${id}/migrate`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-health', migrateTarget] });
      setMigrateStatus('done');
    },
    onError: (e) => setMigrateStatus(e.message),
  });

  const filtered = tenants.filter((t) => {
    if (statusFilter === 'ACTIVE') return t.status === 'ACTIVE';
    if (statusFilter === 'SUSPENDED') return t.status === 'SUSPENDED';
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customer Operations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tenants.length} customer{tenants.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={btnPrimary} onClick={() => { setShowProvision(true); setProvisioned(null); }}>
          + Provision customer
        </button>
      </div>

      {/* Success banner */}
      {provisioned && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm">
          <p className="font-semibold text-green-800 mb-1">Customer provisioned ✓</p>
          <p>Tenant ID: <code className="bg-white px-1.5 rounded border text-xs">{provisioned.tenantId}</code></p>
          <p>Admin login: <b>{provisioned.adminEmail}</b> · Temporary password: <code className="bg-white px-1.5 rounded border text-xs">{provisioned.temporaryPassword}</code></p>
          <p className="text-green-700 mt-1 text-xs">A welcome email was sent if email is configured. The password above is shown once.</p>
          <button className="text-green-800 underline mt-1 text-xs" onClick={() => setProvisioned(null)}>dismiss</button>
        </div>
      )}

      {/* Provision form */}
      {showProvision && (
        <ProvisionForm
          onClose={() => setShowProvision(false)}
          onSuccess={(data) => { setProvisioned(data); qc.invalidateQueries({ queryKey: ['tenants'] }); }}
        />
      )}

      {/* Migrate confirmation panel */}
      {migrateTarget && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium">Re-run migrations — {tenants.find(t => t.id === migrateTarget)?.name}</p>
            <button className="text-gray-400 text-xs hover:underline" onClick={() => { setMigrateTarget(null); setMigrateStatus(null); }}>close</button>
          </div>
          {migrateStatus === 'done' && <p className="text-green-700 mb-2">✓ Migrations applied successfully.</p>}
          {migrateStatus && migrateStatus !== 'done' && <p className="text-red-600 mb-2">{migrateStatus}</p>}
          {migrateStatus !== 'done' && (
            <button className={btnPrimary} disabled={migrate.isPending} onClick={() => { setMigrateStatus(null); migrate.mutate(migrateTarget); }}>
              {migrate.isPending ? 'Running…' : 'Run migrations'}
            </button>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {[['ALL', 'All'], ['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === v ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading customers…</p>
        ) : !filtered.length ? (
          <p className="text-sm text-gray-500 py-8 text-center">No customers yet. Provision the first one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="py-3 px-4 font-medium">Company</th>
                <th className="py-3 px-4 font-medium">Plan</th>
                <th className="py-3 px-4 font-medium">Live stats</th>
                <th className="py-3 px-4 font-medium">Provisioned</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{t.id.slice(0, 8)}…</p>
                  </td>
                  <td className="py-3 px-4"><PlanBadge plan={t.plan} /></td>
                  <td className="py-3 px-4"><TenantHealth tenantId={t.id} /></td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{new Date(t.provisionedAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3">
                      <button className="text-xs text-indigo-600 hover:underline"
                        onClick={() => { setMigrateTarget(t.id); setMigrateStatus(null); }}>
                        Migrate
                      </button>
                      {t.status === 'ACTIVE'
                        ? <button className="text-xs text-red-600 hover:underline" onClick={() => setStatus.mutate({ id: t.id, action: 'suspend' })}>Suspend</button>
                        : <button className="text-xs text-green-700 hover:underline" onClick={() => setStatus.mutate({ id: t.id, action: 'activate' })}>Activate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
