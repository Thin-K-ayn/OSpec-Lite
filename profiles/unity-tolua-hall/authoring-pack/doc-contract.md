# 文档契约

## 目标

- 为 Unity + ToLua 大厅仓库产出一套真正有助于后续读库、补文档与 code review 的项目文档。
- 让后续 agent 能快速定位大厅启动链、主流程、热更链路、网络链路、子游戏切换边界与高风险改动点。

## 文档范围

- `AGENTS.md`
- `CLAUDE.md`
- `.oslite/docs/project/*`
- `.oslite/docs/agents/*`
- `.oslite/docs/agents/authoring/*`

## 工作方式

- 先读 `project-brief.md`、`repo-reading-checklist.md`，再补 `evidence-map.md`。
- 先把证据写进 `evidence-map.md`，再根据证据回填正式项目文档。
- 默认从 `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`、`Assets/_GameCenter/LuaFramework/Scripts/Main.cs`、`Assets/_GameCenter/ClientLua/Main.lua` 建立大厅启动链。
- 如果任务进入子游戏逻辑，先切到 `Assets/_GameModule/<game>/` 并阅读该子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`。

## 关键写作规则

- 所有不能从代码直接确认的结论，都要标记为 `推断` 或 `待确认`。
- 正式项目文档中的核心部分统一使用：`结论 / 证据文件 / 确认状态 / 未确认点`。
- 非 Editor 的运行时 C# 修改属于高风险改动，文档里要明确这类改动默认需要先征求用户许可。
- 涉及支付、订单、票据校验、出入款、收银台、渠道计费等真钱流程时，文档里要明确这是必须先和用户二次确认的区域。
- 如果新增 Lua 类、复杂 Lua 函数、或参数语义不清的函数，记得补 EmmyLua 注解要求。
- 大厅核心叙事应围绕 `Assets/_GameCenter/` 展开，不要把边界目录误写成主流程。

## 排除范围

- `Assets/Editor/`
- `Assets/_GameWrap/Generate/`
- `Assets/Common/Unity-Logs-Viewer/Reporter/Test/`
- 不影响大厅运行时的一次性工具目录、测试辅助目录、第三方插件内部实现
