ALTER TABLE "module_progress"
ADD COLUMN IF NOT EXISTS "passed_at" TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS "cooldown_until" TIMESTAMPTZ NULL;

UPDATE "module_progress"
SET "cooldown_until" = COALESCE(
  "cooldown_until",
  CASE
    WHEN "unlocked_at" IS NOT NULL THEN "unlocked_at" + INTERVAL '7 days'
    ELSE NOW() + INTERVAL '7 days'
  END
)
WHERE "cooldown_until" IS NULL;

UPDATE "module_progress"
SET "passed_at" = COALESCE("passed_at", "completed_at", "updated_at")
WHERE "quiz_passed" = TRUE
  AND "passed_at" IS NULL;
