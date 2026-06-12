import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { adminPrisma, prisma, getTenantClient } from '../lib/db.js';
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

// Login: look up email in UserIndex (admin DB) to avoid scanning all tenant DBs,
// then fetch the full user from the correct tenant DB.
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const cred = await adminPrisma.userIndex.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!cred || !cred.active) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, cred.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const tenant = await adminPrisma.tenant.findUnique({ where: { id: cred.tenantId } });
  if (!tenant || tenant.status !== 'ACTIVE') return res.status(403).json({ error: 'Account suspended. Contact support.' });

  const tenantClient = await getTenantClient(cred.tenantId);
  const user = await tenantClient.user.findUnique({ where: { id: cred.id } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const payload = { userId: user.id, tenantId: user.tenantId, role: user.role };
  setRefreshCookie(res, signRefreshToken(payload));
  res.json({
    accessToken: signAccessToken(payload),
    user: publicUser(user),
    tenant: { id: tenant.id, name: tenant.name, currency: tenant.currency, plan: tenant.plan },
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  let payload;
  try { payload = verifyRefreshToken(token); } catch { return res.status(401).json({ error: 'Invalid refresh token' }); }

  const cred = await adminPrisma.userIndex.findUnique({ where: { id: payload.userId } });
  if (!cred || !cred.active) return res.status(401).json({ error: 'Account unavailable' });

  const tenant = await adminPrisma.tenant.findUnique({ where: { id: cred.tenantId } });
  if (!tenant || tenant.status !== 'ACTIVE') return res.status(401).json({ error: 'Account unavailable' });

  const tenantClient = await getTenantClient(cred.tenantId);
  const user = await tenantClient.user.findUnique({ where: { id: cred.id } });
  if (!user) return res.status(401).json({ error: 'Account unavailable' });

  const fresh = { userId: user.id, tenantId: user.tenantId, role: user.role };
  setRefreshCookie(res, signRefreshToken(fresh));
  res.json({
    accessToken: signAccessToken(fresh),
    user: publicUser(user),
    tenant: { id: tenant.id, name: tenant.name, currency: tenant.currency, plan: tenant.plan },
  });
}));

router.post('/logout', (req, res) => { clearRefreshCookie(res); res.json({ ok: true }); });

router.get('/me', requireAuth(), asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const tenant = await adminPrisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  res.json({
    user: publicUser(user),
    tenant: { id: tenant.id, name: tenant.name, currency: tenant.currency, plan: tenant.plan },
  });
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

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.updateMany({
    where: { id: user.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });
  // Keep UserIndex in sync so next login works.
  await adminPrisma.userIndex.update({ where: { id: user.id }, data: { passwordHash: newHash } });
  res.json({ ok: true });
}));

export default router;
