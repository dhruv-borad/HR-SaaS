import { useQuery } from '@tanstack/react-query';
import { api, download } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Empty, btnGhost, fmtMoney } from '../lib/ui.jsx';

const REPORTS = [
  ['headcount', 'Headcount & salaries'],
  ['leave', 'Leave requests'],
  ['travel', 'Travel requests'],
  ['expenses', 'Expense claims'],
  ['payroll', 'Payroll items'],
];

export default function Reports() {
  const { user, tenant } = useAuth();
  const cur = tenant?.currency || 'USD';
  const isAdmin = user.role === 'ADMIN';
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/reports/dashboard') });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Reports</h1>

      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : data && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card title="Leave patterns (days by department, last 6 months)">
            {!Object.keys(data.leavePatterns).length ? <Empty text="No approved leave in the last 6 months." /> : (
              <div className="space-y-3 text-sm">
                {Object.entries(data.leavePatterns).sort().map(([period, depts]) => (
                  <div key={period}>
                    <div className="font-medium text-gray-700">{period}</div>
                    <ul className="ml-3 text-gray-600">
                      {Object.entries(depts).map(([d, days]) => <li key={d}>{d}: {days} day(s)</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Travel savings">
            <div className="text-sm space-y-1">
              <p>Approved trips: <b>{data.travelSavings.approvedTrips}</b></p>
              <p>Full-price equivalent: <b>{fmtMoney(data.travelSavings.fullPriceTotal, cur)}</b></p>
              <p>Spend: <b>{fmtMoney(data.travelSavings.spentTotal, cur)}</b></p>
              <p className="text-green-700">Saved: <b>{fmtMoney(data.travelSavings.saved, cur)}</b></p>
            </div>
          </Card>
        </div>
      )}

      {isAdmin && (
        <Card title="Export">
          <div className="space-y-2">
            {REPORTS.map(([type, label]) => (
              <div key={type} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-sm">{label}</span>
                <div className="flex gap-2">
                  <button className={`${btnGhost} !py-1 text-xs`} onClick={() => download(`/api/reports/export?type=${type}&format=csv`, `${type}.csv`)}>CSV (Excel)</button>
                  <button className={`${btnGhost} !py-1 text-xs`} onClick={() => download(`/api/reports/export?type=${type}&format=pdf`, `${type}.pdf`)}>PDF</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
