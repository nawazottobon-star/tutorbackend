CREATE TABLE IF NOT EXISTS cold_call_prompts (
  prompt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(topic_id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  helper_text text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cold_call_prompt_topic_order
  ON cold_call_prompts(topic_id, display_order);
CREATE INDEX IF NOT EXISTS idx_cold_call_prompt_course
  ON cold_call_prompts(course_id);
CREATE INDEX IF NOT EXISTS idx_cold_call_prompt_topic
  ON cold_call_prompts(topic_id);

CREATE TABLE IF NOT EXISTS cold_call_messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES cold_call_prompts(prompt_id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES cohorts(cohort_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  parent_id uuid REFERENCES cold_call_messages(message_id) ON DELETE CASCADE,
  root_id uuid REFERENCES cold_call_messages(message_id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cold_call_message_top_level
  ON cold_call_messages(prompt_id, cohort_id, user_id)
  WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_cold_call_message_prompt
  ON cold_call_messages(prompt_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_cold_call_message_root
  ON cold_call_messages(root_id);
CREATE INDEX IF NOT EXISTS idx_cold_call_message_parent
  ON cold_call_messages(parent_id);

CREATE TABLE IF NOT EXISTS cold_call_stars (
  star_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES cold_call_messages(message_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cold_call_star_user
  ON cold_call_stars(message_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cold_call_star_message
  ON cold_call_stars(message_id);
CREATE INDEX IF NOT EXISTS idx_cold_call_star_user
  ON cold_call_stars(user_id);
