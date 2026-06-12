import { Router } from 'express';
import { prisma, adminPrisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { sendEmail, templates } from '../lib/email.js';
import { renderPayslip } from '../lib/payslip.js';
import { asyncHandler, audit, num, businessDaysInMonth } from '../lib/util.js';

const router = Router();

// Month-end run (spec 7.5): base salary + approved expenses − unpaid-leave deductions.
router.post('/runs', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const { year, month } = req.body || {};
  const y = Number(year); const m = Number(month);
  if (!y || !m || m < 1 || m > 12) return res.status(400).json({ error: 'Valid year and month (1-12) required' });

  const existing = await prisma.payrollRun.findFirst({ where: { year: y, month: m } });
  if (existing) return res.status(409).json({ error: `A payroll run for ${m}/${y} already exists` });

  const employees = await prisma.user.findMany({ where: { active: true } });
  if (!employees.length) return res.status(400).json({ error: 'No active employees' });

  const run = await prisma.payrollRun.create({ data: { year: y, month: m, createdById: req.user.userId } });

  // Approved expenses not yet attached to any payroll run.
  const pendingExpenses = await prisma.expenseClaim.findMany({ where: { status: 'APPROVED', payrollItemId: null } });
  const expByUser = new Map();
  for (const e of pendingExpenses) {
    if (!expByUser.has(e.userId)) expByUser.set(e.userId, []);
    expByUser.get(e.userId).push(e);
  }

  // Approved unpaid leave overlapping the run month.
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  const unpaidLeave = await prisma.leaveRequest.findMany({
    where: { status: 'APPROVED', payrollDeduction: true, startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
  });
  const leaveByUser = new Map();
  for (const l of unpaidLeave) {
    const d = businessDaysInMonth(l.startDate, l.endDate, y, m);
    leaveByUser.set(l.userId, (leaveByUser.get(l.userId) || 0) + d);
  }

  const WORKING_DAYS = 22; // standard monthly divisor for daily rate

  for (const emp of employees) {
    const base = num(emp.salaryAnnual) / 12;
    const expenses = expByUser.get(emp.id) || [];
    const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0);
    const unpaidDays = leaveByUser.get(emp.id) || 0;
    const deduction = Math.round((base / WORKING_DAYS) * unpaidDays * 100) / 100;
    const net = Math.round((base + expenseTotal - deduction) * 100) / 100;

    const item = await prisma.payrollItem.create({
      data: { runId: run.id, userId: emp.id, baseSalary: base, expenseAdditions: expenseTotal, leaveDeductions: deduction, netPay: net },
    });
    if (expenses.length) {
      await prisma.expenseClaim.updateMany({ where: { id: { in: expenses.map((e) => e.id) } }, data: { payrollItemId: item.id } });
    }
  }

  await audit('PayrollRun', run.id, 'CREATED', req.user.userId, `${m}/${y}`);
  const full = await prisma.payrollRun.findFirst({ where: { id: run.id }, include: { items: { include: { user: { select: { firstName: true, lastName: true, email: true, department: true } } } } } });
  res.status(201).json(full);
}));

router.get('/runs', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const runs = await prisma.payrollRun.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], include: { _count: { select: { items: true } } } });
  res.json(runs);
}));

router.get('/runs/:id', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const run = await prisma.payrollRun.findFirst({
    where: { id: req.params.id },
    include: { items: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, department: true } } } } },
  });
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
}));

// One-click confirm (spec 7.5): finalise + notify employees their payslip is ready.
router.post('/runs/:id/finalise', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const run = await prisma.payrollRun.findFirst({ where: { id: req.params.id }, include: { items: { include: { user: true } } } });
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (run.status === 'FINALISED') return res.status(409).json({ error: 'Run already finalised' });

  await prisma.payrollRun.updateMany({ where: { id: run.id }, data: { status: 'FINALISED', finalisedAt: new Date() } });
  for (const item of run.items) {
    sendEmail({ to: item.user.email, ...templates.payslip(item.user.firstName, run.month, run.year) });
    if (num(item.expenseAdditions) > 0) {
      const tenantCfg = await adminPrisma.tenant.findUnique({ where: { id: req.user.tenantId } });
      sendEmail({ to: item.user.email, ...templates.expenseInPayroll(item.user.firstName, num(item.expenseAdditions).toFixed(2), tenantCfg.currency) });
    }
  }
  await audit('PayrollRun', run.id, 'FINALISED', req.user.userId);
  res.json({ ok: true });
}));

// Draft runs can be discarded; attached expenses return to the queue.
router.delete('/runs/:id', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const run = await prisma.payrollRun.findFirst({ where: { id: req.params.id } });
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (run.status === 'FINALISED') return res.status(409).json({ error: 'Finalised runs cannot be deleted' });
  await prisma.expenseClaim.updateMany({ where: { payrollItem: { runId: run.id } }, data: { payrollItemId: null } });
  await prisma.payrollRun.deleteMany({ where: { id: run.id } });
  await audit('PayrollRun', run.id, 'DELETED', req.user.userId);
  res.json({ ok: true });
}));

// Employee's own payslips, from finalised runs only (spec 7.5).
router.get('/my-payslips', requireAuth(), asyncHandler(async (req, res) => {
  const items = await prisma.payrollItem.findMany({
    where: { userId: req.user.userId, run: { status: 'FINALISED' } },
    include: { run: true },
    orderBy: { run: { createdAt: 'desc' } },
  });
  res.json(items);
}));

// Payslip PDF — owner or admin.
router.get('/items/:id/payslip', requireAuth(), asyncHandler(async (req, res) => {
  const item = await prisma.payrollItem.findFirst({
    where: { id: req.params.id },
    include: { run: true, user: true },
  });
  if (!item) return res.status(404).json({ error: 'Payslip not found' });
  if (req.user.role !== 'ADMIN' && item.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  if (item.run.status !== 'FINALISED' && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Run not finalised yet' });

  const tenantCfg = await adminPrisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="payslip-${item.run.year}-${String(item.run.month).padStart(2, '0')}.pdf"`);
  renderPayslip({ tenant: tenantCfg, user: ite