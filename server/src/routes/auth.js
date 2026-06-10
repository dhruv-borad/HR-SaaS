import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { adminPrisma, prisma, runWithTenant } from '../lib/db.js';
import {
  signAccessToken, signRefreshToken, verifyRefreshToken,
  setRefreshCookie, clearRefreshCookie, requireAuth,
} from '../lib/auth.js';
import { asyncHandler } from '../lib/util.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
  role: u.role, department: u.department, mustChangePassword: u.mustChangePassword,
  tenantId: u.tenantId,
});

// Login is the one pre-tenant query: we don't know the tenant until the user
// is found, so it uses the unscoped client, then everything else is scoped.
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await adminPrisma.user.findUnique({ where: { email: String(email).toLowerCase() }, include: { tenant: true } });
  if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.tenant.status !== 'ACTIVE') return res.status(403).json({ error: 'Account suspended. Contact support.' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const payload = { userId: user.id, tenantId: user.tenantId, role: user.role };
  setRefreshCookie(res, signRefreshToken(payload));
  res.json({ accessToken: signAccessToken(payload), user: publicUser(user), tenant: { id: user.tenant.id, name: user.tenant.name, currency: user.tenant.currency, plan: user.tenant.plan } });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  let payload;
  try { payload = verifyRefreshToken(token); } catch { return res.status(401).json({ error: 'Invalid refresh token' }); }

  const user = await adminPrisma.user.findUnique({ where: { id: payload.userId }, include: { tenant: true } });
  if (!user || !user.active || user.tenant.status !== 'ACTIVE') return res.status(401).json({ error: 'Account unavailable' });

  const fresh = { userId: user.id, tenantId: user.tenantId, role: user.role };
  setRefreshCookie(res, signRefreshToken(fresh));
  res.json({ accessToken: signAccessToken(fresh), user: publicUser(user), tenant: { id: user.tenant.id, name: user.tenant.name, currency: user.tenant.currency, plan: user.tenant.plan } });
}));

router.post('/logout', (req, res) => { clearRefreshCookie(res); res.json({ ok: true }); });

router.get('/me', requireAuth(), asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.user.userId }, include: { tenant: true } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user), tenant: { id: user.tenant.id, name: user.tenant.name, currency: user.tenant.currency, plan: user.tenant.plan } });
}));

// First login forces a change of the temporary password (spec 6.1).
router.post('/change-password', requireAuth(), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const user = await prisma.user.findFirst({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  await prisma.user.updateMany({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
  });
  res.json({ ok: true });
}));

export default router;
