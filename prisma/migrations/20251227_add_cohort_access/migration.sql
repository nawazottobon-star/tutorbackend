CREATE TABLE IF NOT EXISTS cohorts (
  cohort_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cohort_course ON cohorts(course_id);

CREATE TABLE IF NOT EXISTS cohort_members (
  member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(cohort_id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cohort_email ON cohort_members(cohort_id, email);
CREATE INDEX IF NOT EXISTS idx_cohort_member_user ON cohort_members(user_id);
