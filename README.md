# WeKnora Bridge

A desktop Obsidian integration for publishing selected notes and files to your own WeKnora knowledge base. Independent community project; not an official Obsidian or Tencent product.

**Status: early release candidate.** Windows desktop has been tested. macOS/Linux and official community-directory installation have not been verified. This project does not include a hosted service, keys, or a private deployment.

## What it does

- Keeps drafts local; automatic publication is off until explicitly enabled.
- Publishes Markdown, TXT, PDF, Word, PNG, JPEG and WebP, up to 20 MiB.
- Tracks remote parsing separately from successful upload.
- Optionally moves completed, unchanged intake files into a published folder. Conflicts never overwrite existing files; an interrupted move retains a recovery journal.
- Preserves document IDs through edits and moves. Detects remote changes and uncertain requests instead of blindly retrying.
- Keeps settings, commands and file context-menu actions available when credentials are missing.
- Stores API keys through Obsidian SecretStorage. Plugin settings contain a secret reference, not the key.
- Optionally imports a source-linked catalog and small graphs from a compatible snapshot endpoint while preserving manual edits.

## Server compatibility — read before installing

Initial upload, retrieval and search use WeKnora APIs. **In-place updates require a compatible guarded file-replacement endpoint; automatic catalog/graph import requires a separate authenticated snapshot endpoint.** These are deployment extensions, not assumed to exist in stock WeKnora. See [the API contract](docs/server-compatibility.md). Unsupported updates remain visible as errors; the client never deletes and recreates a document to pretend an update succeeded.

If you only run stock WeKnora, validate the API contract before enabling continuous publication. Do not install private deployment scripts from another user's environment. The project intentionally excludes server credentials and environment-specific provisioning scripts.

## Install and configure

Requires **Obsidian 1.11.4+ on desktop**. Mobile is not supported by this release.

Download `weknora-bridge-1.3.0-plugin.zip` from the [1.3.0 preview release](https://github.com/dewada9/weknora-bridge/releases/tag/1.3.0), extract its three files into `<vault>/.obsidian/plugins/weknora-bridge/`, then follow configuration steps 3–5 below. This release is not listed in the official community directory.

1. Run `npm test` and `npm run build` with Node.js 20+.
2. Create `<vault>/.obsidian/plugins/weknora-bridge/` and copy only `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` into it.
3. Enable **WeKnora Bridge** in Community plugins.
4. Open its settings. Enter your server root URL, knowledge-base ID and select/create a secret containing your scoped API key. Click **保存并连接** (Save and connect).
5. Choose your intake and published folders. Enable automatic publication and optional completed-file archiving when ready. Folder defaults are editable; ordinary drafts remain local.

On another computer, configure its local secret again. Do not copy a live `data.json` to another knowledge base: it contains document identities, publication intent and recovery state. Export or back up that state privately before changing your installation.

## Workflow

`Draft → intake folder → upload → parsing → completed → published folder`

Editing a published file updates the same document. Obsidian's `fileManager.renameFile` handles link updates according to your Obsidian preference; keep automatic link updating enabled. Moving a document updates its path metadata on the next sync and can trigger one further server parse. Failed parsing, concurrent edits and conflicts stay visible instead of being moved prematurely.

The app must be open to upload. Offline requests back off; reopening resumes from saved records. Deleting a local file does **not** delete its remote document. This is publication plus optional derived-data import, **not** a two-way editor for remote originals.

## Privacy and network use

Only explicitly published files and search queries are sent to the configured server. Automatic upload, graph import and moving are off by default. No telemetry, analytics or third-party service is bundled. The client does not follow redirects. Use HTTPS or a trusted private network; an HTTP connection is not encrypted by this plugin. Keys are scoped by your server and managed using Obsidian's native SecretStorage.

Generated catalogs are excluded from upload to avoid loops. Files marked `weknora_sync: false` stay out of automatic publication. Manual publication is an explicit action. Graph exports must be authorized for the selected knowledge base.

## Development

```sh
npm test
npm run build
npm run check
```

There are no npm runtime or build dependencies. The build bundles local modules only. Tests cover request failure, duplicate prevention, guarded replacement, rename recovery, native-secret errors, persistent UI, graph ownership and concurrent edits. Unit tests do not prove compatibility with every WeKnora version; run the [manual acceptance checklist](docs/acceptance.md) against a disposable knowledge base.

See [中文说明](README.zh-CN.md), [contributing](CONTRIBUTING.md), [security](SECURITY.md) and [changelog](CHANGELOG.md). Licensed under [MIT](LICENSE).
