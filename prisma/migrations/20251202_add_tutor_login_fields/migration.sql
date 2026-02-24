-- Ensure tutors table has direct credentials for dedicated login
ALTER TABLE "tutors"
  ADD COLUMN IF NOT EXISTS "email" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

-- Backfill display_name if missing when tutors table already populated without it
UPDATE "tutors"
SET "display_name" = COALESCE("display_name", 'Tutor')
WHERE "display_name" IS NULL;
