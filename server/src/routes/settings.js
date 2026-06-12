import { Router } from 'express';
import { prisma, adminPrisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, audit } from '../lib/util.js';

const router = Router();

router.get('/', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const tenant = await adminPrisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  res.json({
    name: tenant.name, plan: tenant.plan, currency: tenant.currency,
    expenseFinanceThreshold: tenant.expenseFinanceThreshold,
  });
}));

router.put('/', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const { currency, expenseFinanceThreshold } = req.body || {};
  const data = {};
  if (currency !== undefined) data.currency = String(currency).toUpperCase().slice(0, 3);
  if (expenseFinanceThreshold !== undefined) data.expenseFinanceThreshold = expenseFinanceThreshold;
  await adminPrisma.tenant.update({ where: { id: req.user.tenantId }, data });
  await audit('Tenant', req.user.tenantId, 'SETTINGS_UPDATED', req.user.userId);
  res.json({ ok: true });
}));

// Leave types configured per tenant by admin (spec 7.2).
router.get('/leave-types', requireAuth(), asyncHandler(async (req, res) => {
  res.json(await prisma.leaveType.findMany({ orderBy: { name: 'asc' } }));
}));

router.post('/leave-types', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const { name, daysPerYear = 0, paid = true } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  let type;
  try {
    type = await prisma.leaveType.create({ data: { name, daysPerYear, paid: Boolean(paid) } });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A leave type with this name already exists' });
    throw err;
  }
  // Seed balances for all existing users.
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length) {
    await prisma.leaveBalance.createMany({ data: users.map((u) => ({ userId: u.id, leaveTypeId: type.id, balance: daysPerYear })) });
  }
  await audit('LeaveType', type.id, 'CREATED', req.user.userId, name);
  res.status(201).json(type);
}));

router.patch('/leave-types/:id', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const type = await prisma.leaveType.findFirst({ where: { id: req.params.id } });
  if (!type) return res.status(404).json({ error: 'Leave type not found' });
  const { name, daysPerYear, paid } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (daysPerYear !== undefined) data.daysPerYear = daysPerYear;
  if (paid !== undefined) data.paid = Boolean(paid);
  await prisma.leaveType.updateMany({ where: { id: type.id }, data });
  res.json({ ok: true });
}));

router.delete('/leave-types/:id', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const type = await prisma.leaveType.findFirst({ where: { id: req.params.id } });
  if (!type) return res.status(404).json({ error: 'Leave type not found' });
  const used = await prisma.leaveRequest.count({ where: { leaveTypeId: type.id } });
  if (used) return res.status(409).json({ error: 'Leave type has requests and cannot be deleted' });
  await prisma.leaveBalance.deleteMany({ where: { leaveTypeId: type.id } });
  await prisma.leaveType.deleteMany({ where: { id: type.id } });
  res.json({ ok: true });
}));

// Approval workflows (spec 4.1): single-level in V1, role per request type.
router.get('/workflows', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  res.json(await prisma.approvalWorkflow.findMany({ orderBy: { requestType: 'asc' } }));
}));

router.put('/workflows', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const { workflows } = req.body || {};
  if (!Array.isArray(workflows)) return res.status(400).json({ error: 'workflows array required' });
  for (const w of workflows) {
    if (!['leave', 'travel', 'expense'].includes(w.requestType)) continue;
    if (!['ADMIN', 'MANAGER'].includes(w.approverRole)) continue;
    await prisma.approvalWorkflow.upsert({
      where: { tenantId_requestType: { tenantId: req.user.tenantId, requestType: w.requestType } },
      create: { tenantId: req.user.tenantId, requestType: w.requestType, approverRole: w.approverRole },
      update: { approverRole: w.approverRole },
    });
  }
  res.json({ ok: true });
}));

export default router;
