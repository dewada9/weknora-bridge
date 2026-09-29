# Required API behavior

All requests use the user-configured root origin and `X-API-Key`. The client does not follow redirects. A deployment must authenticate and authorize the selected knowledge base for every route.

| Operation | Route | Requirement |
|---|---|---|
| List | `GET /api/v1/knowledge-bases/{kb}/knowledge` | Paginated data, source metadata |
| Read status | `GET /api/v1/knowledge/{id}` | `id`, `file_hash`, `parse_status`, `metadata` |
| Upload | `POST /api/v1/knowledge-bases/{kb}/knowledge/file` | Multipart file, fileName, channel, metadata |
| Update title | `PUT /api/v1/knowledge/{id}` | JSON title, authorized existing document |
| Replace original | `PUT /api/v1/knowledge/{id}/file` | **Extension:** multipart, stable ID, `If-Match` expected file hash |
| Search | `POST /api/v1/knowledge-bases/{kb}/hybrid-search` | Source IDs and content snippets |
| Derived catalog | `GET /api/v1/obsidian/graph` | **Optional extension:** authenticated snapshot scoped to the selected KB |

JSON responses use `{success, data}` with `total` for lists. Upload returns the knowledge record including the saved metadata and MD5 `file_hash`. Source UUID and replacement attempt UUID must round-trip unchanged. Replacement must be authorized, serialized or transactionally guarded against concurrent writes, preserve the document ID and reject stale hashes or busy parsing states. The client must never compensate for an unsupported route by deleting the old document.

Do not enable updates against a server which silently ignores `If-Match` or strips source metadata. Test authorization, stale-hash rejection, lost responses, parse transitions and remote edits in a disposable KB first. The deployment-specific server patches are intentionally not distributed in this client project.

Snapshot validation and schema examples are in `library.test.cjs`. Client checks the configured knowledge-base ID and rejects stale or inconsistent snapshots. Server-side authentication cannot be replaced by this client validation. A graph endpoint must not expose a global snapshot across tenants.
