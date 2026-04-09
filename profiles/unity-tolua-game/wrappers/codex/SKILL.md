---
name: oslite-fill-project-docs
description: Initialize or continue OSpec Lite project documentation for a Unity + ToLua repository. Use when Codex should adopt the unity-tolua-game profile, confirm the inferred project name with the user, run oslite init when needed, then fill evidence-first docs and finish with docs verification.
---

# OSpec Lite Project Docs

Follow the repo-local authoring pack instead of inventing a new workflow.

1. If the repo is not initialized for `unity-tolua-game`, infer the project name from the repo and ask the user to confirm it before running `oslite init`.
2. Once the project name is confirmed, default the bootstrap agent to `codex` and run `oslite init --profile unity-tolua-game --project-name "<project-name>" --bootstrap-agent codex .`.
3. If the repo is already initialized, do not rerun `init`.
4. Read `{{authoringPackRoot}}/fill-project-docs.md` first.
5. Read `{{authoringPackRoot}}/project-brief.md` and `{{authoringPackRoot}}/repo-reading-checklist.md`.
6. Fill `{{authoringPackRoot}}/evidence-map.md` before editing the final docs.
7. Use `{{authoringPackRoot}}/doc-contract.md` as the output contract.
8. Update `AGENTS.md`, `CLAUDE.md`, `{{docsRoot}}/*`, and `{{agentDocsRoot}}/*` from evidence, not from guesses.
9. Mark uncertain conclusions as `推断` or `待确认`.
10. Keep temporary or helper directories out of the core project narrative unless the repo clearly treats them as first-class architecture.
11. Run `oslite docs verify .` before stopping when the command is available in the environment.
