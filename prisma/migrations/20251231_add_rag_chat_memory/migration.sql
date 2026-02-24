CREATE TYPE "RagChatRole" AS ENUM ('user', 'assistant', 'system');

CREATE TABLE "cp_rag_chat_sessions" (
  "session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "topic_id" uuid NOT NULL,
  "summary" text,
  "summary_message_count" integer NOT NULL DEFAULT 0,
  "summary_updated_at" timestamptz,
  "last_message_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cp_rag_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE,
  CONSTRAINT "cp_rag_chat_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("course_id") ON DELETE CASCADE,
  CONSTRAINT "cp_rag_chat_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics" ("topic_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "uq_cp_rag_chat_session_user_course_topic"
  ON "cp_rag_chat_sessions" ("user_id", "course_id", "topic_id");
CREATE INDEX "idx_cp_rag_chat_session_course" ON "cp_rag_chat_sessions" ("course_id");
CREATE INDEX "idx_cp_rag_chat_session_user" ON "cp_rag_chat_sessions" ("user_id");

CREATE TABLE "cp_rag_chat_messages" (
  "message_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "RagChatRole" NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cp_rag_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cp_rag_chat_sessions" ("session_id") ON DELETE CASCADE,
  CONSTRAINT "cp_rag_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE
);

CREATE INDEX "idx_cp_rag_chat_message_session_created"
  ON "cp_rag_chat_messages" ("session_id", "created_at");
CREATE INDEX "idx_cp_rag_chat_message_user" ON "cp_rag_chat_messages" ("user_id");
