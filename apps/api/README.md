# API (Task 3)

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
