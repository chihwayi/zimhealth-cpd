-- RBAC redesign: ADMIN -> PLATFORM_OWNER, NCZ_OFFICER merged into COUNCIL_OFFICER,
-- new COUNTRY_ADMIN role, plus User.countryCode for country-scoped admins.

-- 1. Widen the column to text so we can freely remap values before recreating the enum.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING ("role"::TEXT);

-- 2. Data migration: collapse legacy roles into the new set.
UPDATE "User" SET "role" = 'PLATFORM_OWNER' WHERE "role" = 'ADMIN';
UPDATE "User" SET "role" = 'COUNCIL_OFFICER' WHERE "role" = 'NCZ_OFFICER';

-- 3. Recreate the enum with the new value set.
DROP TYPE "Role";
CREATE TYPE "Role" AS ENUM ('PLATFORM_OWNER', 'COUNTRY_ADMIN', 'COUNCIL_OFFICER', 'CONTENT_MANAGER', 'LEARNER', 'HELPDESK');

-- 4. Convert the column back to the enum and restore the default.
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'LEARNER';

-- 5. New country-scoping column for COUNTRY_ADMIN.
ALTER TABLE "User" ADD COLUMN "countryCode" TEXT;
