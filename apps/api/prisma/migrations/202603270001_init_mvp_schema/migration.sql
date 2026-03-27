-- Create enums
CREATE TYPE "item_role" AS ENUM ('fixed', 'candidate');
CREATE TYPE "render_status" AS ENUM ('queued', 'processing', 'complete', 'failed');
CREATE TYPE "render_mode" AS ENUM ('preview', 'high_quality');
CREATE TYPE "feedback_rating" AS ENUM ('yes', 'no', 'maybe');

-- Create tables
CREATE TABLE "workspaces" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "intention_text" TEXT,
  "domain_type" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "items" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT NOT NULL,
  "source_url" TEXT,
  "page_url" TEXT,
  "image_url" TEXT,
  "stored_image_path" TEXT,
  "title" TEXT,
  "brand" TEXT,
  "merchant" TEXT,
  "price" NUMERIC(12,2),
  "currency" TEXT,
  "slot_type" TEXT,
  "role" "item_role" NOT NULL DEFAULT 'candidate',
  "metadata_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
);

CREATE TABLE "renders" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT NOT NULL,
  "status" "render_status" NOT NULL DEFAULT 'queued',
  "render_mode" "render_mode" NOT NULL DEFAULT 'preview',
  "selected_item_ids" JSONB NOT NULL,
  "recommendation_text" TEXT,
  "recommendation_label" TEXT,
  "output_image_path" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "renders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
);

CREATE TABLE "feedback" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT NOT NULL,
  "render_id" TEXT NOT NULL,
  "rating" "feedback_rating" NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "feedback_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "feedback_render_id_fkey" FOREIGN KEY ("render_id") REFERENCES "renders"("id") ON DELETE CASCADE
);

CREATE TABLE "capture_events" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT NOT NULL,
  "page_url" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "page_title" TEXT,
  "alt_text" TEXT,
  "surrounding_text" TEXT,
  "raw_payload_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "capture_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
);

-- Indexes
CREATE INDEX "workspaces_domain_type_idx" ON "workspaces" ("domain_type");
CREATE INDEX "items_workspace_id_idx" ON "items" ("workspace_id");
CREATE INDEX "items_workspace_id_role_idx" ON "items" ("workspace_id", "role");
CREATE INDEX "renders_workspace_id_idx" ON "renders" ("workspace_id");
CREATE INDEX "renders_workspace_id_status_idx" ON "renders" ("workspace_id", "status");
CREATE INDEX "feedback_workspace_id_idx" ON "feedback" ("workspace_id");
CREATE INDEX "feedback_render_id_idx" ON "feedback" ("render_id");
CREATE INDEX "capture_events_workspace_id_idx" ON "capture_events" ("workspace_id");
CREATE INDEX "capture_events_workspace_id_created_at_idx" ON "capture_events" ("workspace_id", "created_at");
