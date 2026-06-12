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
  const base = new TenantPrismaClient({ datas