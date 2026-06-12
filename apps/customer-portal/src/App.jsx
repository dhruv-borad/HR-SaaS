import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Employees from './pages/Employees.jsx';
import Leave from './pages/Leave.jsx';
import Travel from './pages/Travel.jsx';
import Expenses from './pages/Expenses.jsx';
import Approvals from './pages/Approvals.jsx';
import Payroll from './pages/Payroll.jsx';
import Payslips from './pages/Payslips.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';

function Shell({ children }) {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER' || isAdmin;
  const isEmployee = user.role === 'EMPLOYEE';

  const links = [
    ['/', 'Dashboard', true],
    ['/employees', 'Employees', !isEmployee],
    ['/profile', 'My Profile', isEmployee],
    ['/leave', 'Time Off', true],
    ['/travel', 'Travel', true],
    ['/expenses', 'Expenses', true],
    ['/approvals', 'Approvals', isManager],
    ['/payroll', 'Payroll', isAdmin],
    ['/payslips', 'My Payslips', true],
    ['/reports', 'Reports', isManager],
    ['/settings', 'Settings', isAdmin],
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="font-bold text-indigo-700">HR Platform</div>
          <div className="text-xs text-gray-500 mt-1 truncate">{tenant?.name}</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {links.filter(([, , show]) => show).map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100 text-sm">
          <div className="font-medium text-gray-800">{user.firstName} {user.lastName}</div>
          <div className="text-xs text-gray-500">{user.role}</div>
          <button onClick={async () => { await logout(); navigate('/login'); }}
            className="mt-2 text-xs text-red-600 hover:underline">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-6 max-w-6xl">{children}</main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  if (user.mustChangePassword) return <ChangePassword forced />;

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER' || isAdmin;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {!isEmployee && <Route path="/employees" element={<Employees />} />}
        {isEmployee && <Route path="/profile" element={<Profile />} />}
        <Route path="/leave" element={<Leave />} />
        <Route path="/travel" element={<Travel />} />
        <Route path="/expenses" element={<Expenses />} />
        {isManager && <Route path="/approvals" element={<Approvals />} />}
        {isAdmin && <Route path="/payroll" element={<Payroll />} />}
        <Route path="/payslips" element={<Payslips />} />
        {isManager && <Route path="/reports" element={<Reports />} />}
        {isAdmin && <Route path="/settings" element={<Settings />} />}
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
