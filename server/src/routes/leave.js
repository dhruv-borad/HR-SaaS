import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { sendEmail, templates } from '../lib/email.js';
import { asyncHandler, businessDays, audit } from '../lib/util.js';

const router = Router();

const include = {
  leaveType: true,
  user: { select: { id: true, firstName: true, lastName: true, managerId: true, email: true } },
};

function scopeFor(req) {
  const { role, userId } = req.user;
  if (role === 'ADMIN') return {};
  if (role === 'MANAGER') return { OR: [{ userId }, { user: { managerId: userId } }] };
  return { userId };
}

router.get('/balances', requireAuth(), asyncHandler(async (req, res) => {
  const balances = await prisma.leaveBalance.findMany({ where: { userId: req.user.userId }, include: { leaveType: true } });
  res.json(balances.map((b) => ({ id: b.id, leaveTypeId: b.leaveTypeId, name: b.leaveType.name, paid: b.leaveType.paid, balance: b.balance })));
}));

router.get('/', requireAuth(), asyncHandler(async (req, res) => {
  const requests = await prisma.leaveRequest.findMany({ where: scopeFor(req), include, orderBy: { createdAt: 'desc' } });
  res.json(requests);
}));

router.post('/', requireAuth(), asyncHandler(async (req, res) => {
  const { leaveTypeId, startDate, endDate, notes } = req.body || {};
  if (!leaveTypeId || !startDate || !endDate) return res.status(400).json({ error: 'leaveTypeId, startDate, endDate are required' });
  const start = new Date(startDate); const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) return res.status(400).json({ error: 'Invalid date range' });

  const type = await prisma.leaveType.findFirst({ where: { id: leaveTypeId } });
  if (!type) return res.status(400).json({ error: 'Leave type not found. Ask your admin to configure leave types in Settings.' });

  const days = businessDays(start, end);
  if (days <= 0) return res.status(400).json({ error: 'Range contains no business days' });

  const balance = await prisma.leaveBalance.findFirst({ where: { userId: req.user.userId, leaveTypeId } });
  if (type.paid && (!balance || Number(balance.balance) < days)) {
    return res.status(400).json({ error: `Insufficient balance: ${balance ? balance.balance : 0} day(s) available, ${days} requested` });
  }

  const request = await prisma.leaveRequest.create({
    data: { tenantId: req.user.tenantId, userId: req.user.userId, leaveTypeId, startDate: start, endDate: end, days, notes: notes || null },
  });

  const me = await prisma.user.findFirst({ where: { id: req.user.userId }, include: { manager: true } });
  if (me?.manager) {
    const t = templates.actionRequired(me.manager.firstName, `${me.firstName} ${me.lastName}`, 'leave');
    sendEmail({ to: me.manager.email, ...t });
  }
  sendEmail({ to: me.email, ...templates.submitted(me.firstName, 'leave') });
  await audit('LeaveRequest', request.id, 'SUBMITTED', req.user.userId, req.user.tenantId);
  res.status(201).json(request);
}));

async function loadForDecision(req, res) {
  const request = await prisma.leaveRequest.findFirst({ where: { id: req.params.id }, include });
  if (!request) { res.status(404).json({ error: 'Request not found' }); return null; }
  if (request.status !== 'PENDING') { res.status(409).json({ error: 'Request already decided' }); return null; }
  const { role, userId } = req.user;
  const isManagerOf = request.user.managerId === userId;
  if (role !== 'ADMIN' && !isManagerOf) { res.status(403).json({ error: 'Only the employee\'s manager or an admin can decide this request' }); return null; }
  if (request.userId === userId) { res.status(403).json({ error: 'You cannot approve your own request' }); return null; }
  return request;
}

// Approval updates per spec 8.2: balance reduced, payroll flag set for unpaid leave.
router.post('/:id/approve', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const request = await loadForDecision(req, res);
  if (!request) return;
  const unpaid = !request.leaveType.paid;

  await prisma.leaveRequest.updateMany({
    where: { id: request.id, status: 'PENDING' },
    data: { status: 'APPROVED', decidedById: req.user.userId, decidedAt: new Date(), payrollDeduction: unpaid, decisionNote: req.body?.note || null },
  });
  if (!unpaid) {
    await prisma.leaveBalance.updateMany({
      where: { userId: request.userId, leaveTypeId: request.leaveTypeId },
      data: { balance: { decrement: request.days } },
    });
  }
  sendEmail({ to: request.user.email, ...templates.decision(request.user.firstName, 'leave', true) });
  await audit('LeaveRequest', request.id, 'APPROVED', req.user.userId, req.user.tenantId);
  res.json({ ok: true });
}));

router.post('/:id/reject', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const request = await loadForDecision(req, res);
  if (!request) return;
  await prisma.leaveRequest.updateMany({
    where: { id: request.id, status: 'PENDING' },
    data: { status: 'REJECTED', decidedById: req.user.userId, decidedAt: new Date(), decisionNote: req.body?.note || null },
  });
  sendEmail({ to: request.user.email, ...templates.decision(request.user.firstName, 'leave', false, req.body?.note) });
  await audit('LeaveRequest', request.id, 'REJECTED', req.user.userId, req.user.tenantId);
  res.json({ ok: true });
}));

export default router;
