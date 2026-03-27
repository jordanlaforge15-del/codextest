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
2. Start local PostgreSQL:
   ```bash
   docker compose up -d postgres
   ```
3. Run database migration and seed:
   ```bash
   pnpm --filter @apps/api db:migrate
   pnpm --filter @apps/api db:seed
   ```
4. Start all apps in development mode:
   ```bash
   pnpm dev
   ```

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
