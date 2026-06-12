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
  const passwordHash = await bcrypt.hash(pw, 10);
  const tenantClient = buildDirectClient(databaseUrl);
  let newUser;
  try {
    newUser = await tenantClient.user.create({
      data: {
        tenantId: tenant.id,
        email,
        firstName: adminFirstName || 'Admin',
        lastName: adminLastName || name,
        role: 'ADMIN',
        passwordHash,
        mustChangePassword: true,
      },
    });
  } finally {
    await tenantClient.$disconnect();
  }

  // 4. Add to UserIndex in admin DB so login works without scanning all tenant DBs.
  await adminPrisma.userIndex.create({
    data: { id: newUser.id, tenantId: tenant.id, email, passwordHash, role: 'ADMIN', active: true },
  });

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
   