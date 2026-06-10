import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Empty, fmtMoney } from '../lib/ui.jsx';

function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user, tenant } = useAuth();
  const isManager = user.role !== 'EMPLOYEE';
  const cur = tenant?.currency || 'USD';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/api/reports/dashboard'),
    enabled: isManager,
  });
  const { data: balances } = useQuery({ queryKey: ['balances'], queryFn: () => api('/api/leave/balances') });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Welcome, {user.firstName}</h1>

      <Card title="My leave balances">
        {!balances?.length ? <Empty text="No leave types configured yet. Your admin can add them in Settings." /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {balances.map((b) => (
              <div key={b.id} className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">{b.name}{!b.paid && ' (unpaid)'}</div>
                <div className="text-lg font-semibold">{Number(b.balance)} days</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isManager && (isLoading ? <p className="text-sm text-gray-500">Loading dashboard…</p> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Active employees" value={data.headcount.total} />
            <Stat label="Pending leave" value={data.pendingApprovals.leave} />
            <Stat label="Pending travel" value={data.pendingApprovals.travel} />
            <Stat label="Pending expenses" value={data.pendingApprovals.expenses} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card title="Headcount by department">
              {Object.keys(data.headcount.byDepartment).length === 0 ? <Empty text="No data yet" /> : (
                <ul className="space-y-2 text-sm">
                  {Object.entries(data.headcount.byDepartment).map(([d, n]) => (
                    <li key={d} className="flex justify-between"><span>{d}</span><span className="font-medium">{n}</span></li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Travel savings">
              <div className="text-sm space-y-1">
                <p>Approved trips: <b>{data.travelSavings.approvedTrips}</b></p>
                <p>Full-price equivalent: <b>{fmtMoney(data.travelSavings.fullPriceTotal, cur)}</b></p>
                <p>Actual / estimated spend: <b>{fmtMoney(data.travelSavings.spentTotal, cur)}</b></p>
                <p className="text-green-700">Saved: <b>{fmtMoney(data.travelSavings.saved, cur)}</b></p>
              </div>
            </Card>
          </div>

          <Card title="Monthly cost trend (payroll runs)">
            {!data.costTrend.length ? <Empty text="No payroll runs yet" /> : (
              <ul className="space-y-2 text-sm">
                {data.costTrend.map((m) => (
                  <li key={m.period} className="flex justify-between">
                    <span>{m.period} <span className="text-gray-400">({m.status})</span></span>
                    <span>salary {fmtMoney(m.salary, cur)} + expenses {fmtMoney(m.expenses, cur)} → <b>{fmtMoney(m.total, cur)}</b></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ))}
    </div>
  );
}
