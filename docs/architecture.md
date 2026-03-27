# Architecture Overview (Task 1 Skeleton)

## Runtime components

- **Web app (`apps/web`)**: future workspace/item management UI.
- **Browser extension (`apps/extension`)**: future shopping page capture client.
- **API (`apps/api`)**: core system of record and orchestration API.
- **Worker (`apps/worker`)**: asynchronous processing for rendering/enrichment jobs.
- **Shared package (`packages/shared`)**: domain types and shared contracts.

## Domain model placeholders

Initial types exist for:

- Workspace
- Item
- CaptureEvent
- Render
- Feedback

These are type-only contracts in Task 1 and will be backed by concrete schema + persistence in Task 2.

## Design principles

- Prioritize local-first development with environment scaffolding.
- Keep boundaries explicit via package-level ownership.
- Delay implementation-heavy features (capture endpoints, rendering pipeline) until foundational persistence/API layers are in place.
