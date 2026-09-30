# Mermaid Storage Backend

Optional HTTP API that lets [`mermaid-local-editor`](../mermaid-local-editor) persist diagrams
to disk instead of (or alongside) browser `localStorage`. The editor works fully offline without
this service — it's a drop-in addition for when diagrams need to survive across browsers/machines.

## Usage

```sh
pnpm serve:storage
```

Listens on `http://localhost:8082` by default and stores diagrams as JSON in
`packages/mermaid-storage-backend/data/diagrams.json`.

Override with env vars:

- `MERMAID_STORAGE_PORT` — port to listen on
- `MERMAID_STORAGE_DATA_DIR` — directory for the JSON data file

## API

| Method | Path                  | Body                       | Notes                          |
| ------ | --------------------- | -------------------------- | ------------------------------ |
| GET    | `/healthz`            | —                          | `{ ok: true }`                 |
| GET    | `/api/diagrams`       | —                          | All diagrams, keyed by name    |
| PUT    | `/api/diagrams/:name` | `{ src, view, updatedAt }` | Upserts one diagram            |
| DELETE | `/api/diagrams/:name` | —                          | 204 if deleted, 404 if missing |

## Notes

- Single JSON file, no database — this is meant for one user/team on a local network, not
  multi-tenant or high-concurrency use.
- Writes are serialized through an in-process queue to avoid corrupting the file, but there is no
  cross-process locking — run a single instance.
- CORS is wide open since this is a local dev tool with no auth; don't expose it beyond localhost
  without adding both.
