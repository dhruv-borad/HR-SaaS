import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { sendEmail, templates } from '../lib/email.js';
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
  const requests = await prisma.travelRequest.findMany({ where: scopeFor(req), include, orderBy: { createdAt: 'desc' } });
  res.json(requests);
}));

// Submission runs the tenant travel-policy check (spec 7.3).
router.post('/', requireAuth(), asyncHandler(async (req, res) => {
  const { destination, startDate, endDate, purpose, estimatedCost, fullPrice } = req.body || {};
  if (!destination || !startDate || !endDate || !purpose || estimatedCost == null) {
    return res.status(400).json({ error: 'destination, startDate, endDate, purpose, estimatedCost are required' });
  }
  const start = new Date(startDate); const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) return res.status(400).json({ error: 'Invalid date range' });

  const me = await prisma.user.findFirst({ where: { id: req.user.userId }, include: { manager: true, tenant: true } });
  const tenant = me.tenant;
  const issues = [];
  if (tenant.travelMaxCostPerTrip != null && Number(estimatedCost) > num(tenant.travelMaxCostPerTrip)) {
    issues.push(`Estimated cost exceeds policy maximum of ${tenant.currency} ${tenant.travelMaxCostPerTrip}`);
  }
  if (tenant.travelAllowedDestinations.length > 0 &&
      !tenant.travelAllowedDestinations.some((d) => d.toLowerCase() === String(destination).toLowerCase())) {
    issues.push(`Destination "${destination}" is not on the allowed list`);
  }

  const request = await prisma.travelRequest.create({
    data: {
      userId: req.user.userId, destination, startDate: start, endDate: end, purpose,
      estimatedCost, fullPrice: fullPrice ?? null,
      policyCompliant: issues.length === 0, policyNotes: issues.join('; ') || null,
    },
  });

  if (me.manager) sendEmail({ to: me.manager.email, ...templates.actionRequired(me.manager.firstName, `${me.firstName} ${me.lastName}`, 'travel') });
  sendEmail({ to: me.email, ...templates.submitted(me.firstName, 'travel') });
  await audit('TravelRequest', request.id, 'SUBMITTED', req.user.userId);
  res.status(201).json(request);
}));

async function loadForDecision(req, res) {
  const request = await prisma.travelRequest.findFirst({ where: { id: req.params.id }, include });
  if (!request) { res.status(404).json({ error: 'Request not found' }); return null; }
  if (request.status !== 'PENDING') { res.status(409).json({ error: 'Request already decided' }); return null; }
  const { role, userId } = req.user;
  if (role !== 'ADMIN' && request.user.managerId !== userId) { res.status(403).json({ error: 'Only the employee\'s manager or an admin can decide this request' }); return null; }
  if (request.userId === userId) { res.status(403).json({ error: 'You cannot approve your own request' }); return null; }
  return request;
}

// Approval: trip confirmed, spend tracking activated, policy compliance logged (spec 8.2).
router.post('/:id/approve', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const request = await loadForDecision(req, res);
  if (!request) return;
  await prisma.travelRequest.updateMany({
    where: { id: request.id, status: 'PENDING' },
    data: { status: 'APPROVED', decidedById: req.user.userId, decidedAt: new Date(), decisionNote: req.body?.note || null },
  });
  sendEmail({ to: request.user.email, ...templates.decision(request.user.firstName, 'travel', true) });
  await audit('TravelRequest', request.id, 'APPROVED', req.user.userId, `policyCompliant=${request.policyCompliant}`);
  res.json({ ok: true });
}));

router.post('/:id/reject', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const request = await loadForDecision(req, res);
  if (!request) return;
  await prisma.travelRequest.updateMany({
    where: { id: request.id, status: 'PENDING' },
    data: { status: 'REJECTED', decidedById: req.user.userId, decidedAt: new Date(), decisionNote: req.body?.note || null },
  });
  sendEmail({ to: request.user.email, ...templates.decision(request.user.firstName, 'travel', false, req.body?.note) });
  await audit('TravelRequest', request.id, 'REJECTED', req.user.userId);
  res.json({ ok: true });
}));

// Booking is manual in V1 (spec 7.3) — this records the offline confirmation.
router.post('/:id/confirm-booking', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const request = await prisma.travelRequest.findFirst({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'APPROVED') return res.status(409).json({ error: 'Trip must be approved first' });
  await prisma.travelRequest.updateMany({ where: { id: request.id }, data: { bookingConfirmed: true } });
  await audit('TravelRequest', request.id, 'BOOKING_CONFIRMED', req.user.userId);
  res.json({ ok: true });
}));

// Record actual spend / full-price comparison for the savings report (spec 7.3/7.6).
router.patch('/:id/spend', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const request = await prisma.travelRequest.findFirst({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  const { actualSpend, fullPrice } = req.body || {};
  const data = {};
  if (actualSpend !== undefined) data.actualSpend = actualSpend;
  if (fullPrice !== undefined) data.fullPrice = fullPrice;
  await prisma.travelRequest.updateMany({ where: { id: request.id }, data });
  await audit('TravelRequest', request.id, 'SPEND_UPDATED', req.user.userId);
  res.json({ ok: true });
}));

export default router;
