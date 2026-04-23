---
name: oslite-fill-project-docs
description: Initialize or continue OSpec Lite project documentation for a Unity + ToLua repository. Use when Codex should adopt the unity-tolua-game profile, confirm the inferred project name with the user, run oslite init when needed, then fill evidence-first docs and finish with docs verification.
---

# OSpec Lite Project Docs

Follow the repo-local authoring pack instead of inventing a new workflow.

1. If the repo is not initialized for `unity-tolua-game`, infer the project name from the repo and ask the user to confirm it before running `oslite init`.
2. If the user already gave you a repo path, treat it as `<repo-root>`; only use `.` when the current working directory is already the target repo root.
3. Once the project name is confirmed, default the bootstrap agent to `codex` and run `oslite init --profile unity-tolua-game --project-name "<project-name>" --bootstrap-agent codex "<repo-root>"`.
4. If the repo is already initialized, do not rerun `init`.
5. Read `{{authoringPackRoot}}/fill-project-docs.md` first.
6. Read `{{authoringPackRoot}}/project-brief.md` and `{{authoringPackRoot}}/repo-reading-checklist.md`.
7. Fill `{{authoringPackRoot}}/evidence-map.md` before editing the final docs.
8. Use `{{authoringPackRoot}}/doc-contract.md` as the output contract.
9. Update `AGENTS.md`, `CLAUDE.md`, `{{docsRoot}}/*`, and `{{agentDocsRoot}}/*` from evidence, not from guesses.
10. Mark uncertain conclusions as `推断` or `待确认`.
11. Keep temporary or helper directories out of the core project narrative unless the repo clearly treats them as first-class architecture.
12. Run `oslite docs verify "<repo-root>"` before stopping when the command is available in the environment.

If the user already knows the project name, they can trigger this profile with:

```text
工程路径是 XXXX（建议填绝对路径）。帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify XXXX。项目名称是 YYYY（这里记得填一下，不填估计它会自己乱写）。
```
