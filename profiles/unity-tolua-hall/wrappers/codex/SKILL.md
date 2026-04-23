---
name: oslite-fill-project-docs
description: Initialize or continue OSpec Lite project documentation for a Unity + ToLua hall repository. Use when Codex should adopt the unity-tolua-hall profile, confirm the inferred project name with the user, run oslite init when needed, then fill evidence-first docs and finish with docs verification.
---

# OSpec Lite 项目文档

遵循仓库内置的 authoring pack，而不是自行发明一套新流程。

1. 如果仓库还没有按 `unity-tolua-hall` 初始化，先根据仓库内容推断项目名，并向用户确认后再运行 `oslite init`。
2. 如果用户已经给了工程路径，记为 `<repo-root>`；如果当前工作目录已经是目标工程根目录，才把 `<repo-root>` 视为 `.`。
3. 项目名确认后，默认把 bootstrap agent 设为 `codex`，并运行 `oslite init --profile unity-tolua-hall --project-name "<project-name>" --bootstrap-agent codex "<repo-root>"`。
4. 如果仓库已经初始化，不要重复运行 `init`。
5. 先读 `{{authoringPackRoot}}/fill-project-docs.md`。
6. 再读 `{{authoringPackRoot}}/project-brief.md` 与 `{{authoringPackRoot}}/repo-reading-checklist.md`。
7. 在动正式文档前，先补 `{{authoringPackRoot}}/evidence-map.md`。
8. 以 `{{authoringPackRoot}}/doc-contract.md` 作为输出契约。
9. 根据证据回填 `AGENTS.md`、`CLAUDE.md`、`{{docsRoot}}/*`、`{{agentDocsRoot}}/*`，不要凭模板臆测。
10. 所有不能从代码确认的结论，标记为 `推断` 或 `待确认`。
11. 如果任务进入子游戏逻辑，先切到 `Assets/_GameModule/<game>/`，再读该子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`。
12. 不要把 `Assets/Editor/`、`Assets/_GameWrap/Generate/`、测试场景、一次性工具目录写进大厅核心叙事，除非仓库明确把它们视为一等架构。
13. 在停止前运行 `oslite docs verify "<repo-root>"`，前提是环境里有这个命令。

如果用户已经知道项目名，也可以用下面这句直接触发：

```text
工程路径是 XXXX（建议填绝对路径）。帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify XXXX。项目名称是 YYYY（这里记得填一下，不填估计它会自己乱写）。
```
