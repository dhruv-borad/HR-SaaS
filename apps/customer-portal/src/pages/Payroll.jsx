import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, download } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Table, Badge, Empty, Field, inputCls, btnPrimary, btnGhost, btnDanger, ErrorMsg, fmtMoney } from '../lib/ui.jsx';

export default function Payroll() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const cur = tenant?.currency || 'USD';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  const { data: runs = [], isLoading } = useQuery({ queryKey: ['payroll-runs'], queryFn: () => api('/api/payroll/runs') });
  const { data: run } = useQuery({
    queryKey: ['payroll-run', selected],
    queryFn: () => api(`/api/payroll/runs/${selected}`),
    enabled: Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () => api('/api/payroll/runs', { method: 'POST', body: { year: Number(year), month: Number(month) } }),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setSelected(data.id); setError(''); },
    onError: (e) => setError(e.message),
  });
  const finalise = useMutation({
    mutationFn: (id) => api(`/api/payroll/runs/${id}/finalise`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); qc.invalidateQueries({ queryKey: ['payroll-run', selected] }); },
    onError: (e) => alert(e.message),
  });
  const discard = useMutation({
    mutationFn: (id) => api(`/api/payroll/runs/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setSelected(null); },
    onError: (e) => alert(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Payroll</h1>

      <Card title="Run month-end payroll">
        <ErrorMsg error={error} />
        <div className="flex items-end gap-3">
          <Field label="Year"><input className={inputCls} type="number" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
          <Field label="Month">
            <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </Field>
          <button className={`${btnPrimary} mb-3`} disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Calculating…' : 'Create run'}
          </button>
        </div>
        <p className="text-xs text-gray-500">Pulls base salary + approved expenses − unpaid-leave deductions for every active employee. Payment itself is handled offline in V1.</p>
      </Card>

      <Card title="Runs">
        {isLoading ? <Empty text="Loading…" /> : !runs.length ? <Empty text="No payroll runs yet." /> : (
          <Table cols={['Period', 'Status', 'Employees', '']}>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4 font-medium">{r.year}-{String(r.month).padStart(2, '0')}</td>
                <td className="py-2 pr-4"><Badge value={r.status} /></td>
                <td className="py-2 pr-4">{r._count.items}</td>
                <td className="py-2 text-right">
                  <button className="text-indigo-600 text-xs hover:underline" onClick={() => setSelected(r.id)}>Review</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {run && (
        <Card title={`Run ${run.year}-${String(run.month).padStart(2, '0')} — ${run.status}`}
          actions={
            <div className="flex gap-2">
              {run.status === 'DRAFT' && <button className={btnPrimary} disabled={finalise.isPending} onClick={() => finalise.mutate(run.id)}>Confirm &amp; finalise</button>}
              {run.status === 'DRAFT' && <button className={btnDanger} onClick={() => discard.mutate(run.id)}>Discard draft</button>}
              <button className={btnGhost} onClick={() => setSelected(null)}>Close</button>
            </div>
          }>
          <Table cols={['Employee', 'Base', 'Expenses', 'Deductions', 'Net pay', 'Payslip']}>
            {run.items.map((i) => (
              <tr key={i.id}>
                <td className="py-2 pr-4">{i.user.firstName} {i.user.lastName}<div className="text-xs text-gray-400">{i.user.department || ''}</div></td>
                <td className="py-2 pr-4">{fmtMoney(i.baseSalary, cur)}</td>
                <td className="py-2 pr-4 text-green-700">+{fmtMoney(i.expenseAdditions, cur)}</td>
                <td className="py-2 pr-4 text-red-600">−{fmtMoney(i.leaveDeductions, cur)}</td>
                <td className="py-2 pr-4 font-semibold">{fmtMoney(i.netPay, cur)}</td>
                <td className="py-2">
                  <button className="text-indigo-600 text-xs hover:underline"
                    onClick={() => download(`/api/payroll/items/${i.id}/payslip`, `payslip-${run.year}-${run.month}-${i.user.lastName}.pdf`)}>PDF</button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
