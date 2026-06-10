# HR SaaS Platform — V1

Built exactly to the V1 spec: two React apps (Customer Portal + Super Admin Portal), one Node/Express API, one Postgres database (Neon), multi-tenant via `tenant_id` injected into every query, JWT auth, Resend email, Cloudflare R2 receipts, PDF payslips, CSV/PDF report exports.

**No seed or test data anywhere.** All data comes from the database; the first record is created when the super admin provisions a customer.

```
hr-saas/
├── server/                 # Express API + Prisma schema (deploys to Render)
├── apps/customer-portal/   # React (Vite + Tailwind) — deploys to Vercel
├── apps/admin-portal/      # React (Vite + Tailwind) — deploys to Vercel (separate project, same repo)
└── render.yaml             # Render blueprint for the API
```

---

## Go live (≈15 minutes, all free tiers)

### 0. Push to GitHub
```bash
cd hr-saas
git init && git add -A && git commit -m "HR SaaS V1"
# create a repo on github.com, then:
git remote add origin https://github.com/<you>/hr-saas.git
git push -u origin main
```

### 1. Database — Neon (free)
1. neon.tech → create project `hr-saas` (Postgres 16).
2. Copy the connection string (with `?sslmode=require`).
3. Create the schema (one-time, from your machine):
   ```bash
   cd server && npm install
   DATABASE_URL="<neon-url>" npx prisma migrate dev --name init
   ```
   (or `npx prisma db push` if you prefer no migration files for V1.)

### 2. API — Render (free)
1. render.com → New → **Blueprint** → select your repo. `render.yaml` configures everything.
2. Fill the env vars it asks for:
   - `DATABASE_URL` — the Neon string
   - `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` — your internal login (spec 5.2)
   - `CORS_ORIGINS` / `CUSTOMER_PORTAL_URL` — fill after step 3, then redeploy
   - `RESEND_API_KEY`, `EMAIL_FROM` — optional; emails are skipped if unset
   - `R2_*` — optional; receipt upload is disabled if unset
3. Note your API URL: `https://hr-saas-api-xxxx.onrender.com`
4. Free-tier note (spec 2.4): API spins down after ~15 min idle, ~30 s cold start. Upgrade $7/mo when it hurts.

### 3. Frontends — Vercel (free, two projects, same repo)
For each of **customer-portal** and **admin-portal**:
1. vercel.com → Add New Project → import the repo.
2. Set **Root Directory** to `apps/customer-portal` (then `apps/admin-portal` for the second project). Vite is auto-detected.
3. Add env var `VITE_API_URL = https://<your-render-api>.onrender.com`
4. Deploy.

Then go back to Render and set:
- `CORS_ORIGINS = https://<customer>.vercel.app,https://<admin>.vercel.app`
- `CUSTOMER_PORTAL_URL = https://<customer>.vercel.app`

Per spec 3, protect the admin portal at the edge: Vercel project → Settings → Deployment Protection (password / trusted IPs), since it is internal-only.

### 4. Optional services
- **Resend** (resend.com): create API key → set `RESEND_API_KEY` + `EMAIL_FROM`. 3,000 emails/mo free.
- **Cloudflare R2**: create bucket `hr-saas` → API token → set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. 10 GB free, no egress fees. Set bucket CORS to allow `PUT` from the customer-portal origin (receipts upload directly from the browser via signed URLs).

### 5. First customer
1. Open the admin portal → sign in with `SUPER_ADMIN_USERNAME`/`PASSWORD`.
2. **Provision Customer** (company name, plan, admin email…). The temp password is emailed and shown once on screen.
3. Customer admin signs into the customer portal → forced password change → configures **Settings** (currency, leave types, travel policy, expense threshold) → adds employees. Everything flows from there.

---

## How spec requirements map to code

| Spec | Where |
|---|---|
| 4.2 multi-tenancy — tenant_id injected into every query | `server/src/lib/db.js` (Prisma query extension + AsyncLocalStorage) |
| JWT `{userId, tenantId, role}`; refresh in httpOnly cookie | `server/src/lib/auth.js`, `routes/auth.js` |
| Super admin: env credentials, separate auth path (`ADMIN_SECRET` header or SUPER_ADMIN JWT) | `routes/admin.js` |
| 5.3 provisioning: tenant + first admin + welcome email + tenant ID confirmation | `routes/admin.js` → `POST /admin/tenants` |
| 6.1 forced password change on first login | `mustChangePassword` flag; portal blocks until changed |
| 6.2 roles: admin / manager / employee | route middleware + UI gating |
| 7.1 salary edit feeds next payroll; deactivate locks login + excludes payroll | `routes/employees.js`, `routes/payroll.js` |
| 7.2 leave: per-tenant types, balance decrement on approval, unpaid → payroll flag | `routes/leave.js`, `routes/settings.js` |
| 7.3 travel: policy check (max cost, destinations), offline booking, savings | `routes/travel.js` |
| 7.4 expenses: R2 receipts under `tenants/{tenantId}/expenses/{expenseId}/`, two-stage approval ≥ threshold, full audit trail | `routes/expenses.js` |
| 7.5 payroll: base + expenses − unpaid-leave deductions, PDF payslips, one-click finalise, payslip email | `routes/payroll.js`, `lib/payslip.js` |
| 7.6 dashboard widgets + CSV/PDF export of any report | `routes/reports.js` |
| 8 single-level approval, email notifications at each step | all request routes + `lib/email.js` |
| 9 plans: enum on tenants, set at provisioning, manual changes | `routes/admin.js` |

## V1 decisions (per spec section 10 — current defaults, all changeable per tenant)
- **Currency**: per-tenant (default USD), single currency per tenant. No tax calculation — payroll is gross calculation + payslips; payment is offline (spec 7.5 / 11).
- **Leave defaults**: none shipped — each tenant admin defines leave types in Settings (no hardcoded data).
- **Travel policy fields**: max cost per trip + allowed destinations list (blank = unrestricted).
- **Expense finance threshold**: per tenant, default 500, editable in Settings.
- **Manager delegation**: not in V1 — an admin can decide any request (spec 8.4).
- **Salary semantics**: `salaryMonthly` is gross monthly pay; unpaid-leave daily rate = salary / 22 working days.
- **Billing**: manual invoicing, no billing logic in V1 (spec 9/10).

## Local development (optional)
```bash
cd server && npm install && cp .env.example .env   # fill DATABASE_URL etc.
npx prisma db push && npm run dev                  # API on :8080
cd ../apps/customer-portal && npm install && npm run dev   # :5173
cd ../apps/admin-portal && npm install && npm run dev      # :5174
```
