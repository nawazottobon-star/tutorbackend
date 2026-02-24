-- Add role column to users (safe if already present)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'learner';

-- Tutors table
CREATE TABLE IF NOT EXISTS "tutors" (
  "tutor_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("user_id") ON DELETE CASCADE,
  "display_name" TEXT NOT NULL,
  "bio" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course-tutor assignments
CREATE TABLE IF NOT EXISTS "course_tutors" (
  "course_tutor_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "course_id" UUID NOT NULL REFERENCES "courses"("course_id") ON DELETE CASCADE,
  "tutor_id" UUID NOT NULL REFERENCES "tutors"("tutor_id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'owner',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_tutor_assignment UNIQUE ("course_id","tutor_id")
);
