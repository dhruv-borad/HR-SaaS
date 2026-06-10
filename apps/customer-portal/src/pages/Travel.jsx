import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Table, Badge, Empty, Field, inputCls, btnPrimary, btnGhost, ErrorMsg, fmtDate, fmtMoney } from '../lib/ui.jsx';

const blank = { destination: '', startDate: '', endDate: '', purpose: '', estimatedCost: '', fullPrice: '' };

export default function Travel() {
  const { user, tenant } = useAuth();
  const qc = useQueryClient();
  const cur = tenant?.currency || 'USD';
  const isManager = user.role !== 'EMPLOYEE';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  const { data: requests = [], isLoading } = useQuery({ queryKey: ['travel'], queryFn: () => api('/api/travel') });

  const submit = useMutation({
    mutationFn: () => api('/api/travel', {
      method: 'POST',
      body: { ...form, estimatedCost: Number(form.estimatedCost), fullPrice: form.fullPrice ? Number(form.fullPrice) : null },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['travel'] }); setOpen(false); setForm(blank); setError(''); },
    onError: (e) => setError(e.message),
  });

  const confirmBooking = useMutation({
    mutationFn: (id) => api(`/api/travel/${id}/confirm-booking`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel'] }),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Business Travel</h1>
        <button className={btnPrimary} onClick={() => setOpen(true)}>Request trip</button>
      </div>

      {open && (
        <Card title="New trip request">
          <ErrorMsg error={error} />
          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Destination"><input className={inputCls} value={form.destination} onChange={set('destination')} /></Field>
            <Field label="Purpose"><input className={inputCls} value={form.purpose} onChange={set('purpose')} /></Field>
            <Field label="Start date"><input className={inputCls} type="date" value={form.startDate} onChange={set('startDate')} /></Field>
            <Field label="End date"><input className={inputCls} type="date" value={form.endDate} onChange={set('endDate')} /></Field>
            <Field label={`Estimated cost (${cur})`}><input className={inputCls} type="number" min="0" step="0.01" value={form.estimatedCost} onChange={set('estimatedCost')} /></Field>
            <Field label={`Full price equivalent (${cur}, optional — for savings report)`}><input className={inputCls} type="number" min="0" step="0.01" value={form.fullPrice} onChange={set('fullPrice')} /></Field>
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={submit.isPending} onClick={() => submit.mutate()}>Submit</button>
            <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Card>
      )}

      <Card title="Trips">
        {isLoading ? <Empty text="Loading…" /> : !requests.length ? <Empty text="No trips yet." /> : (
          <Table cols={['Employee', 'Destination', 'Dates', 'Est. cost', 'Policy', 'Status', 'Booking', '']}>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4">{r.user.firstName} {r.user.lastName}</td>
                <td className="py-2 pr-4 font-medium">{r.destination}<div className="text-xs text-gray-400">{r.purpose}</div></td>
                <td className="py-2 pr-4">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                <td className="py-2 pr-4">{fmtMoney(r.estimatedCost, cur)}</td>
                <td className="py-2 pr-4">
                  {r.policyCompliant
                    ? <span className="text-green-700 text-xs">Compliant</span>
                    : <span className="text-red-600 text-xs" title={r.policyNotes || ''}>Out of policy</span>}
                </td>
                <td className="py-2 pr-4"><Badge value={r.status} /></td>
                <td className="py-2 pr-4 text-xs">{r.status === 'APPROVED' ? (r.bookingConfirmed ? 'Confirmed' : 'Pending (offline)') : '—'}</td>
                <td className="py-2 text-right">
                  {isManager && r.status === 'APPROVED' && !r.bookingConfirmed && (
                    <button className="text-indigo-600 text-xs hover:underline" onClick={() => confirmBooking.mutate(r.id)}>Mark booked</button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
