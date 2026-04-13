# Claude Code Project Memory

{{managedStart}}
## Shared Instructions Import

@AGENTS.md

## Claude Code Notes

- 如果用户要求“用 unity-tolua-hall profile 初始化”，且仓库还没有 `.oslite/config.json`，先推断项目名并向用户确认，再运行 `oslite init --profile unity-tolua-hall --project-name "<项目名>" --bootstrap-agent claude-code .`；如果当前环境并不确定，则改用 `none`。
- 先读 @{{authoringPackRoot}}/fill-project-docs.md。
- 先补 @{{authoringPackRoot}}/evidence-map.md，再回填 `.oslite/docs/project/*` 与 `.oslite/docs/agents/*`。
- 对本 profile，默认从 `Launch.cs`、`Main.cs`、`Main.lua` 建立大厅启动链认知。
- 如果用户已经知道项目名，也可以直接把这句发给 agent：`帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。项目名称是 XXXX（这里记得填一下，不填估计它会自己乱写）。`
{{managedEnd}}
