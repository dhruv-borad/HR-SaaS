import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Table, Badge, Empty, Field, inputCls, btnPrimary, btnGhost, ErrorMsg, fmtMoney } from '../lib/ui.jsx';

const blank = { email: '', firstName: '', lastName: '', role: 'EMPLOYEE', department: '', salaryYearly: '', managerId: '', travelMaxCostPerTrip: '', travelAllowedDestinations: '' };

export default function Employees() {
  const { user, tenant } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user.role === 'ADMIN';
  const [form, setForm] = useState(null); // null | {..blank} | existing employee
  const [error, setError] = useState('');
  const [tempPw, setTempPw] = useState(null);

  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api('/api/employees') });

  const save = useMutation({
    mutationFn: async (f) => {
      const body = {
        ...f,
        salaryAnnual: Number(f.salaryYearly) || 0,
        managerId: f.managerId || null,
        department: f.department || null,
        travelMaxCostPerTrip: f.travelMaxCostPerTrip === '' ? null : Number(f.travelMaxCostPerTrip),
        travelAllowedDestinations: f.travelAllowedDestinations
          ? f.travelAllowedDestinations.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      if (f.id) return api(`/api/employees/${f.id}`, { method: 'PATCH', body });
      return api('/api/employees', { method: 'POST', body });
    },
    onSuccess: (data, f) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      if (!f.id && data.temporaryPassword) setTempPw({ email: data.email, pw: data.temporaryPassword });
      setForm(null); setError('');
    },
    onError: (e) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }) => api(`/api/employees/${id}/${active ? 'deactivate' : 'activate'}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Employees</h1>
        {isAdmin && <button className={btnPrimary} onClick={() => { setForm({ ...blank }); setTempPw(null); }}>Add employee</button>}
      </div>

      {tempPw && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm">
          <b>Employee created.</b> A welcome email was sent (if email is configured). Temporary password for <b>{tempPw.email}</b>:
          <code className="ml-2 bg-white px-2 py-0.5 rounded border">{tempPw.pw}</code>
          <button className="ml-3 text-amber-700 underline" onClick={() => setTempPw(null)}>dismiss</button>
        </div>
      )}

      {form && (
        <Card title={form.id ? 'Edit employee' : 'New employee'}>
          <ErrorMsg error={error} />
          <div className="grid md:grid-cols-2 gap-x-4">
            {!form.id && <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={set('email')} /></Field>}
            <Field label="First name"><input className={inputCls} value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name"><input className={inputCls} value={form.lastName} onChange={set('lastName')} /></Field>
            <Field label="Role">
              <select className={inputCls} value={form.role} onChange={set('role')}>
                <option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin (HR)</option>
              </select>
            </Field>
            <Field label="Department"><input className={inputCls} value={form.department || ''} onChange={set('department')} /></Field>
            <Field label={`Yearly salary (${tenant?.currency || 'USD'})`}>
              <input className={inputCls} type="number" min="0" step="0.01" value={form.salaryYearly} onChange={set('salaryYearly')} />
            </Field>
            <Field label="Manager">
              <select className={inputCls} value={form.managerId || ''} onChange={set('managerId')}>
                <option value="">— none —</option>
                {employees.filter((e) => e.id !== form.id && e.active).map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </Field>
            <Field label={`Travel: max cost per trip (${tenant?.currency || 'USD'}) — blank = no limit`}>
              <input className={inputCls} type="number" min="0" step="0.01" value={form.travelMaxCostPerTrip || ''} onChange={set('travelMaxCostPerTrip')} />
            </Field>
            <Field label="Travel: allowed destinations (comma-separated, blank = all allowed)">
              <input className={inputCls} placeholder="e.g. London, Berlin, Singapore" value={form.travelAllowedDestinations || ''} onChange={set('travelAllowedDestinations')} />
            </Field>
          </div>
          <div className="flex gap-2 mt-2">
            <button className={btnPrimary} disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? 'Saving…' : 'Save'}</button>
            <button className={btnGhost} onClick={() => { setForm(null); setError(''); }}>Cancel</button>
          </div>
        </Card>
      )}

      <Card>
        {isLoading ? <Empty text="Loading…" /> : !employees.length ? <Empty text="No employees yet." /> : (
          <Table cols={['Name', 'Email', 'Role', 'Department', 'Manager', ...(isAdmin ? ['Yearly Salary'] : []), 'Status', ...(isAdmin ? [''] : [])]}>
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="py-2 pr-4 font-medium">{e.firstName} {e.lastName}</td>
                <td className="py-2 pr-4 text-gray-500">{e.email}</td>
                <td className="py-2 pr-4">{e.role}</td>
                <td className="py-2 pr-4">{e.department || '—'}</td>
                <td className="py-2 pr-4">{e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '—'}</td>
                {isAdmin && <td className="py-2 pr-4">{fmtMoney(e.salaryAnnual, tenant?.currency)}</td>}
                <td className="py-2 pr-4"><Badge value={e.active ? 'ACTIVE' : 'SUSPENDED'} /></td>
                {isAdmin && (
                  <td className="py-2 text-right whitespace-nowrap">
                    <button className="text-indigo-600 text-xs hover:underline mr-3" onClick={() => { setForm({ ...e, salaryYearly: e.salaryAnnual, managerId: e.managerId || '', travelMaxCostPerTrip: e.travelMaxCostPerTrip ?? '', travelAllowedDestinations: (e.travelAllowedDestinations || []).join(', ') }); }}>Edit</button>
                    {e.id !== user.id && (
                      <button className="text-red-600 text-xs hover:underline" onClick={() => toggle.mutate({ id: e.id, active: e.active })}>
                        {e.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
