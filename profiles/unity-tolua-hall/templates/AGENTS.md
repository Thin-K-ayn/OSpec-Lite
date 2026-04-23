# Agent Guide

{{managedStart}}
## What This Repo Is

- Profile: `{{profileId}}`
- 这是 Unity + ToLua 大厅仓库的读库与文档工作流入口。
- 这个 profile 描述的是大厅仓库本体；单独子游戏模块默认位于 `Assets/_GameModule/<game>/`。
- 对本 profile，默认从 `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`、`Assets/_GameCenter/LuaFramework/Scripts/Main.cs`、`Assets/_GameCenter/ClientLua/Main.lua` 建立启动链认知。
- 如果用户要求“用 unity-tolua-hall profile 初始化”，但仓库还没有 `.oslite/config.json`，先推断项目名并向用户确认；如果用户给了明确的工程路径，就在该 `<repo-root>` 上运行 `oslite init --profile unity-tolua-hall --project-name "<项目名>" --bootstrap-agent <当前环境或 none> "<repo-root>"`；否则默认当前工作目录就是目标工程根目录。
- 先完成 `{{authoringPackRoot}}/evidence-map.md`，再回填正式项目文档。
- 如果用户已经知道项目名，也可以直接这样触发：`安装并阅读 npm package ospec-lite。如果当前仓库还没用 oslite init 过，则帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。`

## Hard Rules

- 先读仓库，再写文档；不要照抄初始化模板或扫描结果。
- 所有不能从代码确认的结论，必须标记为 `推断` 或 `待确认`。
- 默认把 `Assets/_GameCenter/` 视为大厅核心区。
- 如果任务依赖子游戏逻辑，优先进入 `Assets/_GameModule/<game>/`，并先读该子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`。
- 非 Editor 的运行时 C# 修改默认需要先征求用户明确许可，因为这类改动通常需要重新发 APK。
- 只有在用户明确要求改 C#，或者目标文件明确属于 `Assets/Editor/` 这类 Editor-only 范围时，才可以跳过这一步额外确认。
- 只要改动触及支付、订单、票据校验、出入款、收银台或渠道计费等真钱流程，就必须先和用户二次确认改动意图。
- `_GameWrap`、`Channel`、`UnityInterface`、`Tools` 这类边界目录，只有在代码证明它们属于当前任务时才展开。
- 不要把生成代码、Editor-only 目录、测试场景、一次性工具目录写进大厅核心叙事，除非任务确实依赖它们。

## High-Risk Areas

- `Assets/_GameCenter/ClientLua/Main.lua`：大厅 Lua 主入口，`GameInit / GameStart` 从这里起。
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`：大厅启动编排、宿主到 Lua 的通知桥接。
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`：登录、大厅进入、子游戏进入、回大厅的流程协调点。
- `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`：大厅长连、重连、请求分发。
- `Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua`：大厅热更、下载、资源重载。
- 支付、收银台、订单、票据校验、渠道计费相关链路：即使表面看起来只是小改动，也要先和用户确认。
- `{{authoringPackRoot}}/project-brief.md`：仓库特有上下文，写文档前先核对。
- `{{authoringPackRoot}}/evidence-map.md`：正式文档的证据底稿，先写这里再写最终文档。

## Read Next

- `{{authoringPackRoot}}/fill-project-docs.md`
- `{{authoringPackRoot}}/doc-contract.md`
- `{{authoringPackRoot}}/project-brief.md`
- `{{authoringPackRoot}}/repo-reading-checklist.md`
- `{{authoringPackRoot}}/evidence-map.md`
{{managedEnd}}
