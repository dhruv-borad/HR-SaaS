// Super Admin Portal API (spec 5): internal-only, separate auth path.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminPrisma, buildDirectClient, runTenantMigrations } from '../lib/db.js';
import { requireSuperAdmin } from '../lib/auth.js';
import { sendEmail, templates } from '../lib/email.js';
import { asyncHandler, tempPassword } from '../lib/util.js';

const router = Router();

const PLANS = ['SMALL_BUSINESS', 'GROWING_BUSINESS', 'ENTERPRISE'];

// Env-credential login (spec 5.2): no DB row, short-lived SUPER_ADMIN JWT.
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  const U = process.env.SUPER_ADMIN_USERNAME;
  const P = process.env.SUPER_ADMIN_PASSWORD;
  if (!U || !P) return res.status(500).json({ error: 'Super admin credentials not configured on server' });
  if (username !== U || password !== P) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ role: 'SUPER_ADMIN' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ accessToken: token });
}));

// Provisioning (spec 5.3): creates tenant row in admin DB, runs migrations on
// the tenant's own database, then creates the first admin user there.
router.post('/tenants', requireSuperAdmin, asyncHandler(async (req, res) => {
  const {
    name, plan, adminEmail, adminFirstName, adminLastName,
    headcount, billingContactName, billingContactEmail, databaseUrl,
  } = req.body || {};

  if (!name || !plan || !adminEmail || !databaseUrl) {
    return res.status(400).json({ error: 'name, plan, adminEmail and databaseUrl are required' });
  }
  if (!PLANS.includes(plan)) {
    return res.status(400).json({ error: `plan must be one of ${PLANS.join(', ')}` });
  }

  const email = String(adminEmail).toLowerCase();

  // 1. Run Prisma migrations against the new tenant database.
  try {
    runTenantMigrations(databaseUrl);
  } catch (err) {
    return res.status(422).json({ error: `Failed to initialise tenant database: ${err.message}` });
  }

  // 2. Create the tenant row in the admin DB.
  const tenant = await adminPrisma.tenant.create({
    data: {
      name, plan, status: 'ACTIVE',
      headcount: Number(headcount) || 0,
      billingContactName: billingContactName || null,
      billingContactEmail: billingContactEmail || null,
      databaseUrl,
    },
  });

  // 3. Create the first admin user in the tenant's own database.
  const pw = tempPassword();
  const tenantClient = buildDirectClient(databaseUrl);
  try {
    await tenantClient.user.create({
      data: {
        tenantId: tenant.id,
        email,
        firstName: adminFirstName || 'Admin',
        lastName: adminLastName || name,
        role: 'ADMIN',
        passwordHash: await bcrypt.hash(pw, 10),
        mustChangePassword: true,
      },
    });
  } finally {
    await tenantClient.$disconnect();
  }

  const t = templates.welcome(adminFirstName || 'there', email, pw);
  sendEmail({ to: email, ...t });

  res.status(201).json({
    tenantId: tenant.id,
    name: tenant.name,
    plan: tenant.plan,
    status: tenant.status,
    adminEmail: email,
    temporaryPassword: pw, // shown once in the portal in case email is not configured
  });
}));

router.get('/tenants', requireSuperAdmin, asyncHandler(async (req, res) => {
  const tenants = await adminPrisma.tenant.findMany({ orderBy: { provisionedAt: 'desc' } });
  res.json(tenants.map((t) => ({
    id: t.id, name: t.name, plan: t.plan, status: t.status,
    provisionedAt: t.provisionedAt, headcount: t.headcount,
    billingContactName: t.billingContactName, billingContactEmail: t.billingContactEmail,
    hasDatabase: Boolean(t.databaseUrl),
  })));
}));

router.get('/tenants/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const t = await adminPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });

  // Query the tenant's own database for live counts and admin users.
  let counts = { users: 0, leaveRequests: 0, travelRequests: 0, expenseClaims: 0, payrollRuns: 0 };
  let admins = [];

  if (t.databaseUrl) {
    const tenantClient = buildDirectClient(t.databaseUrl);
    try {
      const [userCount, leaveCount, travelCount, expenseCount, payrollCount] = await Promise.all([
        tenantClient.user.count(),
        tenantClient.leaveRequest.count(),
        tenantClient.travelRequest.count(),
        tenantClient.expenseClaim.count(),
        tenantClient.payrollRun.count(),
      ]);
      counts = { users: userCount, leaveRequests: leaveCount, travelRequests: travelCount, expenseClaims: expenseCount, payrollRuns: payrollCount };
      admins = await tenantClient.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true, firstName: true, lastName: true },
      });
    } finally {
      await tenantClient.$disconnect();
    }
  }

  res.json({
    id: t.id, name: t.name, plan: t.plan, status: t.status,
    provisionedAt: t.provisionedAt, headcount: t.headcount,
    billingContactName: t.billingContactName, billingContactEmail: t.billingContactEmail,
    hasDatabase: Boolean(t.databaseUrl),
    _count: counts,
    users: admins,
  });
}));

router.post('/tenants/:id/suspend', requireSuperAdmin, asyncHandler(async (req, res) => {
  const t = await adminPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  await adminPrisma.tenant.update({ where: { id: t.id }, data: { status: 'SUSPENDED' } });
  res.json({ ok: true });
}));

router.post('/tenants/:id/activate', requireSuperAdmin, asyncHandler(async (req, res) => {
  const t = await adminPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  await adminPrisma.tenant.update({ where: { id: t.id }, data: { status: 'ACTIVE' } });
  res.json({ ok: true });
}));

// Plan / billing changes (spec 9). Also allows updating databaseUrl for existing tenants.
router.patch('/tenants/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const t = await adminPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  const { plan, headcount, billingContactName, billingContactEmail, databaseUrl } = req.body || {};
  const data = {};
  if (plan !== undefined) {
    if (!PLANS.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    data.plan = plan;
  }
  if (headcount !== undefined) data.headcount = Number(headcount) || 0;
  if (billingContactName !== undefined) data.billingContactName = billingContactName || null;
  if (billingContactEmail !== undefined) data.billingContactEmail = billingContactEmail || null;
  if (databaseUrl !== undefined) data.databaseUrl = databaseUrl || null;
  await adminPrisma.tenant.update({ where: { id: t.id }, data });
  res.json({ ok: true });
}));

// ─── Neon API integration ────────────────────────────────────────────────────

// Auto-create a Neon project and return its connection string.
// Requires NEON_API_KEY env var (from console.neon.tech → Account → API keys).
router.post('/neon/create-project', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { projectName } = req.body || {};
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'NEON_API_KEY is not configured on the server' });

  const response = await fetch('https://console.neon.tech/api/v2/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: { name: projectName || `hr-tenant-${Date.now()}` }, org_id: process.env.NEON_ORG_ID || undefined }),
  });

  if (!response.ok) {
    const text = await response.text();
    return res.status(502).json({ error: `Neon API error: ${text}` });
  }

  const data = await response.json();
  const connectionUri = data.connection_uris?.[0]?.connection_uri;
  if (!connectionUri) return res.status(502).json({ error: 'Neon did not return a connection URI' });

  res.json({ projectId: data.project.id, projectName: data.project.name, databaseUrl: connectionUri });
}));

// Run migrations on an existing tenant's already-configured database.
router.post('/tenants/:id/migrate', requireSuperAdmin, asyncHandler(async (req, res) => {
  const t = await adminPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (!t.databaseUrl) return res.status(400).json({ error: 'No database URL configured for this tenant' });
  try {
    runTenantMigrations(t.databaseUrl);
    res.json({ ok: true });
  } catch (err) {
    return res.status(422).json({ error: `Migration failed: ${err.message}` });
  }
}));

// Set (or update) a tenant's database URL and run migrations against it.
// Used to onboard existing tenants onto their own isolated database.
router.post('/tenants/:id/set-database', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { databaseUrl } = req.body || {};
  if (!databaseUrl) return res.status(400).json({ error: 'databaseUrl is required' });
  const t = await adminPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  try {
    runTenantMigrations(databaseUrl);
  } catch (err) {
    return res.status(422).json({ error: `Migration failed: ${err.message}` });
  }
  await adminPrisma.tenant.update({ where: { id: t.id }, data: { databaseUrl } });
  res.json({ ok: true });
}));

export default router;

