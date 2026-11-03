# WeKnora Bridge 1.3.4

Complete readable naming across the automatic library: source cards use document titles, entity folders use source document titles, and entity notes use entity names. Short stable suffixes distinguish duplicates; original source IDs remain intact. Canvas title-first names from 1.3.3 remain supported.

Owned legacy files migrate through Obsidian native rename with backlink updates, including shortened Markdown links without extensions. Journals recover interrupted migrations. Manually edited notes retain their bodies and remain protected; unknown destinations are never overwritten. Only emptied old generated entity folders are removed.

73 automated tests pass, including concurrent manual edits during rename and edits after interrupted migration. Existing users can update through Community plugins; preserve data.json. Do not install a second copy alongside a custom deployment.

Desktop Obsidian 1.11.4+ required. Windows tested; macOS/Linux unverified; mobile disabled. Graph import requires the documented authenticated snapshot extension. Release assets contain no private deployment data or credentials.

---

补齐资料、实体文件夹和实体笔记的可读命名，不再只改简图。原生重命名更新链接，保留来源身份、手工正文和中断恢复状态；仅清理已空的旧自动目录。请保留原 data.json。
