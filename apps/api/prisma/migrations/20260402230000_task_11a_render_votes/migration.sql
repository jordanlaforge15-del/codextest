DROP TABLE IF EXISTS "feedback";
DROP TYPE IF EXISTS "feedback_rating";

CREATE TYPE "render_vote_value" AS ENUM ('up', 'neutral', 'down');

CREATE TABLE "render_votes" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "render_id" TEXT NOT NULL,
    "vote" "render_vote_value" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "render_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "render_votes_render_id_key" ON "render_votes"("render_id");
CREATE INDEX "render_votes_workspace_id_idx" ON "render_votes"("workspace_id");

ALTER TABLE "render_votes"
ADD CONSTRAINT "render_votes_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "render_votes"
ADD CONSTRAINT "render_votes_render_id_fkey"
FOREIGN KEY ("render_id") REFERENCES "renders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
