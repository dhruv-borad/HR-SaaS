import jwt from 'jsonwebtoken';
import { tenantContext } from './db.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

export function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.REFRESH_SECRET);
}

export function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'none',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie('refresh_token', { path: '/api/auth' });
}

// Customer-portal auth: Bearer access token -> req.user {userId, tenantId, role};
// also opens the tenant context so every Prisma query is scoped (spec 4.2).
export function requireAuth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (payload.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'Wrong auth path' });
    if (roles.length && !roles.includes(payload.role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    req.user = payload; // { userId, tenantId, role }
    tenantContext.run({ tenantId: payload.tenantId }, next);
  };
}

// Super-admin auth (spec 4.2 / 5.2): separate path — either the env-cred JWT
// from /admin/login, or the ADMIN_SECRET header for programmatic use.
export function requireSuperAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (secret && process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role === 'SUPER_ADMIN') { req.user = payload; return next(); }
    } catch { /* fall through */ }
  }
  return res.status(401).json({ error: 'Super admin authentication required' });
}
