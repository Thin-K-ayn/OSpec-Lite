# 架构总览

## 宿主启动链
结论：
- 待补充：说明 Unity 场景启动、宿主初始化、LuaFramework 初始化的真实顺序。
证据文件：
- `Assets/_GameCenter/Root/root.unity`
- `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`
- `Assets/_GameCenter/LuaFramework/Scripts/Main.cs`
- `Assets/_GameCenter/ClientLua/Main.lua`
确认状态：
- 待确认
未确认点：
- 待补充：是否存在更早的引导场景或平台侧启动器？

## Lua 初始化与大厅进入链
结论：
- 待补充：说明 `Main.lua`、`CC.lua`、`HallCenter.lua`、`ViewManager.CommonEnterMainScene()` 是如何协作的。
证据文件：
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/CC.lua`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
确认状态：
- 待确认
未确认点：
- 待补充：登录前初始化与加载完成后大厅正式运行的分界点在哪里？

## 大厅运行链
结论：
- 待补充：说明大厅运行时状态、视图管理、通知、计时器、网络之间的协同关系。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
确认状态：
- 待确认
未确认点：
- 待补充：哪些 manager 是全程常驻的，哪些只在局部流程中临时存在？

## 进入子游戏与回大厅链
结论：
- 待补充：说明大厅如何进入子游戏、加载模块、释放大厅状态，并在回大厅后恢复运行。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/LuaFramework/Scripts/Manager/NEO_PARTY_GAMES_GameManager.cs`
- `Assets/_GameModule`
确认状态：
- 待确认
未确认点：
- 待补充：子游戏架构中哪些部分仍归大厅仓库说明，哪些应转到目标子游戏仓库的 `AGENTS.md` 或 `CLAUDE.md`？

## 层级与边界
结论：
- 待补充：概括大厅 Lua、宿主 C#、原生桥接、打包层、SDK 集成之间的边界。
证据文件：
- `Assets/_GameCenter/FrameWork/Common/Client.cs`
- `Channel`
- `UnityInterface`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
确认状态：
- 待确认
未确认点：
- 待补充：哪些边界属于核心运行时路径，哪些只是外围集成？
