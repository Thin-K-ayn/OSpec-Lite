Use the repo-local OSpec Lite authoring pack to initialize or fill project documentation.

1. If the repo is not initialized for `unity-tolua-game`, infer the project name from the repo and ask the user to confirm it before running `oslite init`.
2. Once the project name is confirmed, default the bootstrap agent to `claude-code` and run `oslite init --profile unity-tolua-game --project-name "<project-name>" --bootstrap-agent claude-code .`.
3. If the repo is already initialized, do not rerun `init`.
4. Read `{{authoringPackRoot}}/fill-project-docs.md` first.
5. Read `{{authoringPackRoot}}/project-brief.md` and `{{authoringPackRoot}}/repo-reading-checklist.md`.
6. Fill `{{authoringPackRoot}}/evidence-map.md` before editing the final docs.
7. Update `AGENTS.md`, `CLAUDE.md`, `{{docsRoot}}/*`, and `{{agentDocsRoot}}/*` from evidence.
8. Mark uncertain conclusions as `推断` or `待确认`.
9. If `$ARGUMENTS` is provided, treat it as the priority area to inspect first, but still keep the final docs globally consistent.
10. Run `oslite docs verify .` before stopping when the command is available in the environment.
