# Agent Guide

{{managedStart}}
## What This Repo Is

- Profile: `{{profileId}}`
- 这是 Unity + ToLua 游戏仓库的读库与文档工作流入口。
- 对本 profile，默认把 `Script/MJGame.lua` 作为主入口起点。
- 如果用户要求“用 unity-tolua-game profile 初始化”，但仓库还没有 `.oslite/config.json`，先推断项目名并向用户确认；如果用户给了工程路径，就在该 `<repo-root>` 上运行 `oslite init --profile unity-tolua-game --project-name "<项目名>" --bootstrap-agent <当前环境或 none> "<repo-root>"`；只有当前工作目录已经是目标工程根目录且用户没有给路径时，才用 `.`。
- 先完成 `{{authoringPackRoot}}/evidence-map.md`，再回填正式项目文档。
- 如果用户已经知道项目名，也可以直接这样触发：`工程路径是 XXXX（建议填绝对路径）。帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify XXXX。项目名称是 YYYY（这里记得填一下，不填估计它会自己乱写）。`

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
