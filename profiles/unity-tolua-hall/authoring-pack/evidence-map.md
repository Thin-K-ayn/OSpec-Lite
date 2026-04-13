# 证据地图

## 核心区域判断
结论：
- 待补充：说明大厅核心是否真的集中在 `Assets/_GameCenter/`，以及 `_GameModule`、`Channel`、`UnityInterface`、`Tools` 应如何分类。
证据文件：
- `Assets/_GameCenter`
- `Assets/_GameModule`
- `Channel`
- `UnityInterface`
确认状态：
- 待确认
未确认点：
- 待补充：哪些边界应该进入最终大厅叙事，哪些应只作为旁注保留？什么时候应该切到子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`？

## 宿主启动链
结论：
- 待补充：追踪从 Unity 场景启动、宿主初始化到 Lua 准备完成的真实链路。
证据文件：
- `Assets/_GameCenter/Root/root.unity`
- `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`
- `Assets/_GameCenter/LuaFramework/Scripts/Main.cs`
- `Assets/_GameCenter/ClientLua/Main.lua`
确认状态：
- 待确认
未确认点：
- 待补充：是否存在更早的引导场景、平台启动器或宿主前置步骤？

## Lua 初始化与大厅进入链
结论：
- 待补充：说明 `Main.lua`、`CC.lua`、`HallCenter.lua`、`ViewManager.CommonEnterMainScene()` 的真实顺序与职责。
证据文件：
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/CC.lua`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/_Resources/HallScene/main.unity`
确认状态：
- 待确认
未确认点：
- 待补充：大厅进入前还有哪些初始化、下载、登录或宿主回调必须先完成？

## 大厅流程与视图切换
结论：
- 待补充：描述大厅常态流程、主视图栈，以及 replace/open/close 的协调点。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/ClientLua/View/ViewCenter.lua`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
确认状态：
- 待确认
未确认点：
- 待补充：哪些 view 是真正流程入口，哪些只是二级面板？

## 网络入口
结论：
- 待补充：说明大厅长连生命周期、请求链路、推送分发、重连路径、掉线回登录策略。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`
- `Assets/_GameCenter/FrameWork/IO/NEO_PARTY_GAMES_Launcher.cs`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
确认状态：
- 待确认
未确认点：
- 待补充：是否还存在并行 HTTP、平台网络或支付网络链路需要额外记录？

## 资源与热更入口
结论：
- 待补充：说明热更、资源下载、AssetBundle 重载、大厅资源基线、子游戏资源边界。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua`
- `Assets/_GameCenter/LuaFramework/Scripts/Manager/NEO_PARTY_GAMES_GameManager.cs`
- `Assets/_GameCenter/LuaFramework/Scripts/Common/NEO_PARTY_GAMES_AppConst.cs`
确认状态：
- 待确认
未确认点：
- 待补充：大厅资源与子游戏资源的切换边界到底在哪里？哪些改动会同时影响大厅与子游戏？

## 进入子游戏与回大厅
结论：
- 待补充：说明大厅如何进入子游戏、切场景、释放大厅资源、回大厅后重建状态。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/LuaFramework/Scripts/Manager/NEO_PARTY_GAMES_GameManager.cs`
- `Assets/_GameModule`
确认状态：
- 待确认
未确认点：
- 待补充：哪些子游戏切换步骤仍属于大厅职责，哪些应转交对应子游戏仓库文档说明？

## 外部边界与插件
结论：
- 待补充：列出原生桥接、渠道、社交、支付、统计、广告等外部边界。
证据文件：
- `Assets/_GameCenter/FrameWork/Common/Client.cs`
- `Channel`
- `UnityInterface`
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
确认状态：
- 待确认
未确认点：
- 待补充：哪些第三方 SDK 属于核心运行时依赖，哪些只是外围集成？支付相关模块具体分散在哪些边界目录？

## 技术栈特征
结论：
- 待补充：确认该仓库的主要技术栈特征，例如 Unity、ToLua、protobuf、AssetBundle、宿主桥接、生成链路。
证据文件：
- `Assets/_GameCenter/LuaFramework`
- `Assets/_GameCenter/ClientLua/Model/Network`
- `Assets/_GameCenter/FrameWork`
确认状态：
- 待确认
未确认点：
- 待补充：是否还有值得单独标记的框架、自定义生成链或支付基础设施？
