# WeKnora Bridge 1.3.1

- Public domain/IP endpoints require HTTPS; private/loopback HTTP remains supported. Normal certificate verification is retained.
- Add a read-only connection test with latency and actionable DNS, port, TLS, key, permission, upload-size, rate-limit and reverse-proxy errors.
- Limit active file sync work to two files before reading contents. Connection setup is bounded to 15 seconds; request limit remains 90 seconds.
- Preserve stable document associations, guarded updates, uncertain-write reconciliation and manual-edit protection.
- 56 automated tests pass; English and Chinese setup instructions are updated.

## Install / upgrade

Use the [official community listing](https://community.obsidian.md/plugins/weknora-bridge), or Settings → Community plugins → Check for updates. Manual installation: extract `main.js`, `manifest.json` and `styles.css` from `weknora-bridge-1.3.1-plugin.zip` into `<vault>/.obsidian/plugins/weknora-bridge/`. Preserve existing `data.json` and configure your own secret. Do not enable a second copy alongside a custom deployment.

Obsidian 1.11.4+ desktop required. Windows tested; macOS/Linux unverified; mobile disabled. Continuous guarded updates and graph import require the documented [server extensions](https://github.com/dewada9/weknora-bridge/blob/main/docs/server-compatibility.md). Public service deployment and certificates are separate. Directory listing does not imply separate manual review of this update.

No private addresses, keys, association records or vault contents are included. Archive SHA-256 values are provided in `checksums.json`.

---

1.3.1：新增公网 HTTPS 校验、连接测试和明确报错，限制批量同步并发、缩短建连等待。已有社区版通过「检查更新」升级，请保留原同步关联。公网服务需自行部署，服务器扩展要求见接口文档。
