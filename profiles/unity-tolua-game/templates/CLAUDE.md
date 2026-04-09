# Claude Code Project Memory

{{managedStart}}
## Shared Instructions Import

@AGENTS.md

## Claude Code Notes

- 如果用户要求“用 unity-tolua-game profile 初始化”，且仓库还没有 `.oslite/config.json`，先推断项目名并运行 `oslite init --profile unity-tolua-game --project-name "<项目名>" --bootstrap-agent claude-code .`；如果当前环境并不确定，则改用 `none`。
- 先读 @{{authoringPackRoot}}/fill-project-docs.md。
- 先补 @{{authoringPackRoot}}/evidence-map.md，再回填 `docs/project/*` 与 `docs/agents/*`。
- 对本 profile，默认从 `Script/MJGame.lua` 开始建立启动链认知。
{{managedEnd}}
