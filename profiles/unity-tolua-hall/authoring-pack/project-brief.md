# 项目简报

## 基础信息
- 项目名称：`{{projectName}}`
- 文档语言：`{{documentLanguage}}`
- Profile：`{{profileId}}`
- Bootstrap Agent：`{{bootstrapAgent}}`

## 主代码目录候选
- `Assets/_GameCenter/ClientLua/`
- `Assets/_GameCenter/FrameWork/`
- `Assets/_GameCenter/LuaFramework/`
- `Assets/_GameCenter/_Resources/`

## 明确排除目录
- `Assets/Editor/`
- `Assets/_GameWrap/Generate/`
- `Assets/Common/Unity-Logs-Viewer/Reporter/Test/`

## 已知入口提示
- 宿主启动基线：`Assets/_GameCenter/FrameWork/Behaviours/Launch.cs` -> `Assets/_GameCenter/LuaFramework/Scripts/Main.cs` -> `Assets/_GameCenter/ClientLua/Main.lua`
- 场景基线：`Assets/_GameCenter/Root/root.unity` 与 `Assets/_GameCenter/_Resources/HallScene/main.unity`

## 其他项目提示
- 大厅核心叙事默认围绕 `Assets/_GameCenter/` 展开。
- 这个 profile 对应的是大厅仓库本体；单个子游戏模块默认位于 `Assets/_GameModule/<game>/`。
- 如果任务进入子游戏逻辑，先读对应子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`，再决定如何写文档或改代码。
- 非 Editor 的运行时 C# 修改通常会导致 APK 重新发布，因此 agent 默认需要先征求用户明确许可。
- `Assets/Editor/` 这类明确的 Editor-only 范围是主要例外；如果用户明确就是要改它，可以不额外二次确认。
- 这个大厅仓库承担真钱支付职责；凡是触及支付、订单、票据校验、出入款、收银台、渠道计费等链路，都必须先和用户二次确认。
- `Assets/_GameModule/`、`Channel/`、`UnityInterface/`、`Tools/` 默认是边界区域，只有在代码证明它们属于当前任务时才展开。
- 所有尚未从代码确认的结论，都必须标记为 `推断` 或 `待确认`。
