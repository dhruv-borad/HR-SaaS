// Server-side payslip PDF (spec 7.5) rendered with PDFKit, streamed to the
// client and optionally persisted to R2 on finalise.
import PDFDocument from 'pdfkit';
import { num } from './util.js';

export function renderPayslip({ tenant, user, run, item }, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(stream);

  doc.fontSize(18).text(tenant.name, { continued: false });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#555').text(`Payslip — ${String(run.month).padStart(2, '0')}/${run.year}`);
  doc.moveDown();
  doc.fillColor('#000').fontSize(11);
  doc.text(`Employee: ${user.firstName} ${user.lastName}`);
  doc.text(`Email: ${user.email}`);
  if (user.department) doc.text(`Department: ${user.department}`);
  doc.moveDown();

  const rows = [
    ['Base salary', num(item.baseSalary)],
    ['Approved expense reimbursements', num(item.expenseAdditions)],
    ['Unpaid leave deductions', -num(item.leaveDeductions)],
  ];
  const cur = tenant.currency || 'USD';
  const fmt = (v) => `${v < 0 ? '-' : ''}${cur} ${Math.abs(v).toFixed(2)}`;

  doc.fontSize(11);
  const startX = doc.x;
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.text(label, startX, y, { width: 300 });
    doc.text(fmt(value), startX + 320, y, { width: 150, align: 'right' });
    doc.moveDown(0.4);
  }
  doc.moveDown(0.3);
  doc.moveTo(startX, doc.y).lineTo(startX + 470, doc.y).stroke('#999');
  doc.moveDown(0.4);
  const y = doc.y;
  doc.font('Helvetica-Bold').text('Net pay', startX, y, { width: 300 });
  doc.text(fmt(num(item.netPay)), startX + 320, y, { width: 150, align: 'right' });
  doc.font('Helvetica');
  doc.moveDown(2);
  doc.fontSize(9).fillColor('#777')
    .text(`Run status: ${run.status} · Generated ${new Date().toISOString().slice(0, 10)} · V1 — payment handled offline (no bank integration).`);
  doc.end();
  return doc;
}
