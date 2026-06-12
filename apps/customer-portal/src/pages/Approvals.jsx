import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Table, Badge, Empty, btnPrimary, btnDanger, fmtDate, fmtMoney } from '../lib/ui.jsx';

function DecideButtons({ onApprove, onReject, busy }) {
  const [note, setNote] = useState('');
  return (
    <div className="flex items-center gap-2 justify-end">
      <input className="rounded border border-gray-300 px-2 py-1 text-xs w-32" placeholder="note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className={`${btnPrimary} !px-2 !py-1 text-xs`} disabled={busy} onClick={() => onApprove(note)}>Approve</button>
      <button className={`${btnDanger} !px-2 !py-1 text-xs`} disabled={busy} onClick={() => onReject(note)}>Reject</button>
    </div>
  );
}

export default function Approvals() {
  const { user, tenant } = useAuth();
  const qc = useQueryClient();
  const cur = tenant?.currency || 'USD';
  const isAdmin = user.role === 'ADMIN';

  const { data: leave = [] } = useQuery({ queryKey: ['leave'], queryFn: () => api('/api/leave') });
  const { data: travel = [] } = useQuery({ queryKey: ['travel'], queryFn: () => api('/api/travel') });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => api('/api/expenses') });

  const act = useMutation({
    mutationFn: ({ path, note }) => api(path, { method: 'POST', body: { note } }),
    onSuccess: (_, { key }) => qc.invalidateQueries({ queryKey: [key] }),
    onError: (e) => alert(e.message),
  });

  const pendingLeave = leave.filter((r) => r.status === 'PENDING' && r.userId !== user.id);
  const pendingTravel = travel.filter((r) => r.status === 'PENDING' && r.userId !== user.id);
  const pendingExpense = expenses.filter((c) => (c.status === 'PENDING' || (isAdmin && c.status === 'MANAGER_APPROVED')) && c.userId !== user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Pending Approvals</h1>

      <Card title={`Leave (${pendingLeave.length})`}>
        {!pendingLeave.length ? <Empty text="Nothing waiting." /> : (
          <Table cols={['Employee', 'Type', 'Dates', 'Days', '']}>
            {pendingLeave.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4">{r.user.firstName} {r.user.lastName}</td>
                <td className="py-2 pr-4">{r.leaveType.name}</td>
                <td className="py-2 pr-4">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                <td className="py-2 pr-4">{Number(r.days)}</td>
                <td className="py-2">
                  <DecideButtons busy={act.isPending}
                    onApprove={(note) => act.mutate({ path: `/api/leave/${r.id}/approve`, note, key: 'leave' })}
                    onReject={(note) => act.mutate({ path: `/api/leave/${r.id}/reject`, note, key: 'leave' })} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`Travel (${pendingTravel.length})`}>
        {!pendingTravel.length ? <Empty text="Nothing waiting." /> : (
          <Table cols={['Employee', 'Destination', 'Purpose', 'Dates', 'Est. cost', 'Policy', '']}>
            {pendingTravel.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4">{r.user.firstName} {r.user.lastName}</td>
                <td className="py-2 pr-4">{r.destination}</td>
                <td className="py-2 pr-4 max-w-[180px] text-sm text-gray-600 truncate" title={r.purpose}>{r.purpose}</td>
                <td className="py-2 pr-4">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                <td className="py-2 pr-4">{fmtMoney(r.estimatedCost, cur)}</td>
                <td className="py-2 pr-4 text-xs">{r.policyCompliant ? <span className="text-green-700">Compliant</span> : <span className="text-red-600" title={r.policyNotes}>Out of policy</span>}</td>
                <td className="py-2">
                  <DecideButtons busy={act.isPending}
                    onApprove={(note) => act.mutate({ path: `/api/travel/${r.id}/approve`, note, key: 'travel' })}
                    onReject={(note) => act.mutate({ path: `/api/travel/${r.id}/reject`, note, key: 'travel' })} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`Expenses (${pendingExpense.length})`}>
        {!pendingExpense.length ? <Empty text="Nothing waiting." /> : (
          <Table cols={['Employee', 'Category', 'Amount', 'Stage', '']}>
            {pendingExpense.map((c) => (
              <tr key={c.id}>
                <td className="py-2 pr-4">{c.user.firstName} {c.user.lastName}</td>
                <td className="py-2 pr-4">{c.category}</td>
                <td className="py-2 pr-4 font-medium">{fmtMoney(c.amount, cur)}</td>
                <td className="py-2 pr-4"><Badge value={c.status} /></td>
                <td className="py-2">
                  {c.status === 'PENDING' ? (
                    <DecideButtons busy={act.isPending}
                      onApprove={(note) => act.mutate({ path: `/api/expenses/${c.id}/approve`, note, key: 'expenses' })}
                      onReject={(note) => act.mutate({ path: `/api/expenses/${c.id}/reject`, note, key: 'expenses' })} />
                  ) : (
                    <DecideButtons busy={act.isPending}
                      onApprove={(note) => act.mutate({ path: `/api/expenses/${c.id}/finance-approve`, note, key: 'expenses' })}
                      onReject={(note) => act.mutate({ path: `/api/expenses/${c.id}/reject`, note, key: 'expenses' })} />
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
