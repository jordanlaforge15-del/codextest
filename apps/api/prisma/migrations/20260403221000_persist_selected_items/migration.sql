ALTER TABLE "workspaces"
ADD COLUMN "selected_item_ids" JSONB NOT NULL DEFAULT '[]';
