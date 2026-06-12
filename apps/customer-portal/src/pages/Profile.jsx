import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, fmtMoney } from '../lib/ui.jsx';

export default function Profile() {
  const { user: authUser, tenant } = useAuth();
  const cur = tenant?.currency || 'USD';

  const { data: me, isLoading } = useQuery({
    queryKey: ['profile-me'],
    queryFn: () => api('/api/employees').then((list) => list.find((u) => u.id === authUser.id)),
  });

  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: () => api('/api/leave/balances'),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!me) return <p className="text-sm text-gray-500">Profile not found.</p>;

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

      <Card title="Personal details">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Full name</dt>
            <dd className="font-medium text-gray-900">{me.firstName} {me.lastName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{me.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Role</dt>
            <dd className="font-medium text-gray-900">{me.role}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Department</dt>
            <dd className="font-medium text-gray-900">{me.department || '—'}</dd>
          </div>
          {me.manager && (
            <div>
              <dt className="text-gray-500">Manager</dt>
              <dd className="font-medium text-gray-900">{me.manager.firstName} {me.manager.lastName}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Annual salary</dt>
            <dd className="font-medium text-gray-900">{fmtMoney(me.salaryAnnual, cur)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Leave balances">
        {!balances.length ? (
          <p className="text-sm text-gray-500">No leave types configured yet.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {balances.map((b) => (
              <div key={b.id}>
                <dt className="text-gray-500">{b.name} {b.paid ? '' : '(unpaid)'}</dt>
                <dd className="font-medium text-gray-900">{Number(b.balance)} days remaining</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {(me.travelMaxCostPerTrip != null || (me.travelAllowedDestinations?.length > 0)) && (
        <Card title="Travel policy">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {me.travelMaxCostPerTrip != null && (
              <div>
                <dt className="text-gray-500">Max cost per trip</dt>
                <dd className="font-medium text-gray-900">{fmtMoney(me.travelMaxCostPerTrip, cur)}</dd>
              </div>
            )}
            {me.travelAllowedDestinations?.length > 0 && (
              <div className="col-span-2">
                <dt className="text-gray-500">Allowed destinations</dt>
                <dd className="font-medium text-gray-900">{me.travelAllowedDestinations.join(', ')}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}
    </div>
  );
}
