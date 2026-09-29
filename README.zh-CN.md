# WeKnora Bridge

把 Obsidian 中选定的笔记和附件发布到自己的 WeKnora，持续更新原文档，并在解析完成后整理到已入库目录。独立社区项目，不代表 Obsidian 或腾讯官方。

## 当前边界

- 已在 Windows 桌面验收；本版不支持手机。macOS/Linux 尚未实机验证。
- 需要 Obsidian 1.11.4 或更新版本，API 密钥由 Obsidian 原生 SecretStorage 管理，不再调用 PowerShell 或读取固定磁盘上的 DPAPI 文件。
- **持续更新原文需要服务器的条件式替换接口，图谱导入需要受鉴权的快照接口。** 不承诺原版 WeKnora 安装后即可使用全部功能。参见 [接口契约](docs/server-compatibility.md)。
- 这是发布同步，不是 NAS 文件同步，也不是远端原文双向编辑器。

## 使用

1.3.0 已通过社区审核。打开 [官方社区页面](https://community.obsidian.md/plugins/weknora-bridge)，点击 **Add to Obsidian** 安装。也可在 [1.3.0 发布页面](https://github.com/dewada9/weknora-bridge/releases/tag/1.3.0) 下载安装包，解压三个文件到 `.obsidian/plugins/weknora-bridge`。

如需从源码构建：运行 `npm test`、`npm run build`，把 dist 下三个发布文件放入笔记库的 `.obsidian/plugins/weknora-bridge`，启用插件。

设置中输入服务地址和知识库 ID，使用“API 密钥”选择或创建密钥，点击“保存并连接”。可随时从命令面板运行“配置连接 / 修复密钥”；凭据丢失不会让设置和右键菜单消失。

自动功能默认关闭。自行确认待入库和已入库目录后，开启自动上传；需要时再开启“解析完成后移到已入库”。普通草稿留在原处。单篇笔记用 `weknora_sync: true` 选择发布，`false` 排除自动发布。

只有远端解析完成且本地正文未改变的待入库文件才移动；同名不覆盖，移动保留文档 ID。已入库笔记继续编辑会更新同一文档，删除本地文件不会删除服务器文档。路径更新可能触发一次额外解析。Obsidian 关闭期间暂停，重新打开后继续。

不要公开真实的 data.json、密钥、私有服务器地址或知识库资料。备份同步记录后再迁移设备，并在新设备重新设置密钥。开源项目不包含任何真实环境配置。

社区审核通过不代表兼容所有服务器和平台。使用前请按 [验收清单](docs/acceptance.md) 核验自己的目标服务器。
