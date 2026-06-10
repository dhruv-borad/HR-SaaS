import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Card, Table, Badge, Empty, Field, inputCls, btnPrimary, btnGhost, ErrorMsg, fmtDate } from '../lib/ui.jsx';

export default function Leave() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', notes: '' });
  const [error, setError] = useState('');

  const { data: types = [] } = useQuery({ queryKey: ['leave-types'], queryFn: () => api('/api/settings/leave-types') });
  const { data: balances = [] } = useQuery({ queryKey: ['balances'], queryFn: () => api('/api/leave/balances') });
  const { data: requests = [], isLoading } = useQuery({ queryKey: ['leave'], queryFn: () => api('/api/leave') });

  const submit = useMutation({
    mutationFn: () => api('/api/leave', { method: 'POST', body: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      setOpen(false); setForm({ leaveTypeId: '', startDate: '', endDate: '', notes: '' }); setError('');
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Time Off</h1>
        <button className={btnPrimary} onClick={() => setOpen(true)}>Request leave</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {balances.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">{b.name}{!b.paid && ' (unpaid)'}</div>
            <div className="text-xl font-bold">{Number(b.balance)} days</div>
          </div>
        ))}
      </div>

      {open && (
        <Card title="New leave request">
          <ErrorMsg error={error} />
          {!types.length && <p className="text-sm text-amber-700 mb-2">No leave types configured yet — ask your admin to add them in Settings.</p>}
          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Leave type">
              <select className={inputCls} value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}>
                <option value="">Select…</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}{!t.paid ? ' (unpaid)' : ''}</option>)}
              </select>
            </Field>
            <div />
            <Field label="Start date"><input className={inputCls} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="End date"><input className={inputCls} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          </div>
          <Field label="Notes (optional)"><textarea className={inputCls} rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={submit.isPending} onClick={() => submit.mutate()}>Submit</button>
            <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Card>
      )}

      <Card title="Requests">
        {isLoading ? <Empty text="Loading…" /> : !requests.length ? <Empty text="No leave requests yet." /> : (
          <Table cols={['Employee', 'Type', 'Dates', 'Days', 'Status', 'Notes']}>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4">{r.user.firstName} {r.user.lastName}</td>
                <td className="py-2 pr-4">{r.leaveType.name}</td>
                <td className="py-2 pr-4">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                <td className="py-2 pr-4">{Number(r.days)}</td>
                <td className="py-2 pr-4"><Badge value={r.status} /></td>
                <td className="py-2 pr-4 text-gray-500">{r.decisionNote || r.notes || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
