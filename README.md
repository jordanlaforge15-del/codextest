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

## Browser extension workspace flow

The extension popup no longer requires manual workspace IDs.

- The popup loads workspaces from `GET /workspaces` using the configured API base URL.
- Users can pick an active workspace from the dropdown, and the selection is persisted in `chrome.storage.local`.
- Users can create a workspace directly in the popup with a title-only form. The extension currently creates these as `domainType: "outfit"`.
- A newly created workspace becomes the active workspace immediately and is then used for future capture saves.
- If no active workspace is selected, the popup shows that state clearly and the background save flow warns the user instead of silently targeting a missing ID.

Manual verification flow:

1. Start the stack with `pnpm dev` and build the extension with `pnpm --filter @apps/extension build`.
2. Load `apps/extension` as an unpacked Chromium extension.
3. Open the popup and confirm the workspace picker loads entries from the API.
4. Click a workspace in the picker and confirm the "Current workspace" panel updates immediately.
5. Close and reopen the popup to confirm the active workspace is restored from `chrome.storage.local`.
6. Create a new workspace from the popup and confirm it appears in the picker and becomes active automatically.
7. Right-click an image on a local fixture page, save it to the workspace, and confirm the item appears under the active workspace without typing an ID.

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

## Render voting (Task 11a)

Render history now supports one persisted local vote per render.

- Vote values are `up`, `neutral`, and `down`.
- Votes are stored in a dedicated `render_votes` table.
- The previous generic `feedback` model was replaced with `RenderVote` to keep this slice explicit.
- In the current single-user MVP, each render has at most one current vote.
- The design is intentionally simple so a future `user_id` can be added and the uniqueness rule can evolve to `(render_id, user_id)`.

API endpoints:

- `GET /workspaces/:workspaceId/renders/:renderId/vote`
- `PUT /workspaces/:workspaceId/renders/:renderId/vote`

Render responses from:

- `GET /workspaces/:workspaceId/renders`
- `GET /workspaces/:workspaceId/renders/:renderId`

also include `currentVote`, so the web app can render vote state without an extra request per render.


## Standalone web UI + auth (Task web-ui)

The web app is now a standalone TypeScript server-rendered UI with these routes:

- `/login`: login form
- `/signup`: create account form
- `/home`: workspace list + minimal create workspace form
- `/workspaces/:workspaceId`: item selection + render request + renders grouped by vote (`up`, `neutral`, `down`, `unvoted`)

Minimal API auth support was added:

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

Auth assumptions:

- Local-first auth with email/password only.
- Passwords are hashed with Node `scrypt` + random salt.
- The API returns a signed token; the web app stores it in an HTTP-only cookie (`mvp_auth_token`).
- Workspace/item/render endpoints remain unauthenticated in this MVP iteration for compatibility with existing flows.

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
