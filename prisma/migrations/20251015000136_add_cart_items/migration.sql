-- Create cart_items table to persist per-user carts
CREATE TABLE IF NOT EXISTS "cart_items" (
  "cart_item_id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "course_slug" TEXT NOT NULL,
  "course_title" TEXT NOT NULL,
  "course_price" INTEGER NOT NULL DEFAULT 0,
  "course_data" JSONB,
  "added_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "cart_items_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_cart_item_user_slug"
  ON "cart_items" ("user_id", "course_slug");
