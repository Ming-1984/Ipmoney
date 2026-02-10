-- CreateEnum
CREATE TYPE "PledgeStatus" AS ENUM ('NONE', 'PLEDGED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExistingLicenseStatus" AS ENUM ('NONE', 'EXCLUSIVE', 'SOLE', 'NON_EXCLUSIVE', 'UNKNOWN');

-- AddColumn
ALTER TABLE "listings" ADD COLUMN "deliverables_json" JSONB;
ALTER TABLE "listings" ADD COLUMN "expected_completion_days" INTEGER;
ALTER TABLE "listings" ADD COLUMN "negotiable_range_fen" INTEGER;
ALTER TABLE "listings" ADD COLUMN "negotiable_range_percent" DOUBLE PRECISION;
ALTER TABLE "listings" ADD COLUMN "negotiable_note" TEXT;
ALTER TABLE "listings" ADD COLUMN "pledge_status" "PledgeStatus";
ALTER TABLE "listings" ADD COLUMN "existing_license_status" "ExistingLicenseStatus";
ALTER TABLE "listings" ADD COLUMN "encumbrance_note" TEXT;
