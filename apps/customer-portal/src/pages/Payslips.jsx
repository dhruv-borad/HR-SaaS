import { useQuery } from '@tanstack/react-query';
import { api, download } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Table, Empty, fmtMoney } from '../lib/ui.jsx';

export default function Payslips() {
  const { tenant } = useAuth();
  const cur = tenant?.currency || 'USD';
  const { data: items = [], isLoading } = useQuery({ queryKey: ['my-payslips'], queryFn: () => api('/api/payroll/my-payslips') });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">My Payslips</h1>
      <Card>
        {isLoading ? <Empty text="Loading…" /> : !items.length ? <Empty text="No payslips yet — they appear here once payroll is finalised." /> : (
          <Table cols={['Period', 'Base', 'Expenses', 'Deductions', 'Net pay', '']}>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="py-2 pr-4 font-medium">{i.run.year}-{String(i.run.month).padStart(2, '0')}</td>
                <td className="py-2 pr-4">{fmtMoney(i.baseSalary, cur)}</td>
                <td className="py-2 pr-4 text-green-700">+{fmtMoney(i.expenseAdditions, cur)}</td>
                <td className="py-2 pr-4 text-red-600">−{fmtMoney(i.leaveDeductions, cur)}</td>
                <td className="py-2 pr-4 font-semibold">{fmtMoney(i.netPay, cur)}</td>
                <td className="py-2 text-right">
                  <button className="text-indigo-600 text-xs hover:underline"
                    onClick={() => download(`/api/payroll/items/${i.id}/payslip`, `payslip-${i.run.year}-${i.run.month}.pdf`)}>Download PDF</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
