# Agent Guide

{{managedStart}}
## What This Repo Is

- Profile: `{{profileId}}`
- 这是 Unity + ToLua 游戏仓库的读库与文档工作流入口。
- 对本 profile，默认把 `Script/MJGame.lua` 作为主入口起点。
- 如果用户要求“用 unity-tolua-game profile 初始化”，但仓库还没有 `.oslite/config.json`，先推断项目名并向用户确认，再运行 `oslite init --profile unity-tolua-game --project-name "<项目名>" --bootstrap-agent <当前环境或 none> .`。
- 先完成 `{{authoringPackRoot}}/evidence-map.md`，再回填正式项目文档。

## Hard Rules

- 先读仓库，再写文档；不要照抄初始化模板或扫描结果。
- 所有不能从代码确认的结论，必须标记为 `推断` 或 `待确认`。
- 不要把临时目录、辅助目录、一次性工具目录当成核心项目结构。
- 文档语言以中文为主，保留英文代码名、类名、目录名。

## High-Risk Areas

- `Script/MJGame.lua`：主入口锚点，启动链判断从这里开始。
- `{{authoringPackRoot}}/project-brief.md`：repo 特有上下文，写文档前先核对。
- `{{authoringPackRoot}}/evidence-map.md`：正式文档的证据底稿，先写这里再写最终文档。
- `{{docsRoot}}/entrypoints.md`：入口判断最容易写错，必须用真实代码证据回填。

## Read Next

- `{{authoringPackRoot}}/fill-project-docs.md`
- `{{authoringPackRoot}}/doc-contract.md`
- `{{authoringPackRoot}}/project-brief.md`
- `{{authoringPackRoot}}/repo-reading-checklist.md`
- `{{authoringPackRoot}}/evidence-map.md`
{{managedEnd}}
