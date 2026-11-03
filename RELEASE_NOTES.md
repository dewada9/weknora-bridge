# WeKnora Bridge 1.3.2

Fix parsing-status refresh stopping on the first missing remote document (HTTP 404). Refresh now continues for other documents, shows a single summary and per-file errors, and retains missing-document identities and local files for review. Source identity is checked; existing sync conflicts are preserved. Network, authentication and rate-limit failures stop further requests in that refresh.

58 automated tests pass. Existing users can update from the Obsidian Community plugin settings. Manual installation: extract the three plugin files from `weknora-bridge-1.3.2-plugin.zip`, preserving existing `data.json`. Do not enable a second copy alongside a custom installation.

Requires Obsidian 1.11.4+ desktop. Windows tested; macOS/Linux unverified; mobile disabled. Public HTTPS setup and server extension requirements remain as documented. No private deployment configuration or credentials are included.

---

修复“刷新解析状态”遇到单篇 404 后中断：继续检查其他文档，逐篇显示错误，汇总结果，保留原关联和本地资料，不盲目重传。网络、鉴权或限流失败会停止本轮剩余请求。请保留原 data.json，并阅读服务器兼容要求。
