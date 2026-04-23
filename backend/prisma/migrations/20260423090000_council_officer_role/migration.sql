-- Add COUNCIL_OFFICER role (keep NCZ_OFFICER for backwards compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'COUNCIL_OFFICER'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'COUNCIL_OFFICER';
  END IF;
END $$;

