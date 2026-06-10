import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Table, Badge, Empty, Field, inputCls, btnPrimary, btnGhost, ErrorMsg, fmtDate, fmtMoney } from '../lib/ui.jsx';

const blank = { amount: '', category: '', description: '', travelRequestId: '' };

export default function Expenses() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const cur = tenant?.currency || 'USD';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const { data: claims = [], isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => api('/api/expenses') });
  const { data: trips = [] } = useQuery({ queryKey: ['travel'], queryFn: () => api('/api/travel') });

  const submit = useMutation({
    mutationFn: async () => {
      let receiptKey = null;
      if (file) {
        try {
          const { url, key } = await api('/api/expenses/upload-url', { method: 'POST', body: { fileName: file.name, contentType: file.type || 'application/octet-stream' } });
          const put = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
          if (put.ok) receiptKey = key;
        } catch (e) {
          // storage not configured — submit without receipt
          console.warn(e.message);
        }
      }
      return api('/api/expenses', { method: 'POST', body: { ...form, amount: Number(form.amount), travelRequestId: form.travelRequestId || null, receiptKey } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setOpen(false); setForm(blank); setFile(null); setError(''); },
    onError: (e) => setError(e.message),
  });

  const viewReceipt = async (id) => {
    try {
      const { url } = await api(`/api/expenses/${id}/receipt-url`);
      window.open(url, '_blank');
    } catch (e) { alert(e.message); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
        <button className={btnPrimary} onClick={() => setOpen(true)}>Submit expense</button>
      </div>

      {open && (
        <Card title="New expense claim">
          <ErrorMsg error={error} />
          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label={`Amount (${cur})`}><input className={inputCls} type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} /></Field>
            <Field label="Category"><input className={inputCls} placeholder="e.g. Meals, Software, Taxi" value={form.category} onChange={set('category')} /></Field>
            <Field label="Related trip (optional)">
              <select className={inputCls} value={form.travelRequestId} onChange={set('travelRequestId')}>
                <option value="">— none —</option>
                {trips.filter((t) => t.status === 'APPROVED').map((t) => <option key={t.id} value={t.id}>{t.destination} ({fmtDate(t.startDate)})</option>)}
              </select>
            </Field>
            <Field label="Receipt (image or PDF)"><input className={inputCls} type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
          </div>
          <Field label="Description (optional)"><textarea className={inputCls} rows="2" value={form.description} onChange={set('description')} /></Field>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? 'Submitting…' : 'Submit'}</button>
            <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Card>
      )}

      <Card title="Claims">
        {isLoading ? <Empty text="Loading…" /> : !claims.length ? <Empty text="No expense claims yet." /> : (
          <Table cols={['Employee', 'Category', 'Amount', 'Submitted', 'Status', 'Receipt', 'Payroll']}>
            {claims.map((c) => (
              <tr key={c.id}>
                <td className="py-2 pr-4">{c.user.firstName} {c.user.lastName}</td>
                <td className="py-2 pr-4">{c.category}<div className="text-xs text-gray-400">{c.description}</div></td>
                <td className="py-2 pr-4 font-medium">{fmtMoney(c.amount, cur)}</td>
                <td className="py-2 pr-4">{fmtDate(c.createdAt)}</td>
                <td className="py-2 pr-4"><Badge value={c.status} /></td>
                <td className="py-2 pr-4">
                  {c.receiptKey ? <button className="text-indigo-600 text-xs hover:underline" onClick={() => viewReceipt(c.id)}>View</button> : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="py-2 pr-4 text-xs">{c.payrollItemId ? 'Included' : '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
