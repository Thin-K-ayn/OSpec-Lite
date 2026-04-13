使用仓库内置的 OSpec Lite authoring pack 来初始化或补全文档。

1. 如果仓库还没有按 `unity-tolua-hall` 初始化，先根据仓库内容推断项目名，并向用户确认后再运行 `oslite init`。
2. 项目名确认后，默认把 bootstrap agent 设为 `claude-code`，并运行 `oslite init --profile unity-tolua-hall --project-name "<project-name>" --bootstrap-agent claude-code .`。
3. 如果仓库已经初始化，不要重复运行 `init`。
4. 先读 `{{authoringPackRoot}}/fill-project-docs.md`。
5. 再读 `{{authoringPackRoot}}/project-brief.md` 与 `{{authoringPackRoot}}/repo-reading-checklist.md`。
6. 在动正式文档前，先补 `{{authoringPackRoot}}/evidence-map.md`。
7. 根据证据回填 `AGENTS.md`、`CLAUDE.md`、`{{docsRoot}}/*`、`{{agentDocsRoot}}/*`。
8. 所有不能从代码确认的结论，标记为 `推断` 或 `待确认`。
9. 如果任务进入子游戏逻辑，先切到 `Assets/_GameModule/<game>/`，再读该子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`。
10. 在停止前运行 `oslite docs verify .`，前提是环境里有这个命令。

如果用户已经知道项目名，也可以用下面这句直接触发：

```text
帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。项目名称是 XXXX（这里记得填一下，不填估计它会自己乱写）。
```
