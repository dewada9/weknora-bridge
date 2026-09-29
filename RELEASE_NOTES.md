First public preview of WeKnora Bridge for Obsidian desktop.

### Included

- Native Obsidian SecretStorage configuration and a recovery/settings entry that remains available when a key is missing.
- Explicit note/file publication, parsing status, guarded updates and stable document associations.
- Optional completed-file archiving with collision protection and interrupted-move recovery.
- Optional source-linked catalog/graph import.
- MIT license, source, documentation and 51 automated tests.

### Install

Requires Obsidian 1.11.4+ on desktop. Download `weknora-bridge-1.3.0-plugin.zip`, extract `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/weknora-bridge/`, enable the plugin and configure your own server, knowledge-base ID and scoped key. Automatic features are off by default. Do not install a second copy over an existing deployment without backing up and migrating its association records.

### Compatibility limits

This is a **preview**, not an official community-directory release. Windows has been tested; other platforms are not certified and mobile is disabled. Continuous in-place updates require the documented guarded replacement API extension. Catalog/graph import requires an authenticated snapshot extension. These extensions are not bundled with this client; stock WeKnora installations must verify the [API contract](https://github.com/dewada9/weknora-bridge/blob/main/docs/server-compatibility.md) before enabling the relevant features.

No private deployment configuration, credentials, real vault contents or runtime association files are included. SHA256 values for the source and plugin archives are in `checksums.json`.

---

首个公开预览版：支持原生密钥存储、笔记发布、同 ID 更新、解析完成后归档及断点恢复。请先阅读中英文 README 和服务器接口要求；本版尚未上架 Obsidian 官方社区，不能视为兼容所有原版 WeKnora 的即装即用版本。
