DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'proposed_course_title'
  ) THEN
    ALTER TABLE tutor_applications RENAME COLUMN proposed_course_title TO course_title;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'course_outline'
  ) THEN
    ALTER TABLE tutor_applications RENAME COLUMN course_outline TO course_description;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'motivation'
  ) THEN
    ALTER TABLE tutor_applications RENAME COLUMN motivation TO headline;
  END IF;
END
$$;

UPDATE tutor_applications
SET course_description = ''
WHERE course_description IS NULL;

UPDATE tutor_applications
SET headline = ''
WHERE headline IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'course_description'
  ) THEN
    EXECUTE 'ALTER TABLE tutor_applications ALTER COLUMN course_description SET NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'headline'
  ) THEN
    EXECUTE 'ALTER TABLE tutor_applications ALTER COLUMN headline SET NOT NULL';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'course_level'
  ) THEN
    ALTER TABLE tutor_applications DROP COLUMN course_level;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'delivery_format'
  ) THEN
    ALTER TABLE tutor_applications DROP COLUMN delivery_format;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_applications' AND column_name = 'target_audience'
  ) THEN
    ALTER TABLE tutor_applications ADD COLUMN target_audience text NOT NULL DEFAULT '';
    ALTER TABLE tutor_applications ALTER COLUMN target_audience DROP DEFAULT;
  END IF;
END
$$;
