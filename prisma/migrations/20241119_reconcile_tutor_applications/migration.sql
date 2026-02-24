-- Ensure table exists for shadow DBs that start empty.
CREATE TABLE IF NOT EXISTS tutor_applications (
  application_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  headline         TEXT,
  course_title     TEXT,
  course_description TEXT,
  target_audience  TEXT,
  expertise_area   TEXT,
  experience_years INTEGER,
  availability     TEXT,
  status           TEXT DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'proposed_course_title'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'course_title'
  ) THEN
    ALTER TABLE tutor_applications RENAME COLUMN proposed_course_title TO course_title;
  END IF;
END
$$;

ALTER TABLE tutor_applications
  ADD COLUMN IF NOT EXISTS course_title text;

UPDATE tutor_applications
SET course_title = COALESCE(course_title, '')
WHERE course_title IS NULL;

ALTER TABLE tutor_applications
  ALTER COLUMN course_title SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'course_outline'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'course_description'
  ) THEN
    ALTER TABLE tutor_applications RENAME COLUMN course_outline TO course_description;
  END IF;
END
$$;

ALTER TABLE tutor_applications
  ADD COLUMN IF NOT EXISTS course_description text;

UPDATE tutor_applications
SET course_description = COALESCE(course_description, '')
WHERE course_description IS NULL;

ALTER TABLE tutor_applications
  ALTER COLUMN course_description SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'motivation'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'headline'
  ) THEN
    ALTER TABLE tutor_applications RENAME COLUMN motivation TO headline;
  END IF;
END
$$;

ALTER TABLE tutor_applications
  ADD COLUMN IF NOT EXISTS headline text;

UPDATE tutor_applications
SET headline = COALESCE(headline, '')
WHERE headline IS NULL;

ALTER TABLE tutor_applications
  ALTER COLUMN headline SET NOT NULL;

ALTER TABLE tutor_applications
  ADD COLUMN IF NOT EXISTS target_audience text;

UPDATE tutor_applications
SET target_audience = COALESCE(target_audience, '')
WHERE target_audience IS NULL;

ALTER TABLE tutor_applications
  ALTER COLUMN target_audience SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'course_level'
  ) THEN
    ALTER TABLE tutor_applications DROP COLUMN course_level;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'delivery_format'
  ) THEN
    ALTER TABLE tutor_applications DROP COLUMN delivery_format;
  END IF;
END
$$;
