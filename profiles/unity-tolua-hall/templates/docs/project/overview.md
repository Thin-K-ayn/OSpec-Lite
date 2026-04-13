# 项目概览

## 项目是什么
结论：
- 待补充：说明这是一个怎样的大厅 / 宿主仓库，以及它通常承担哪些职责。
证据文件：
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/CC.lua`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
确认状态：
- 待确认
未确认点：
- 待补充：哪些职责应该写进大厅核心叙事，哪些只应作为边界说明？

## 正式主区
结论：
- 待补充：总结大厅核心、宿主层、LuaFramework、子游戏支撑层、外部边界之间的正式拆分。
证据文件：
- `Assets/_GameCenter`
- `Assets/_GameModule`
- `Channel`
- `UnityInterface`
确认状态：
- 待确认
未确认点：
- 待补充：子游戏相关行为哪些该留在大厅文档里，哪些应该直接引导读者去对应子游戏仓库的 `AGENTS.md` 或 `CLAUDE.md`？

## 主流程
结论：
- 待补充：概括从宿主启动、登录 / 进入大厅，到进入子游戏 / 回大厅的真实顶层流程。
证据文件：
- `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`
- `Assets/_GameCenter/LuaFramework/Scripts/Main.cs`
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
确认状态：
- 待确认
未确认点：
- 待补充：重连、热更、自动进入等侧流程中，哪些需要单独拉出来说明？

## 首次读库建议
结论：
- 待补充：给新工程师一个最小但有效的大厅读库顺序，并说明何时需要切到子游戏仓库。
证据文件：
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`
- `Assets/_GameModule`
确认状态：
- 待确认
未确认点：
- 待补充：哪些目录只在特定任务下才需要展开，可以推迟阅读？
