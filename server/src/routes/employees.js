import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { sendEmail, templates } from '../lib/email.js';
import { asyncHandler, tempPassword, audit } from '../lib/util.js';

const router = Router();

const view = (u) => ({
  id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
  role: u.role, department: u.department, salaryMonthly: u.salaryMonthly,
  travelMaxCostPerTrip: u.travelMaxCostPerTrip,
  travelAllowedDestinations: u.travelAllowedDestinations,
  managerId: u.managerId, active: u.active, createdAt: u.createdAt,
  manager: u.manager ? { id: u.manager.id, firstName: u.manager.firstName, lastName: u.manager.lastName } : null,
});

// Admin: everyone. Manager: self + direct reports. Employee: self. (spec 6.2)
router.get('/', requireAuth(), asyncHandler(async (req, res) => {
  const { role, userId } = req.user;
  const where = role === 'ADMIN' ? {} : role === 'MANAGER' ? { OR: [{ id: userId }, { managerId: userId }] } : { id: userId };
  const users = await prisma.user.findMany({ where, include: { manager: true }, orderBy: { createdAt: 'asc' } });
  res.json(users.map(view));
}));

router.get('/orgchart', requireAuth(), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } });
  res.json(users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role, department: u.department, managerId: u.managerId })));
}));

router.post('/', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const { email, firstName, lastName, role = 'EMPLOYEE', department, salaryMonthly = 0, managerId, travelMaxCostPerTrip, travelAllowedDestinations } = req.body || {};
  if (!email || !firstName || !lastName) return res.status(400).json({ error: 'email, firstName, lastName are required' });
  if (!['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (managerId) {
    const mgr = await prisma.user.findFirst({ where: { id: managerId } });
    if (!mgr) return res.status(400).json({ error: 'Manager not found' });
  }

  const pw = tempPassword();
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(), firstName, lastName, role, department: department || null,
        salaryMonthly, managerId: managerId || null,
        travelMaxCostPerTrip: travelMaxCostPerTrip != null && travelMaxCostPerTrip !== '' ? travelMaxCostPerTrip : null,
        travelAllowedDestinations: Array.isArray(travelAllowedDestinations)
          ? travelAllowedDestinations.map((s) => String(s).trim()).filter(Boolean)
          : [],
        passwordHash: await bcrypt.hash(pw, 10), mustChangePassword: true,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A user with this email already exists' });
    throw err;
  }

  // Seed a balance row for each leave type the tenant has configured (spec 7.2).
  const types = await prisma.leaveType.findMany();
  if (types.length) {
    await prisma.leaveBalance.createMany({
      data: types.map((t) => ({ userId: user.id, leaveTypeId: t.id, balance: t.daysPerYear })),
    });
  }

  const t = templates.welcome(firstName, user.email, pw);
  sendEmail({ to: user.email, ...t });
  await audit('User', user.id, 'CREATED', req.user.userId);
  res.status(201).json({ ...view({ ...user, manager: null }), temporaryPassword: pw });
}));

router.patch('/:id', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await prisma.user.findFirst({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });

  const { firstName, lastName, role, department, salaryMonthly, managerId, travelMaxCostPerTrip, travelAllowedDestinations } = req.body || {};
  if (role && !['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (managerId) {
    if (managerId === existing.id) return res.status(400).json({ error: 'Employee cannot manage themselves' });
    const mgr = await prisma.user.findFirst({ where: { id: managerId } });
    if (!mgr) return res.status(400).json({ error: 'Manager not found' });
  }

  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (role !== undefined) data.role = role;
  if (department !== undefined) data.department = department || null;
  if (salaryMonthly !== undefined) data.salaryMonthly = salaryMonthly; // feeds next payroll run (spec 7.1)
  if (managerId !== undefined) data.managerId = managerId || null;
  if (travelMaxCostPerTrip !== undefined) data.travelMaxCostPerTrip = travelMaxCostPerTrip === null || travelMaxCostPerTrip === '' ? null : travelMaxCostPerTrip;
  if (travelAllowedDestinations !== undefined) {
    data.travelAllowedDestinations = Array.isArray(travelAllowedDestinations)
      ? travelAllowedDestinations.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }

  await prisma.user.updateMany({ where: { id: existing.id }, data });
  if (salaryMonthly !== undefined && String(salaryMonthly) !== String(existing.salaryMonthly)) {
    await audit('User', existing.id, 'SALARY_CHANGED', req.user.userId, `from ${existing.salaryMonthly} to ${salaryMonthly}`);
  }
  const updated = await prisma.user.findFirst({ where: { id: existing.id }, include: { manager: true } });
  res.json(view(updated));
}));

// Deactivation locks login and excludes from payroll (spec 7.1).
router.post('/:id/deactivate', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await prisma.user.findFirst({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  if (existing.id === req.user.userId) return res.status(400).json({ error: 'You cannot deactivate yourself' });
  await prisma.user.updateMany({ where: { id: existing.id }, data: { active: false } });
  await audit('User', existing.id, 'DEACTIVATED', req.user.userId);
  res.json({ ok: true });
}));

router.post('/:id/activate', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await prisma.user.findFirst({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  await prisma.user.updateMany({ where: { id: existing.id }, data: { active: true } });
  await audit('User', existing.id, 'ACTIVATED', req.user.userId);
  res.json({ ok: true });
}));

export default router;
