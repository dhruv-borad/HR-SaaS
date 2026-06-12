import crypto from 'node:crypto';
import { prisma } from './db.js';

export function tempPassword() {
  return crypto.randomBytes(9).toString('base64url'); // 12 chars, shown once + emailed
}

// Inclusive business days (Mon–Fri) between two dates.
export function businessDays(start, end) {
  let count = 0;
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (d <= stop) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Business days of [start,end] that fall inside a given year/month (1-12).
export function businessDaysInMonth(start, end, year, month) {
  const mStart = new Date(Date.UTC(year, month - 1, 1));
  const mEnd = new Date(Date.UTC(year, month, 0));
  const s = start > mStart ? start : mStart;
  const e = end < mEnd ? end : mEnd;
  if (s > e) return 0;
  return businessDays(s, e);
}

export async function audit(entityType, entityId, action, actorId, detail, tenantId) {
  try {
    await prisma.auditLog.create({ data: { tenantId: tenantId ?? 'system', entityType, entityId, action, actorId, detail: detail ?? null } });
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

export const num = (d) => (d == null ? 0 : Number(d));

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
