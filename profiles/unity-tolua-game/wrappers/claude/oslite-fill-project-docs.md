Use the repo-local OSpec Lite authoring pack to initialize or fill project documentation.

1. If the repo is not initialized for `unity-tolua-game`, infer the project name from the repo and ask the user to confirm it before running `oslite init`.
2. If the user already gave you a repo path, treat it as `<repo-root>`; only use `.` when the current working directory is already the target repo root.
3. Once the project name is confirmed, default the bootstrap agent to `claude-code` and run `oslite init --profile unity-tolua-game --project-name "<project-name>" --bootstrap-agent claude-code "<repo-root>"`.
4. If the repo is already initialized, do not rerun `init`.
5. Read `{{authoringPackRoot}}/fill-project-docs.md` first.
6. Read `{{authoringPackRoot}}/project-brief.md` and `{{authoringPackRoot}}/repo-reading-checklist.md`.
7. Fill `{{authoringPackRoot}}/evidence-map.md` before editing the final docs.
8. Update `AGENTS.md`, `CLAUDE.md`, `{{docsRoot}}/*`, and `{{agentDocsRoot}}/*` from evidence.
9. Mark uncertain conclusions as `推断` or `待确认`.
10. If `$ARGUMENTS` is provided, treat it as the priority area to inspect first, but still keep the final docs globally consistent.
11. Run `oslite docs verify "<repo-root>"` before stopping when the command is available in the environment.

If the user already knows the project name, they can trigger this profile with:

```text
工程路径是 XXXX（建议填绝对路径）。帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify XXXX。项目名称是 YYYY（这里记得填一下，不填估计它会自己乱写）。
```
