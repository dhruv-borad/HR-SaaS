// Per-tenant database isolation: each tenant has their own Postgres database.
// The admin DB (DATABASE_URL) stores only the Tenant table with a databaseUrl
// column pointing to each tenant's own database.
//
// A lazy client pool (Map<tenantId, PrismaClient>) is maintained in memory.
// The `prisma` export is a Proxy that reads the right client from AsyncLocalStorage
// so all existing route files continue to work unchanged.

import pkg from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { PrismaClient } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PRISMA_ROOT = join(__dirname, '../..');

export const tenantContext = new AsyncLocalStorage();

// Models that carry tenantId — used by the query extension to auto-inject tenant
// scoping (belt-and-suspenders even with DB-level isolation).
const TENANTED = new Set([
  'User', 'LeaveType', 'LeaveBalance', 'LeaveRequest', 'TravelRequest',
  'ExpenseClaim', 'PayrollRun', 'PayrollItem', 'ApprovalWorkflow', 'AuditLog',
]);

// ─── Admin DB client ────────────────────────────────────────────────────────
// Connects to DATABASE_URL (the master Neon DB) which holds only the Tenant
// table. Used exclusively in super-admin and settings routes.
const adminBase = new PrismaClient();
export const adminPrisma = adminBase;

// ─── Per-tenant client pool ──────────────────────────────────────────────────
const clientPool = new Map(); // tenantId -> extended PrismaClient

function buildExtendedClient(databaseUrl) {
  const base = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  return base.$extends({
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
            default:
              break;
          }
          return query(args);
        },
      },
    },
  });
}

// Raw client for a tenant DB — no extension, used for provisioning/admin queries
// where there is no tenant context in ALS.
export function buildDirectClient(databaseUrl) {
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

export async function getTenantClient(tenantId) {
  if (clientPool.has(tenantId)) return clientPool.get(tenantId);
  const tenant = await adminBase.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.databaseUrl) {
    throw new Error(`No database URL configured for tenant ${tenantId}. Contact your system administrator.`);
  }
  const client = buildExtendedClient(tenant.databaseUrl);
  clientPool.set(tenantId, client);
  return client;
}

// ─── Proxy export ────────────────────────────────────────────────────────────
// Route files import `prisma` and use it as normal. This Proxy reads the
// correct per-tenant client from AsyncLocalStorage at call time.
export const prisma = new Proxy({}, {
  get(_, prop) {
    const ctx = tenantContext.getStore();
    if (!ctx?.client) {
      throw new Error(`prisma.${String(prop)} called outside tenant context — did you forget requireAuth()?`);
    }
    return ctx.client[prop];
  },
});

// ─── Migration runner ────────────────────────────────────────────────────────
// Runs `prisma migrate deploy` against a new tenant database URL.
// Called during tenant provisioning to set up the schema.
export function runTenantMigrations(databaseUrl) {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: PRISMA_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function runWithTenant(tenantId, fn) {
  return tenantContext.run({ tenantId }, fn);
}
