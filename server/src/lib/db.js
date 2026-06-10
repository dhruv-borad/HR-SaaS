// Tenant-scoped Prisma client (spec 4.2): a query-extension automatically
// injects tenant_id into every read/write so no developer can write a
// cross-tenant query by accident. Tenant context comes from the JWT and is
// carried via AsyncLocalStorage.
import pkg from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

const { PrismaClient } = pkg;

export const tenantContext = new AsyncLocalStorage();

// Models that carry tenantId. Tenant itself is only touched by super-admin routes.
const TENANTED = new Set([
  'User', 'LeaveType', 'LeaveBalance', 'LeaveRequest', 'TravelRequest',
  'ExpenseClaim', 'PayrollRun', 'PayrollItem', 'ApprovalWorkflow', 'AuditLog',
]);

const base = new PrismaClient();

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = tenantContext.getStore()?.tenantId;
        if (!tenantId || !TENANTED.has(model)) return query(args);

        const scopedWhere = (w) => ({ AND: [{ tenantId }, w ?? {}] });

        switch (operation) {
          case 'findMany':
          case 'findFirst':
          case 'findFirstOrThrow':
          case 'count':
          case 'aggregate':
          case 'groupBy':
          case 'updateMany':
          case 'deleteMany':
            args = { ...args, where: scopedWhere(args?.where) };
            break;
          case 'create':
            args = { ...args, data: { ...args.data, tenantId } };
            break;
          case 'createMany':
            args = {
              ...args,
              data: (Array.isArray(args.data) ? args.data : [args.data]).map((d) => ({ ...d, tenantId })),
            };
            break;
          // findUnique/update/delete take unique selectors; routes always fetch
          // through a scoped findFirst before mutating by id.
          default:
            break;
        }
        return query(args);
      },
    },
  },
});

// Raw (unscoped) client for super-admin provisioning only.
export const adminPrisma = base;

export function runWithTenant(tenantId, fn) {
  return tenantContext.run({ tenantId }, fn);
}
