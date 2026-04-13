# 仓库阅读清单

## 顶层结构
- 确认 `Assets/_GameCenter/` 是否真的是大厅核心区。
- 区分 `ClientLua/`、`FrameWork/`、`LuaFramework/`、`_Resources/` 各自的职责。
- 确认单独子游戏模块是否挂在 `Assets/_GameModule/<game>/`。
- 如果任务需要子游戏代码，先读目标子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`，再判断其流程。
- 给 `_GameModule`、`_GameWrap/Generate`、`Channel`、`UnityInterface`、`Tools` 标记它们属于子游戏、生成代码、打包、原生桥接还是工具边界。

## 启动与流程
- 以 `Assets/_GameCenter/ClientLua/Main.lua` 作为默认 Lua 启动锚点。
- 追踪宿主启动链：`Launch.cs` -> `Main.cs` -> `Main.lua`。
- 找出 `CC.Init()`、`HallCenter.InitBeforeLogin()`、`HallCenter.InitAfterLoading()`、`ViewManager.CommonEnterMainScene()` 的真实执行顺序。
- 确认登录、大厅进入、子游戏进入、回大厅、重连等流程真正发生在哪里。

## 资源与网络
- 在 `Network.lua` 与 `NEO_PARTY_GAMES_Launcher.cs` 中确认大厅长连入口、请求/推送分发、重连路径。
- 在 `ResDownloadManager.lua` 与 `NEO_PARTY_GAMES_GameManager.cs` 中确认热更、下载、资源重载、子游戏加载路径。
- 在 `NEO_PARTY_GAMES_AppConst.cs` 中确认路径、配置、热更基线。
- 如果仓库里有支付、订单、收银台、票据校验、渠道计费相关逻辑，尽早标记它们是需要用户二次确认的高风险区域。

## 生命周期
- 找出 pause / resume / back / 屏幕事件 / low-memory 是如何桥接进 Lua 的。
- 找出 view 清理、通知清理、timer、downloader、切场景清理是在哪里完成的。
- 确认进入子游戏与回大厅时，哪些资源会被释放，哪些状态会被重建。

## 边界与技术栈
- 识别 `Client.cs`、`Channel`、`UnityInterface`、Firebase、Facebook、Adjust、支付 SDK 等原生桥接或第三方边界。
- 确认仓库级技术栈信号：Unity、ToLua、protobuf、AssetBundle、宿主桥接。
- 留意 Lua 类、复杂 Lua 函数、参数语义不清的函数是否需要 EmmyLua 注解。
