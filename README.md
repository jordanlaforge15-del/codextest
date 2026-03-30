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

<<<<<<< HEAD
> The Codex container connects to PostgreSQL over the shared Docker network `workspace-mvp-network`.
> The Codex container image installs `@openai/codex` during build so Codex is available inside the container.
> Use `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/workspace_mvp` from inside the Codex container.

## Local image storage (Task 4)

The API now ingests `imageUrl` values during item creation and stores downloaded files on the local filesystem.

- Default storage path: `storage/images` (configurable via `IMAGE_STORAGE_PATH` in `apps/api/.env`).
- The API validates `content-type` (`image/*` only), download timeout, and max file size before saving.
- Failed image ingestion does not fail item creation; `storedImagePath` remains `null`.

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
