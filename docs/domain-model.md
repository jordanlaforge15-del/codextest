# MVP Domain Model (Task 2)

## Entities and relationships

- **Workspace** is the top-level container for a user goal/context.
- **Item** belongs to one workspace and stores product/source metadata from captures.
- **CaptureEvent** belongs to one workspace and records raw extension capture payloads for auditability/replay.
- **Render** belongs to one workspace and stores status + output metadata for asynchronous render attempts.
- **Feedback** belongs to a workspace and a render, representing user judgment of render quality.

Relationship summary:

- `Workspace 1 -> N Item`
- `Workspace 1 -> N CaptureEvent`
- `Workspace 1 -> N Render`
- `Render 1 -> N Feedback`
- `Workspace 1 -> N Feedback`

## Why this schema shape for MVP

- Keeps **workspace** as the stable aggregate root for future web/extension UX.
- Stores nullable item fields to support partial capture quality in early ingestion flows.
- Uses explicit enums (`item_role`, `render_status`, `render_mode`, `feedback_rating`) for domain constraints without overfitting.
- Preserves flexibility with JSON payload columns (`metadata_json`, `raw_payload_json`, `selected_item_ids`) where schema may evolve quickly.
- Adds simple indexes on common ownership/status lookup paths for predictable initial performance.
