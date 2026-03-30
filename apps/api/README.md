# API (Task 4)

Base URL (local): `http://localhost:4000`

## Health

- `GET /health`

## Workspaces

- `POST /workspaces`
- `GET /workspaces`
- `GET /workspaces/:workspaceId`
- `PATCH /workspaces/:workspaceId`

### Create workspace request

```json
{
  "title": "Spring Closet Refresh",
  "intentionText": "Find outfit combinations for everyday wear",
  "domainType": "outfit"
}
```

## Items

- `POST /workspaces/:workspaceId/items`
- `GET /workspaces/:workspaceId/items`
- `PATCH /workspaces/:workspaceId/items/:itemId`
- `DELETE /workspaces/:workspaceId/items/:itemId`

### Create item request

```json
{
  "pageUrl": "https://example.com/p/123",
  "imageUrl": "https://images.example.com/p/123.jpg",
  "title": "Cotton Tee",
  "role": "candidate",
  "metadataJson": {
    "color": "black"
  }
}
```

### Image ingestion and local storage

When `imageUrl` is provided on item creation, the API attempts to download and store the image locally before writing the item row.

- Only `image/*` content types are accepted.
- Images are rejected if they exceed the configured size limit (default `10MB`).
- Download timeout is configurable (default `8000ms`).
- Stored filenames are deterministic (`sha256(imageUrl)` + extension).
- On ingestion failure, item creation still succeeds and `storedImagePath` is persisted as `null`.

Environment variables:

- `IMAGE_STORAGE_PATH` (default: `storage/images`)
- `IMAGE_MAX_FILE_SIZE_BYTES` (default: `10485760`)
- `IMAGE_FETCH_TIMEOUT_MS` (default: `8000`)

By default, files are written under `<repo>/storage/images` when the API is launched from repo root.

## Response shape

Successful responses use:

```json
{
  "data": {"...": "..."}
}
```

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | HTTP_ERROR | INTERNAL_SERVER_ERROR",
    "message": "...",
    "details": {}
  }
}
```
