import { Router } from 'express';
import { prisma, adminPrisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { sendEmail, templates } from '../lib/email.js';
import { asyncHandler, audit, num } from '../lib/util.js';
import { searchFlights } from '../lib/serpapi.js';
import { searchLocations } from '../lib/airports.js';

const router = Router();

const include = { user: { select: { id: true, firstName: true, lastName: true, managerId: true, email: true } } };

function scopeFor(req) {
  const { role, userId } = req.user;
  if (role === 'ADMIN') return {};
  if (role === 'MANAGER') return { OR: [{ userId }, { user: { managerId: userId } }] };
  return { userId };
}

// Airport/city autocomplete — served from local static list, no external API call.
router.get('/airports', requireAuth(), asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) return res.json([]);
  res.json(searchLocations(String(q).trim()));
}));

// Live flight search via SerpApi (Google Flights).
router.get('/search', requireAuth(), asyncHandler(async (req, res) => {
  const { origin, destination, departureDate, returnDate, adults = '1' } = req.query;
  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ error: 'origin, destination, departureDate are required' });
  }

  // Fetch the tenant currency so prices show in the right currency.
  const tenantCfg = await adminPrisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  const currency = tenantCfg?.currency || 'USD';

  const flights = await searchFlights({
    origin: String(origin).toUpperCase(),
    destination: String(destination).toUpperCase(),
    departureDate: String(departureDate),
    returnDate: returnDate ? String(returnDate) : undefined,
    adults: parseInt(adults, 10) || 1,
    currency,
  });

  // Also pass back the employee's travel budget so the UI can highlight over-budget flights.
  const me = await prisma.user.findFirst({ where: { id: req.user.userId } });
  const budget = me?.travelMaxCostPerTrip != null ? parseFloat(me.travelMaxCostPerTrip) : null;

  res.json({ flights, budget, currency });
}));

router.get('/', requireAuth(), asyncHandler(async (req, res) => {
  const requests = await prisma.travelRequest.findMany({ where: scopeFor(req), include, orderBy: { createdAt: 'desc' } });
  res.json(requests);
}));

// Submission runs the tenant travel-policy check (spec 7.3).
router.post('/', requireAuth(), asyncHandler(async (req, res) => {
  const { origin = '', destination, startDate, endDate, purpose, estimatedCost, fullPrice, tripType = 'ONE_WAY', flightData } = req.body || {};
  if (!destination || !startDate || !endDate || !purpose || estimatedCost == null) {
    return res.status(400).json({ error: 'destination, startDate, endDate, purpose, estimatedCost are required' });
  }
  const start = new Date(startDate); const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) return res.status(400).json({ error: 'Invalid date range' });

  const [me, tenantCfg] = await Promise.all([
    prisma.user.findFirst({ where: { id: req.user.userId }, include: { manager: true } }),
    adminPrisma.tenant.findUnique({ where: { id: req.user.tenantId } }),
  ]);
  const issues = [];
  if (me.travelMaxCostPerTrip != null && Number(estimatedCost) > num(me.travelMaxCostPerTrip)) {
    issues.push(`Estimated cost exceeds your travel policy maximum of ${tenantCfg.currency} ${me.travelMaxCostPerTrip}`);
  }
  if (me.travelAllowedDestinations.length > 0 &&
      !me.travelAllowedDestinations.some((d) => d.toLowerCase() === String(destination).toLowerCase())) {
    issues.push(`Destination "${destination}" is not on your allowed destinations list`);
  }

  const request = await prisma.travelRequest.create({
    data: {
      tenantId: req.user.tenantId,
      userId: req.user.userId, origin, destination, tripType, startDate: start, endDate: end, purpose,
      estimatedCost, fullPrice: fullPrice ?? null,
      flightData: flightData ?? undefined,
      policyCompliant: issues.length === 0, policyNotes: issues.join('; ') || null,
    },
  });

  if (me.manager) sendEmail({ to: me.manager.email, ...templates.actionRequired(me.manager.firstName, `${me.firstName} ${me.lastName}`, 'travel') });
  sendEmail({ to: me.email, ...templates.submitted(me.firstName, 'travel') });
  await audit('TravelRequest', request.id, 'SUBMITTED', req.user.userId, req.user.tenantId);
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
  await audit('TravelRequest', request.id, 'APPROVED', req.user.userId, `policyCompliant=${request.policyCompliant}`, req.user.tenantId);
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
  await audit('TravelRequest', request.id, 'REJECTED', req.user.userId, null, req.user.tenantId);
  res.json({ ok: true });
}));

export default router;
