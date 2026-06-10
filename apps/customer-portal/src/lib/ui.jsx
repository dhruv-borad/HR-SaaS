export const Card = ({ title, children, actions }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    {(title || actions) && (
      <div className="flex items-center justify-between mb-4">
        {title && <h2 className="font-semibold text-gray-800">{title}</h2>}
        {actions}
      </div>
    )}
    {children}
  </div>
);

const badgeColors = {
  PENDING: 'bg-amber-100 text-amber-800',
  MANAGER_APPROVED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  FINALISED: 'bg-green-100 text-green-800',
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-700',
};
export const Badge = ({ value }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[value] || 'bg-gray-100 text-gray-700'}`}>
    {String(value).replace('_', ' ')}
  </span>
);

export const Field = ({ label, children }) => (
  <label className="block mb-3">
    <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    {children}
  </label>
);

export const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
export const btn = 'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50';
export const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
export const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`;
export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-700`;

export const Table = ({ cols, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-200">
          {cols.map((c) => <th key={c} className="py-2 pr-4 font-medium">{c}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  </div>
);

export const Empty = ({ text }) => <p className="text-sm text-gray-500 py-6 text-center">{text}</p>;

export const ErrorMsg = ({ error }) => error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null;

export const fmtDate = (d) => new Date(d).toLocaleDateString();
export const fmtMoney = (v, cur = 'USD') => `${cur} ${Number(v).toFixed(2)}`;
