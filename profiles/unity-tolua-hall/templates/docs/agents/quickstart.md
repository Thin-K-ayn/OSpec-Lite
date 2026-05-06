# 快速上手

## 推荐阅读顺序
1. `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`
2. `Assets/_GameCenter/LuaFramework/Scripts/Main.cs`
3. `Assets/_GameCenter/ClientLua/Main.lua`
4. `Assets/_GameCenter/ClientLua/CC.lua`
5. `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
6. `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
7. `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`
8. `Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua`

## 推荐搜索关键词
- `GameInit`
- `InitBeforeLogin`
- `CommonEnterMainScene`
- `EnterGame`
- `ReloadHallAssetBundles`
- `_hallServerTag`
- `NotificationToLua`
- `EmmyLua`

## Review 优先检查项
- 先检查启动链 `Launch.cs` -> `Main.cs` -> `Main.lua` 是否仍然成立。
- 检查大厅主流程职责是否仍然集中在 `HallCenter.lua` 与 `ViewManager.lua`。
- 检查 `Network.lua` 是否仍然正确处理 connect / reconnect / disconnect。
- 检查 `ResDownloadManager.lua` 与 `NEO_PARTY_GAMES_GameManager.cs` 是否仍然控制好更新 / 重载副作用。
- 检查新增 Lua 类、复杂 Lua 函数、参数语义不清的函数是否补了 EmmyLua 注解。
- 改打包内运行时 C# 前先征求用户明确许可；Editor-only 脚本是主要例外。
- 只要改动触及真钱支付、订单、票据校验、出入款、收银台、渠道计费，就先与用户二次确认。

## 工作汇报
- `oslite report . --cadence daily|weekly`：在终端生成当前 OSpec Lite 工作摘要。
- `oslite report write . --cadence daily|weekly`：在 `.oslite/reports/<cadence>/` 下写入 Markdown 和 JSON report artifacts。
- `oslite report schedule . --cadence daily|weekly`：写入仓库本地 report schedule；之后让 cron、CI 或 agent automation 反复执行 `oslite report run .`。

## 不要浪费时间的区域
- `Assets/Editor/`
- `Assets/_GameWrap/Generate/`
- `Assets/Common/Unity-Logs-Viewer/Reporter/Test/`
- 与当前任务无关的第三方插件内部实现
