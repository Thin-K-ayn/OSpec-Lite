# 仓库地图

## 主代码目录
结论：
- 待补充：列出真正承载大厅核心代码的目录。
证据文件：
- `Assets/_GameCenter/ClientLua`
- `Assets/_GameCenter/FrameWork`
- `Assets/_GameCenter/LuaFramework`
- `Assets/_GameCenter/_Resources`
确认状态：
- 待确认
未确认点：
- 待补充：是否还有必须纳入核心地图的主目录？

## 目录职责导航
结论：
- 待补充：说明 `_GameCenter`、`_GameModule`、`_GameWrap`、`Channel`、`UnityInterface` 分别负责什么。
证据文件：
- `Assets/_GameCenter`
- `Assets/_GameModule`
- `Assets/_GameWrap`
- `Channel`
- `UnityInterface`
确认状态：
- 待确认
未确认点：
- 待补充：什么时候应该停留在大厅文档里，什么时候应该切去子游戏仓库的 `AGENTS.md` 或 `CLAUDE.md`？

## 改动导航
结论：
- 待补充：按启动、主流程、网络、热更、原生边界等维度整理主要改动入口。
证据文件：
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`
- `Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua`
- `Assets/_GameCenter/FrameWork/Common/Client.cs`
确认状态：
- 待确认
未确认点：
- 待补充：是否还有常见改动热点没有纳入这张地图？

## 非核心区域
结论：
- 待补充：列出通常不应该写进大厅核心叙事的目录。
证据文件：
- `Assets/Editor`
- `Assets/_GameWrap/Generate`
- `Assets/Common/Unity-Logs-Viewer/Reporter/Test`
- `Tools`
确认状态：
- 待确认
未确认点：
- 待补充：是否还有其他需要明确排除的区域？
