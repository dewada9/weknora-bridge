# WeKnora Bridge 1.3.3

Generated Canvas files now start with the source document title, followed by a short stable disambiguator, instead of a hash-only filename. Unsafe filename characters are sanitized. Document/entity identities and graph direction remain unchanged.

Existing owned, unchanged Canvas files migrate through Obsidian native rename so backlinks follow. A migration journal supports recovery after interrupted renames, including later title changes. Hand-edited files, unknown files and destination collisions are preserved and reported for review. Derived graph files remain excluded from upload.

65 automated tests pass, including readable names, duplicate titles, migration, backlink updates, collisions and crash recovery. Existing users can update via Community plugins. Manual installation: extract the three plugin files from `weknora-bridge-1.3.3-plugin.zip`, preserving data.json. Do not enable a second copy alongside a custom deployment.

Requires desktop Obsidian 1.11.4+. Windows tested; macOS/Linux unverified; mobile disabled. Graph import requires the documented authenticated snapshot server extension. No private addresses, credentials, association files or user content are included.

---

简图改为“资料标题 - 短标识.canvas”，侧栏可直接辨认内容。旧自动文件通过原生重命名迁移并更新链接；人工编辑、重名冲突保留并提示。迁移中断可恢复，继续保留来源身份、图谱方向和自动目录不回传保护。
