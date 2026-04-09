# OSpec Lite

Minimal agent-first repository bootstrap for:

- `oslite init`
- `oslite status`
- `oslite docs verify`
- `oslite change new`
- `oslite change apply`
- `oslite change verify`
- `oslite change archive`

V1 intentionally focuses on generic repo understanding plus first-class support for:

- `AGENTS.md`
- `CLAUDE.md`
- repo-local Codex and Claude Code wrappers

## Why It Exists

`ospec-lite` is a smaller rewrite direction inspired by OSpec, but focused on one immediate outcome:

- after `init`, a repository should become easier for coding agents like Codex and Claude Code to understand and change safely

Instead of trying to solve every workflow problem up front, V1 keeps the surface small:

- one-time repo bootstrap
- machine-readable repo index
- agent-oriented docs
- repo-local authoring packs for profile-driven repository reading
- deterministic documentation verification
- lightweight change tracking

## Current V1 Scope

- one-time `init`
- generic repo scan
- optional asset-based profiles
- `AGENTS.md` generation
- `CLAUDE.md` generation
- `.oslite/index.json`
- shared prompt packs under `docs/agents/authoring/`
- thin repo-local wrappers that point agents at the shared authoring pack
- `oslite docs verify`
- minimal `change -> apply -> verify -> archive`

## Install

```sh
npm install
```

## Build

```sh
npm run build
```

## Test

```sh
npm test
```

## Usage

Run from this package directory:

```sh
node ./dist/cli/index.js init ..
node ./dist/cli/index.js init --document-language zh-CN ..
node ./dist/cli/index.js init --profile unity-tolua-game ..
node ./dist/cli/index.js init --profile unity-tolua-game --project-name "BuYuDaLuanDou" --bootstrap-agent codex ..
node ./dist/cli/index.js status ..
node ./dist/cli/index.js docs verify ..
node ./dist/cli/index.js change new example-change ..
```

## Docs

- [V1 core spec](./docs/ospec-lite-v1-core-spec.md)

## Profiles

- profiles live under [`profiles/`](./profiles)
- the first content-only profile is [`unity-tolua-game`](./profiles/unity-tolua-game/profile.json)
- profiles do not execute code or call hosted models
- profiles provide:
  - neutral doc skeletons
  - repo-local reading instructions
  - an evidence map workflow
  - thin Codex / Claude Code wrappers that point to the shared workflow
  - checklist-driven verification
  - natural-language-friendly guidance so an agent can infer init parameters and continue the workflow

## Notes

- V1 `init` is intentionally one-shot. If the repo is already initialized, it logs that state and exits.
- V1 stays provider-agnostic. It prepares repo-local instructions for Codex and Claude Code, but does not orchestrate model calls directly.
- The `unity-tolua-game` profile only hard-codes one project rule: `Script/MJGame.lua` is the main entry anchor.
- `unity-tolua-game` can ask for `projectName` and `bootstrapAgent` during `init`; in non-interactive environments, pass `--project-name` and `--bootstrap-agent` explicitly.
