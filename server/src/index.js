import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';

import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import leaveRoutes from './routes/leave.js';
import travelRoutes from './routes/travel.js';
import expenseRoutes from './routes/expenses.js';
import payrollRoutes from './routes/payroll.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);

// Gzip all responses — biggest single win for JSON-heavy APIs.
app.use(compression());

const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: origins.length ? origins : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Customer portal API (JWT, tenant-scoped) — spec section 3.
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/travel', travelRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Super admin API (separate auth path) — spec section 5.
app.use('/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

const required = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`HR SaaS API listening on :${port}`));
