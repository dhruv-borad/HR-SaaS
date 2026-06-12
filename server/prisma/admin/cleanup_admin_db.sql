-- Run this once in pgAdmin against the hr-saas Neon admin database.
-- Drops all tables that should not exist in the admin DB (only Tenant should remain),
-- then clears all existing tenant rows so you can provision fresh tenants.

-- 1. Drop operational tables (they live in each tenant's own DB now)
DROP TABLE IF EXISTS "AuditLog"          CASCADE;
DROP TABLE IF EXISTS "ApprovalWorkflow"  CASCADE;
DROP TABLE IF EXISTS "PayrollItem"       CASCADE;
DROP TABLE IF EXISTS "PayrollRun"        CASCADE;
DROP TABLE IF EXISTS "ExpenseClaim"      CASCADE;
DROP TABLE IF EXISTS "TravelRequest"     CASCADE;
DROP TABLE IF EXISTS "LeaveBalance"      CASCADE;
DROP TABLE IF EXISTS "LeaveRequest"      CASCADE;
DROP TABLE IF EXISTS "LeaveType"         CASCADE;
DROP TABLE IF EXISTS "User"              CASCADE;

-- 2. Drop enum types that belong to tenant DBs only
DROP TYPE IF EXISTS "Role";
DROP TYPE IF EXISTS "RequestStatus";
DROP TYPE IF EXISTS "ExpenseStatus";
DROP TYPE IF EXISTS "PayrollStatus";

-- 3. Delete all existing tenants (fresh start with new architecture)
DELETE FROM "Tenant";

-- After running this SQL:
-- Run in your terminal (from server/):
--   npx prisma db push --schema prisma/admin/schema.prisma
-- This creates the new UserIndex table in the admin DB.
-- Then push code to GitHub and let Render redeploy.
