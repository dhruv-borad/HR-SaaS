-- Move travel policy fields from Tenant to User (per-employee limits)

ALTER TABLE "User" ADD COLUMN "travelMaxCostPerTrip" DECIMAL(12,2);
ALTER TABLE "User" ADD COLUMN "travelAllowedDestinations" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "Tenant" DROP COLUMN "travelMaxCostPerTrip";
ALTER TABLE "Tenant" DROP COLUMN "travelAllowedDestinations";
