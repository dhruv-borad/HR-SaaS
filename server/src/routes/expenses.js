import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma, adminPrisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { sendEmail, templates } from '../lib/email.js';
import { signedUploadUrl, signedDownloadUrl, r2Configured } from '../lib/r2.js';
import { asyncHandler, audit, num } from '../lib/util.js';

const router = Router();

const include = { user: { select: { id: true, firstName: true, lastName: true, managerId: true, email: true } } };

function scopeFor(req) {
  const { role, userId } = req.user;
  if (role === 'ADMIN') return {};
  if (role === 'MANAGER') return { OR: [{ userId }, { user: { managerId: userId } }] };
  return { userId };
}

router.get('/', requireAuth(), asyncHandler(async (req, res) => {
  const claims = await prisma.expenseClaim.findMany({ where: scopeFor(req), include, orderBy: { createdAt: 'desc' } });
  res.json(claims);
}));

// Receipt upload: client asks for a presigned PUT URL, uploads directly to R2,
// then submits the claim with the returned key (spec 7.4).
router.post('/upload-url', requireAuth(), asyncHandler(async (req, res) => {
  if (!r2Configured()) return res.status(503).json({ error: 'File storage is not configured. You can still submit the claim without a receipt.' });
  const { fileName, contentType } = req.body || {};
  if (!fileName || !contentType) return res.status(400).json({ error: 'fileName and contentType required' });
  const expenseId = crypto.randomUUID();
  const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `tenants/${req.user.tenantId}/expenses/${expenseId}/${safe}`;
  const url = await signedUploadUrl(key, contentType);
  res.json({ url, key });
}));

router.get('/:id/receipt-url', requireAuth(), asyncHandler(async (req, res) => {
  const claim = await prisma.expenseClaim.findFirst({ where: { id: req.params.id }, include });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  const { role, userId } = req.user;
  if (role === 'EMPLOYEE' && claim.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
  if (role === 'MANAGER' && claim.userId !== userId && claim.user.managerId !== userId) return res.status(403).json({ error: 'Forbidden' });
  if (!claim.receiptKey) return res.status(404).json({ error: 'No receipt attached' });
  res.json({ url: await signedDownloadUrl(claim.receiptKey) });
}));

router.post('/', requireAuth(), asyncHandler(async (req, res) => {
  const { amount, category, description, receiptKey, travelRequestId } = req.body || {};
  if (amount == null || Number(amount) <= 0 || !category) return res.status(400).json({ error: 'Positive amount and category are required' });
  if (travelRequestId) {
    const trip = await prisma.travelRequest.findFirst({ where: { id: travelRequestId, userId: req.user.userId } });
    if (!trip) return res.status(400).json({ error: 'Travel request not found' });
  }

  const claim = await prisma.expenseClaim.create({
    data: { tenantId: req.user.tenantId, userId: req.user.userId, amount, category, description: description || null, receiptKey: receiptKey || null, travelRequestId: travelRequestId || null },
  });

  // Spend tracking against the trip (spec 7.3).
  if (travelRequestId) {
    await prisma.travelRequest.updateMany({ where: { id: travelRequestId }, data: { actualSpend: { increment: amount } } });
  }

  const me = await prisma.user.findFirst({ where: { id: req.user.userId }, include: { manager: true } });
  if (me?.manager) sendEmail({ to: me.manager.email, ...templates.actionRequired(me.manager.firstName, `${me.firstName} ${me.lastName}`, 'expense') });
  sendEmail({ to: me.email, ...templates.submitted(me.firstName, 'expense') });
  await audit('ExpenseClaim', claim.id, 'SUBMITTED', req.user.userId, `amount=${amount}`, req.user.tenantId);
  res.status(201).json(claim);
}));

// Stage 1 — manager approval. Larger amounts go to finance (admin) for a
// second approval; the threshold is per-tenant (spec 7.4).
router.post('/:id/approve', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const claim = await prisma.expenseClaim.findFirst({ where: { id: req.params.id }, include });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.status !== 'PENDING') return res.status(409).json({ error: 'Claim already decided at this stage' });
  const { role, userId } = req.user;
  if (role !== 'ADMIN' && claim.user.managerId !== userId) return res.status(403).json({ error: 'Only the employee\'s manager or an admin can decide this claim' });
  if (claim.userId === userId) return res.status(403).json({ error: 'You cannot approve your own claim' });

  const tenantCfg = await adminPrisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  const needsFinance = num(claim.amount) >= num(tenantCfg.expenseFinanceThreshold);
  const nextStatus = needsFinance ? 'MANAGER_APPROVED' : 'APPROVED';

  await prisma.expenseClaim.updateMany({
    where: { id: claim.id, status: 'PENDING' },
    data: { status: nextStatus, managerDecidedById: userId, managerDecidedAt: new Date(), decisionNote: req.body?.note || null },
  });
  await audit('ExpenseClaim', claim.id, needsFinance ? 'MANAGER_APPROVED' : 'APPROVED', userId);
  if (!needsFinance) sendEmail({ to: claim.user.email, ...templates.decision(claim.user.firstName, 'expense', true) });
  res.json({ ok: true, status: nextStatus });
}));

// Stage 2 — finance (admin) approval for amounts at/above the threshold.
router.post('/:id/finance-approve', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const claim = await prisma.expenseClaim.findFirst({ where: { id: req.params.id }, include });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.status !== 'MANAGER_APPROVED') return res.status(409).json({ error: 'Claim is not awaiting finance approval' });
  if (claim.userId === req.user.userId) return res.status(403).json({ error: 'You cannot approve your own claim' });

  await prisma.expenseClaim.updateMany({
    where: { id: claim.id, status: 'MANAGER_APPROVED' },
    data: { status: 'APPROVED', financeDecidedById: req.user.userId, financeDecidedAt: new Date() },
  });
  await audit('ExpenseClaim', claim.id, 'FINANCE_APPROVED', req.user.userId, req.user.tenantId);
  sendEmail({ to: claim.user.email, ...templates.decision(claim.user.firstName, 'expense', true) });
  res.json({ ok: true });
}));

router.post('/:id/reject', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const claim = await prisma.expenseClaim.findFirst({ where: { id: req.params.id }, include });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (!['PENDING', 'MANAGER_APPROVED'].includes(claim.status)) return res.status(409).json({ error: 'Claim already decided' });
  const { role, userId } = req.user;
  if (claim.status === 'PENDING' && role !== 'ADMIN' && claim.user.managerId !== userId) return res.status(403).json({ error: 'Forbidden' });
  if (claim.status === 'MANAGER_APPROVED' && role !== 'ADMIN') return res.status(403).json({ error: 'Only finance (admin) can reject at this stage' });

  await prisma.expenseClaim.updateMany({
    where: { id: claim.id }, data: { status: 'REJECTED', decisionNote: req.body?.note || null, financeDecidedById: role === 'ADMIN' ? userId : undefined, managerDecidedById: claim.managerDecidedById ?? userId, managerDecidedAt: claim.managerDecidedAt ?? new Date() },
  });
  await audit('ExpenseClaim', claim.id, 'REJECTED', userId, req.body?.note);
  sendEmail({ to: claim.user.email, ...templates.decision(claim.user.firstName, 'expense', false, req.body?.note) });
  res.json({ ok: true });
}));

router.get('/:id/audit', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const claim = await prisma.expenseClaim.findFirst({ where: { id: req.params.id } });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  const logs = await prisma.auditLog.findMany({ where: { entityType: 'ExpenseClaim', entityId: claim.id }, orderBy: { createdAt: 'asc' } });
  res.