# 入口总览

## 宿主启动入口
结论：
- 待补充：说明宿主侧启动锚点是什么，以及为什么它是大厅启动链的起点。
证据文件：
- `Assets/_GameCenter/Root/root.unity`
- `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`
- `Assets/_GameCenter/LuaFramework/Scripts/Main.cs`
- `Assets/_GameCenter/ClientLua/Main.lua`
确认状态：
- 待确认
未确认点：
- 待补充：如果还有比 `root.unity` 更早的入口，请在这里补充。

## Lua 启动入口
结论：
- 待补充：说明 `Main.lua` 如何进入 `GameInit / GameStart`，以及 `CC.Init()` 如何装配大厅运行模块。
证据文件：
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/CC.lua`
确认状态：
- 待确认
未确认点：
- 待补充：是否还存在额外 Lua bootstrap、热更入口或平台注入入口？

## 大厅主流程入口
结论：
- 待补充：说明登录、大厅主场景进入、主视图启动真正从哪里开始。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/_Resources/HallScene/main.unity`
确认状态：
- 待确认
未确认点：
- 待补充：哪些 view 是真正流程入口，哪些只是后续功能页？

## 网络入口
结论：
- 待补充：说明长连生命周期、请求发送、推送分发、重连路径的统一入口。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`
- `Assets/_GameCenter/FrameWork/IO/NEO_PARTY_GAMES_Launcher.cs`
确认状态：
- 待确认
未确认点：
- 待补充：是否还有并行 HTTP、平台网络或支付网络入口需要补充？

## 资源与热更入口
结论：
- 待补充：说明大厅热更、资源下载、AssetBundle 重载、路径基线的入口。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua`
- `Assets/_GameCenter/LuaFramework/Scripts/Manager/NEO_PARTY_GAMES_GameManager.cs`
- `Assets/_GameCenter/LuaFramework/Scripts/Common/NEO_PARTY_GAMES_AppConst.cs`
确认状态：
- 待确认
未确认点：
- 待补充：大厅资源与子游戏资源之间的边界还有哪些证据缺口？

## 进入子游戏与回大厅入口
结论：
- 待补充：说明 `EnterGame`、切场景、回大厅、资源重置的关键入口，以及何时应转交子游戏仓库说明。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/LuaFramework/Scripts/Manager/NEO_PARTY_GAMES_GameManager.cs`
- `Assets/_GameModule`
确认状态：
- 待确认
未确认点：
- 待补充：哪些子游戏入口细节仍由大厅仓库负责，哪些应来自目标子游戏仓库的 `AGENTS.md` 或 `CLAUDE.md`？
