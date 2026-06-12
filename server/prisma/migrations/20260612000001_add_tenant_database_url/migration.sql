-- Add per-tenant database URL to Tenant table (admin DB only)
ALTER TABLE "Tenant" ADD COLUMN "databaseUrl" TEXT;
