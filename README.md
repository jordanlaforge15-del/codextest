# Workspace Image MVP Monorepo

This repository is a TypeScript + Node.js monorepo for a modular-monolith MVP with four core runtime surfaces:

- `apps/web`: web app shell
- `apps/extension`: browser extension shell
- `apps/api`: REST API server + database schema
- `apps/worker`: worker shell for asynchronous jobs
- `packages/shared`: shared domain types used across apps

## Getting started

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start local PostgreSQL (Compose file 1):
   ```bash
   docker compose -f docker-compose.yml up -d postgres
   ```
3. Start the Codex/dev container (Compose file 2):
   ```bash
   docker compose -f docker-compose.codex.yml up -d --build codex
   docker compose -f docker-compose.codex.yml exec codex bash
   ```
4. Inside the Codex container, run database migration and seed:
   ```bash
   pnpm --filter @apps/api db:migrate
   pnpm --filter @apps/api db:seed
   ```
5. Inside the Codex container, start all apps in development mode:
   ```bash
   pnpm dev
   ```
> The Codex container connects to PostgreSQL over the shared Docker network `workspace-mvp-network`.
> The Codex container image installs `@openai/codex` during build so Codex is available inside the container.
> Use `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/workspace_mvp` from inside the Codex container.

## Local image and render storage

The API now ingests `imageUrl` values during item creation and capture creation, and the worker stores AI-generated render outputs on the local filesystem.

- Default item image storage path: `storage/images` (configurable via `IMAGE_STORAGE_PATH`).
- Default render output path: `storage/renders` (configurable via `RENDER_OUTPUT_DIR`).
- The API validates `content-type` (`image/*` only), download timeout, and max file size before saving.
- Failed image ingestion does not fail item creation; `storedImagePath` remains `null`.
- Render outputs are served by the API at `/assets/renders/<filename>`.

## Metadata extraction and normalization (Task 10)

The API performs best-effort metadata extraction when items are created, especially through `POST /workspaces/:workspaceId/captures`.

- Lightweight synchronous extraction runs during item creation and capture creation.
- The extractor attempts to populate `title`, `merchant`, `brand`, `slotType`, `price`, and `currency`.
- Additional attributes such as `colorName`, `sizeOptions`, and `sku` are stored under `item.metadataJson.extraction.derived`.
- Raw capture data remains on `CaptureEvent` (`raw_payload_json`, `page_url`, `image_url`, `alt_text`, `surrounding_text`).
- Normalized fields are written onto `Item` for rendering, filtering, and manual editing.
- A non-blocking in-process async enrichment hook runs after capture creation and only fills blank item fields or merges extra extracted metadata.
- Extraction failures never block item creation; the item is still saved with whatever user-provided or existing values are available.
- Current extraction is deterministic only. No LLM is required or used in the MVP path.

Extraction strategy:

1. Domain parsing derives `merchant`.
2. `alt_text`, `page_title`, URL slugs, and capture context are scored to choose a normalized product `title`.
3. Keyword matching infers `slotType`.
4. Raw payload keys and regex heuristics attempt `brand`, `price`, `currency`, `colorName`, `sizeOptions`, and `sku`.
5. Confidence and source details are stored in `metadataJson.extraction`.

## AI render pipeline (Task 9)

1. The web app loads workspaces and items from the API.
2. The user selects saved items and creates a render request with `POST /workspaces/:workspaceId/renders`.
3. The API persists a render row in `queued` status.
4. The worker polls queued renders, marks the job `processing`, loads the workspace and selected item images, and calls the OpenAI Responses API with the `image_generation` tool.
5. The worker stores the generated image locally, updates the render to `complete`, and saves `outputImagePath`.
6. If OpenAI or local asset validation fails, the worker marks the render `failed` and saves a useful error message.

Required environment variables for AI rendering:

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL` (optional, default `gpt-image-1`)
- `OPENAI_BASE_URL` (optional)
- `RENDER_OUTPUT_DIR` (optional)

Human setup:

1. Create an OpenAI API key in the OpenAI dashboard.
2. Export it locally, for example `export OPENAI_API_KEY=...`.
3. Ensure the API server and worker are started from the same environment or both receive that env var.
4. Never place the key in frontend code, extension code, or committed source files.
5. Start the API, worker, and web app, then queue a render from the web UI.

## Repo layout

```text
apps/
  api/        Express API skeleton + Prisma schema/migrations
  extension/  Browser extension skeleton (MV3)
  web/        Minimal web app starter
  worker/     Worker process starter
packages/
  shared/     Domain types shared by all runtimes
docs/
  architecture.md
  domain-model.md
```

## Architecture notes

- Modular monolith: single repository with clear app boundaries.
- REST-first backend API (`apps/api`) with health + Workspace/Item CRUD endpoints (capture/render deferred).
- Shared DTO and domain typing in `packages/shared` to reduce drift across runtimes.
- PostgreSQL + Prisma for schema management and migration workflow.

See `docs/architecture.md` and `docs/domain-model.md` for current design decisions.
