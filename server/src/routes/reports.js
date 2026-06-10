import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, num } from '../lib/util.js';

const router = Router();

async function dashboardData() {
  const users = await prisma.user.findMany({ where: { active: true }, select: { department: true, role: true } });
  const headcount = {
    total: users.length,
    byDepartment: {}, byRole: {},
  };
  for (const u of users) {
    const d = u.department || 'Unassigned';
    headcount.byDepartment[d] = (headcount.byDepartment[d] || 0) + 1;
    headcount.byRole[u.role] = (headcount.byRole[u.role] || 0) + 1;
  }

  // Monthly cost trend, last 6 finalised/draft runs (spec 7.6).
  const runs = await prisma.payrollRun.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6,
    include: { items: { select: { baseSalary: true, expenseAdditions: true, leaveDeductions: true, netPay: true } } },
  });
  const costTrend = runs.reverse().map((r) => ({
    period: `${r.year}-${String(r.month).padStart(2, '0')}`,
    status: r.status,
    salary: r.items.reduce((s, i) => s + num(i.baseSalary), 0),
    expenses: r.items.reduce((s, i) => s + num(i.expenseAdditions), 0),
    total: r.items.reduce((s, i) => s + num(i.netPay), 0),
  }));

  // Travel savings: full price vs actual/estimated for approved trips.
  const trips = await prisma.travelRequest.findMany({ where: { status: 'APPROVED' } });
  let fullPriceTotal = 0; let spentTotal = 0;
  for (const t of trips) {
    if (t.fullPrice != null) {
      fullPriceTotal += num(t.fullPrice);
      spentTotal += num(t.actualSpend) > 0 ? num(t.actualSpend) : num(t.estimatedCost);
    }
  }
  const travelSavings = { approvedTrips: trips.length, fullPriceTotal, spentTotal, saved: Math.max(0, fullPriceTotal - spentTotal) };

  // Leave by department by month (last 6 months).
  const since = new Date(); since.setMonth(since.getMonth() - 6);
  const leave = await prisma.leaveRequest.findMany({
    where: { status: 'APPROVED', startDate: { gte: since } },
    include: { user: { select: { department: true } } },
  });
  const leavePatterns = {};
  for (const l of leave) {
    const period = l.startDate.toISOString().slice(0, 7);
    const dept = l.user.department || 'Unassigned';
    leavePatterns[period] = leavePatterns[period] || {};
    leavePatterns[period][dept] = (leavePatterns[period][dept] || 0) + num(l.days);
  }

  const pendingApprovals = {
    leave: await prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
    travel: await prisma.travelRequest.count({ where: { status: 'PENDING' } }),
    expenses: await prisma.expenseClaim.count({ where: { status: { in: ['PENDING', 'MANAGER_APPROVED'] } } }),
  };

  return { headcount, costTrend, travelSavings, leavePatterns, pendingApprovals };
}

router.get('/dashboard', requireAuth('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  res.json(await dashboardData());
}));

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

async function exportRows(type) {
  switch (type) {
    case 'headcount': {
      const users = await prisma.user.findMany({ include: { manager: true }, orderBy: { createdAt: 'asc' } });
      return users.map((u) => ({
        firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role,
        department: u.department || '', manager: u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : '',
        active: u.active, salaryMonthly: num(u.salaryMonthly),
      }));
    }
    case 'leave': {
      const rows = await prisma.leaveRequest.findMany({ include: { user: true, leaveType: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((r) => ({
        employee: `${r.user.firstName} ${r.user.lastName}`, type: r.leaveType.name,
        start: r.startDate.toISOString().slice(0, 10), end: r.endDate.toISOString().slice(0, 10),
        days: num(r.days), status: r.status,
      }));
    }
    case 'travel': {
      const rows = await prisma.travelRequest.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((r) => ({
        employee: `${r.user.firstName} ${r.user.lastName}`, destination: r.destination,
        start: r.startDate.toISOString().slice(0, 10), end: r.endDate.toISOString().slice(0, 10),
        estimatedCost: num(r.estimatedCost), fullPrice: r.fullPrice == null ? '' : num(r.fullPrice),
        actualSpend: num(r.actualSpend), status: r.status, policyCompliant: r.policyCompliant ?? '',
      }));
    }
    case 'expenses': {
      const rows = await prisma.expenseClaim.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((r) => ({
        employee: `${r.user.firstName} ${r.user.lastName}`, category: r.category,
        amount: num(r.amount), status: r.status, submitted: r.createdAt.toISOString().slice(0, 10),
      }));
    }
    case 'payroll': {
      const rows = await prisma.payrollItem.findMany({ include: { user: true, run: true }, orderBy: { run: { createdAt: 'desc' } } });
      return rows.map((r) => ({
        period: `${r.run.year}-${String(r.run.month).padStart(2, '0')}`, status: r.run.status,
        employee: `${r.user.firstName} ${r.user.lastName}`, baseSalary: num(r.baseSalary),
        expenses: num(r.expenseAdditions), deductions: num(r.leaveDeductions), netPay: num(r.netPay),
      }));
    }
    default:
      return null;
  }
}

// Any report exports to CSV (Excel-compatible) or PDF at any time (spec 7.6).
router.get('/export', requireAuth('ADMIN'), asyncHandler(async (req, res) => {
  const { type = 'headcount', format = 'csv' } = req.query;
  const rows = await exportRows(String(type));
  if (rows == null) return res.status(400).json({ error: 'Unknown report type' });

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    doc.pipe(res);
    doc.fontSize(16).text(`${String(type)[0].toUpperCase()}${String(type).slice(1)} report`, { underline: false });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#000');
    if (!rows.length) { doc.text('No data.'); doc.end(); return; }
    const cols = Object.keys(rows[0]);
    const colW = (doc.page.width - 80) / cols.length;
    let y = doc.y;
    doc.font('Helvetica-Bold');
    cols.forEach((c, i) => doc.text(c, 40 + i * colW, y, { width: colW - 4 }));
    doc.font('Helvetica');
    y += 16;
    for (const r of rows) {
      if (y > doc.page.height - 50) { doc.addPage(); y = 40; }
      cols.forEach((c, i) => doc.text(String(r[c] ?? ''), 40 + i * colW, y, { width: colW - 4 }));
      y += 14;
    }
    doc.end();
    return;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
  res.send(toCsv(rows));
}));

export default router;
