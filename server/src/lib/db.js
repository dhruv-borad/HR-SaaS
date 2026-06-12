// Per-tenant database isolation: each tenant has their own Postgres database.
// The admin DB (DATABASE_URL) stores only the Tenant table.
// Operational tables (User, Leave, Travel, Payroll, etc.) live in each tenant's DB.
//
// Two Prisma clients:
//   adminPrisma  → admin DB (Tenant model only)
//   tenant pool  → per-tenant DB (all operational models)
//
// The `prisma` Proxy routes:
//   prisma.tenant  → adminPrisma.tenant  (transparently, so settings routes still work)
//   prisma.*       → per-tenant client via AsyncLocalStorage

import adminPkg from '../generated/admin/index.js';
import tenantPkg from '../generated/tenant/index.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { PrismaClient: AdminPrismaClient } = adminPkg;
const { PrismaClient: TenantPrismaClient } = tenantPkg;

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
// Connects to DATABASE_URL (the master Neon DB) which holds only the Tenant table.
const adminBase = new AdminPrismaClient();
export const adminPrisma = adminBase;

// ─── Per-tenant client pool ──────────────────────────────────────────────────
const clientPool = new Map(); // tenantId -> extended TenantPrismaClient

function buildExtendedClient(databaseUrl) {
  const base = new TenantPrismaClient({ datasources: { db: { url: databaseUrl } } });
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

// Raw tenant client — no extension, used for provisioning/admin queries
// where there is no tenant context in ALS.
export function buildDirectClient(databaseUrl) {
  return new TenantPrismaClient({ datasources: { db: { url: databaseUrl } } });
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
// Route files use `prisma` as normal.
// `prisma.tenant` transparently routes to adminPrisma so settings/auth routes
// can read tenant config without any code changes.
// All other models route to the per-tenant client from AsyncLocalStorage.
export const prisma = new Proxy({}, {
  get(_, prop) {
    // Tenant model lives in the admin DB, not per-tenant DBs.
    if (prop === 'tenant') return adminBase.tenant;

    const ctx = tenantContext.getStore();
    if (!ctx?.client) {
      throw new Error(`prisma.${String(prop)} called outside tenant context — did you forget requireAuth()?`);
    }
    return ctx.client[prop];
  },
});

// ─── Migration runner ────────────────────────────────────────────────────────
// Runs `prisma migrate deploy` against a new tenant database using the tenant schema.
export function runTenantMigrations(databaseUrl) {
  execSync('npx prisma migrate deploy --schema prisma/tenant/schema.prisma', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: PRISMA_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function runWithTenant(tenantId, fn) {
  return tenantContext.run({ tenantId }, fn);
}
