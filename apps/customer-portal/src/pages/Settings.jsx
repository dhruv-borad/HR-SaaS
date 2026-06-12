import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Card, Table, Empty, Field, inputCls, btnPrimary, btnGhost, ErrorMsg } from '../lib/ui.jsx';

export default function Settings() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api('/api/settings') });
  const { data: types = [] } = useQuery({ queryKey: ['leave-types'], queryFn: () => api('/api/settings/leave-types') });

  const [form, setForm] = useState(null);
  const [typeForm, setTypeForm] = useState({ name: '', daysPerYear: '', paid: true });
  const [error, setError] = useState('');
  const [typeError, setTypeError] = useState('');

  useEffect(() => {
    if (settings && !form) {
      setForm({
        currency: settings.currency,
        expenseFinanceThreshold: settings.expenseFinanceThreshold ?? '',
      });
    }
  }, [settings, form]);

  const save = useMutation({
    mutationFn: () => api('/api/settings', {
      method: 'PUT',
      body: {
        currency: form.currency,
        expenseFinanceThreshold: Number(form.expenseFinanceThreshold) || 0,
      },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setError(''); },
    onError: (e) => setError(e.message),
  });

  const addType = useMutation({
    mutationFn: () => api('/api/settings/leave-types', { method: 'POST', body: { ...typeForm, daysPerYear: Number(typeForm.daysPerYear) || 0 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); setTypeForm({ name: '', daysPerYear: '', paid: true }); setTypeError(''); },
    onError: (e) => setTypeError(e.message),
  });

  const delType = useMutation({
    mutationFn: (id) => api(`/api/settings/leave-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
    onError: (e) => alert(e.message),
  });

  if (!form) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      <p className="text-sm text-gray-500">Plan: <b>{settings?.plan?.replace('_', ' ')}</b> (managed by your provider). All modules are active on every plan in V1.</p>

      <Card title="Company policies">
        <ErrorMsg error={error} />
        <div className="grid md:grid-cols-2 gap-x-4">
          <Field label="Currency (3-letter code)"><input className={inputCls} maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          <Field label="Expense finance-approval threshold (amounts at/above need a second admin approval)">
            <input className={inputCls} type="number" min="0" step="0.01" value={form.expenseFinanceThreshold} onChange={(e) => setForm({ ...form, expenseFinanceThreshold: e.target.value })} />
          </Field>

        </div>
        <button className={btnPrimary} disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save policies'}</button>
      </Card>

      <Card title="Leave types">
        <ErrorMsg error={typeError} />
        <div className="flex items-end gap-3 mb-4 flex-wrap">
          <Field label="Name"><input className={inputCls} placeholder="e.g. Annual" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} /></Field>
          <Field label="Days / year"><input className={inputCls} type="number" min="0" value={typeForm.daysPerYear} onChange={(e) => setTypeForm({ ...typeForm, daysPerYear: e.target.value })} /></Field>
          <Field label="Paid?">
            <select className={inputCls} value={typeForm.paid ? '1' : '0'} onChange={(e) => setTypeForm({ ...typeForm, paid: e.target.value === '1' })}>
              <option value="1">Paid</option><option value="0">Unpaid (payroll deduction)</option>
            </select>
          </Field>
          <button className={`${btnGhost} mb-3`} disabled={addType.isPending} onClick={() => addType.mutate()}>Add type</button>
        </div>
        {!types.length ? <Empty text="No leave types yet. Add at least one so employees can request time off." /> : (
          <Table cols={['Name', 'Days / year', 'Paid', '']}>
            {types.map((t) => (
              <tr key={t.id}>
                <td className="py-2 pr-4 font-medium">{t.name}</td>
                <td className="py-2 pr-4">{Number(t.daysPerYear)}</td>
                <td className="py-2 pr-4">{t.paid ? 'Paid' : 'Unpaid'}</td>
                <td className="py-2 text-right"><button className="text-red-600 text-xs hover:underline" onClick={() => delType.mutate(t.id)}>Delete</button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
