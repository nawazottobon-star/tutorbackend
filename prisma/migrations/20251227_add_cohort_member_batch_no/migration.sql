ALTER TABLE cohort_members
  ADD COLUMN IF NOT EXISTS batch_no int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_cohort_member_batch
  ON cohort_members(cohort_id, batch_no);
