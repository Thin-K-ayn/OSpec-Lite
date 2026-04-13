---
name: ospec-lite-workflow
description: Use when a repository should be initialized with OSpec Lite, when a repo already uses OSpec Lite, or when profile-backed docs and lightweight change tracking should follow the ospec-lite workflow.
---

# OSpec Lite Workflow

Treat `ospec-lite` as the workflow authority for repository bootstrap, profile-backed docs, and lightweight change tracking.

## Command entrypoint

Pick the command runner that matches the current workspace:

1. If this workspace is the `ospec-lite` source repo and `dist/cli/index.js` exists, use `node ./dist/cli/index.js`.
2. Else if the target repo already has `ospec-lite` installed, use `npx oslite`.
3. Else use `npm exec --package ospec-lite@1.0.3 oslite --`.

## Initialization rules

1. If the user explicitly wants OSpec Lite setup, initialize with `oslite init`.
2. Before mutating an already bootstrapped repo, run `oslite status .` to confirm the current state and active profile.
3. Treat `oslite init` as one-shot. If `.oslite/config.json` already exists or status says `initialized`, do not rerun `init`.
4. If status says `incomplete`, inspect the missing markers and repair the state instead of deleting files blindly.
5. Generic bootstrap examples:
   - `oslite init .`
   - `oslite init . --document-language zh-CN`

## Profile workflow

1. Built-in profiles currently include `unity-tolua-game` and `unity-tolua-hall`.
2. In non-interactive environments, profile init requires both `--project-name` and `--bootstrap-agent`.
3. Valid bootstrap agents are `codex`, `claude-code`, and `none`.
4. After profile init, follow this order:
   - `.oslite/docs/agents/authoring/fill-project-docs.md`
   - `.oslite/docs/agents/authoring/project-brief.md`
   - `.oslite/docs/agents/authoring/repo-reading-checklist.md`
   - `.oslite/docs/agents/authoring/evidence-map.md`
5. Fill the evidence map before updating `.oslite/docs/project/*`, `.oslite/docs/agents/*`, `AGENTS.md`, or `CLAUDE.md`.
6. Write from evidence, not from guesses. Mark uncertain conclusions as assumptions or follow-ups.
7. Finish profile-driven doc work with `oslite docs verify .`.

## Change workflow

1. For task-sized work, create or continue an OSpec Lite change folder with `oslite change new <slug> .`.
2. Keep the change notes current while editing code and docs.
3. Advance the workflow with:
   - `oslite change apply <change-path>`
   - `oslite change verify <change-path>`
   - `oslite change archive <change-path>`
4. Prefer small, scoped edits and record risks or assumptions in the change files instead of burying them in chat.

## Editing guardrails

1. Preserve human-authored content outside the managed OSpec Lite sections in `AGENTS.md` and `CLAUDE.md`.
2. Use `.oslite/index.json` and `.oslite/docs/*` as the repo-local source of truth once they exist.
3. If the user only asked for inspection or explanation, do not initialize the repo implicitly.
