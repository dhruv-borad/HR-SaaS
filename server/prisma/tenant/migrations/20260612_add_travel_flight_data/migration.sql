-- Add flight booking fields to TravelRequest for Amadeus integration.
ALTER TABLE "TravelRequest" ADD COLUMN IF NOT EXISTS "origin"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "TravelRequest" ADD COLUMN IF NOT EXISTS "tripType"   TEXT NOT NULL DEFAULT 'ONE_WAY';
ALTER TABLE "TravelRequest" ADD COLUMN IF NOT EXISTS "flightData" JSONB;
