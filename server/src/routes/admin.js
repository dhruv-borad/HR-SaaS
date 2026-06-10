// Super Admin Portal API (spec 5): internal-only, separate auth path.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminPrisma } from '../lib/db.js';
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

// Provisioning (spec 5.3): tenant + first admin user + welcome email.
router.post('/tenants', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { name, plan, adminEmail, adminFirstName, adminLastName, headcount, billingContactName, billingContactEmail } = req.body || {};
  if (!name || !plan || !adminEmail) return res.status(400).json({ error: 'name, plan and adminEmail are required' });
  if (!PLANS.includes(plan)) return res.status(400).json({ error: `plan must be one of ${PLANS.join(', ')}` });

  const email = String(adminEmail).toLowerCase();
  const existing = await adminPrisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

  const pw = tempPassword();
  const tenant = await adminPrisma.tenant.create({
    data: {
      name, plan, status: 'ACTIVE', headcount: Number(headcount) || 0,
      billingContactName: billingContactName || null, billingContactEmail: billingContactEmail || null,
      users: {
        create: {
          email, firstName: adminFirstName || 'Admin', lastName: adminLastName || name,
          role: 'ADMIN', passwordHash: await bcrypt.hash(pw, 10), mustChangePassword: true,
        },
      },
    },
    include: { users: true },
  });

  const t = templates.welcome(adminFirstName || 'there', email, pw);
  sendEmail({ to: email, ...t });

  res.status(201).json({
    tenantId: tenant.id, name: tenant.name, plan: tenant.plan, status: tenant.status,
    adminEmail: email,
    temporaryPassword: pw, // shown once in the portal in case email is not configured
  });
}));

router.get('/tenants', requireSuperAdmin, asyncHandler(async (req, res) => {
  const tenants = await adminPrisma.tenant.findMany({
    orderBy: { provisionedAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });
  res.json(tenants.map((t) => ({
    id: t.id, name: t.name, plan: t.plan, status: t.status,
    provisionedAt: t.provisionedAt, headcount: t.headcount, users: t._count.users,
    billingContactName: t.billingContactName, billingContactEmail: t.billingContactEmail,
  })));
}));

router.get('/tenants/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const t = await adminPrisma.tenant.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { users: true, leaveRequests: true, travelRequests: true, expenseClaims: true, payrollRuns: true } },
      users: { where: { role: 'ADMIN' }, select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  res.json(t);
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

// Plan changes are manual in V1 (spec 9).
router.patch('/tenants/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const t = await adminPrisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  const { plan, headcount, billingContactName, billingContactEmail } = req.body || {};
  const data = {};
  if (plan !== undefined) {
    if (!PLANS.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    data.plan = plan;
  }
  if (headcount !== undefined) data.headcount = Number(headcount) || 0;
  if (billingContactName !== undefined) data.billingContactName = billingContactName || null;
  if (billingContactEmail !== undefined) data.billingContactEmail = billingContactEmail || null;
  await adminPrisma.tenant.update({ where: { id: t.id }, data });
  res.json({ ok: true });
}));

export default router;
