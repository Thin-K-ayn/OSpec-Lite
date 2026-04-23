使用仓库内置的 OSpec Lite authoring pack 来初始化或补全文档。

1. 如果仓库还没有按 `unity-tolua-hall` 初始化，先根据仓库内容推断项目名，并向用户确认后再运行 `oslite init`。
2. 如果用户已经给了明确的工程路径，记为 `<repo-root>`；否则默认当前工作目录就是目标工程根目录，也就是 `<repo-root>`。
3. 项目名确认后，默认把 bootstrap agent 设为 `claude-code`，并运行 `oslite init --profile unity-tolua-hall --project-name "<project-name>" --bootstrap-agent claude-code "<repo-root>"`。
4. 如果仓库已经初始化，不要重复运行 `init`。
5. 先读 `{{authoringPackRoot}}/fill-project-docs.md`。
6. 再读 `{{authoringPackRoot}}/project-brief.md` 与 `{{authoringPackRoot}}/repo-reading-checklist.md`。
7. 在动正式文档前，先补 `{{authoringPackRoot}}/evidence-map.md`。
8. 根据证据回填 `AGENTS.md`、`CLAUDE.md`、`{{docsRoot}}/*`、`{{agentDocsRoot}}/*`。
9. 所有不能从代码确认的结论，标记为 `推断` 或 `待确认`。
10. 如果任务进入子游戏逻辑，先切到 `Assets/_GameModule/<game>/`，再读该子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`。
11. 在停止前运行 `oslite docs verify "<repo-root>"`，前提是环境里有这个命令。

如果用户已经知道项目名，也可以用下面这句直接触发：

```text
安装并阅读 npm package ospec-lite。如果当前仓库还没用 oslite init 过，则帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。
```
