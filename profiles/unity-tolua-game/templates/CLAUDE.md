# Claude Code Project Memory

{{managedStart}}
## Shared Instructions Import

@AGENTS.md

## Claude Code Notes

- 如果用户要求“用 unity-tolua-game profile 初始化”，且仓库还没有 `.oslite/config.json`，先推断项目名并向用户确认；如果用户给了明确的工程路径，就在该 `<repo-root>` 上运行 `oslite init --profile unity-tolua-game --project-name "<项目名>" --bootstrap-agent claude-code "<repo-root>"`；如果当前环境并不确定，则改用 `none`。否则默认当前工作目录就是目标工程根目录。
- 先读 @{{authoringPackRoot}}/fill-project-docs.md。
- 先补 @{{authoringPackRoot}}/evidence-map.md，再回填 `.oslite/docs/project/*` 与 `.oslite/docs/agents/*`。
- 对本 profile，默认从 `Script/MJGame.lua` 开始建立启动链认知。
- 如果用户已经知道项目名，也可以直接把这句发给 agent：`安装并阅读 npm package ospec-lite。如果当前仓库还没用 oslite init 过，则帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。`
{{managedEnd}}
