# OSpec Lite

[English](./README.md) | [简体中文](./README.zh-CN.md)

Minimal agent-first repository bootstrap for Codex and Claude Code.

`ospec-lite` helps a repository become easier for coding agents to understand, easier for humans to review, and safer to change. It bootstraps repo-local instructions, a machine-readable index, a small project knowledge layer, and a lightweight change workflow under `.oslite/`.

V1 intentionally keeps the surface area small: one-time bootstrap, optional profiles, deterministic profile-backed doc verification, and simple change tracking.

[Why OSpec Lite](#why-ospec-lite) | [What It Creates](#what-it-creates) | [Install](#install) | [Usage](#usage) | [Profiles](#profiles) | [Codex Plugin](#codex-plugin) | [Development](#development)

## Why OSpec Lite

- Bootstraps `AGENTS.md` and `CLAUDE.md` so Codex and Claude Code get repo-local guidance immediately.
- Generates `.oslite/index.json` as a machine-readable summary of the repository.
- Creates `.oslite/docs/project/*` and `.oslite/docs/agents/*` so repo knowledge lives next to the code.
- Supports content-only profiles that add authoring packs and thin agent wrappers without introducing a plugin runtime.
- Tracks lightweight changes in `.oslite/changes/active/*` and archives them when verified.
- Verifies profile-driven documentation deterministically with `oslite docs verify`.
- Ships a repo-local Codex companion plugin so Codex can discover and follow the `ospec-lite` workflow.

## What It Creates

`oslite init` is a one-time bootstrap. On a fresh repository, generic init creates:

```text
.oslite/
  config.json
  index.json
  docs/
    project/
      overview.md
      architecture.md
      repo-map.md
      coding-rules.md
      glossary.md
      entrypoints.md
    agents/
      quickstart.md
      change-playbook.md
  changes/
    active/
    archived/

AGENTS.md
CLAUDE.md
```

When a profile is selected, it can also add:

```text
.oslite/docs/agents/authoring/*
.codex/skills/oslite-fill-project-docs/SKILL.md
.claude/commands/oslite-fill-project-docs.md
```

If the repo is already initialized, `oslite init` reports the current state and exits instead of rewriting the knowledge layer.

## Install

Use `ospec-lite` in a target repository:

```sh
npm install --save-dev ospec-lite
npx oslite init .
```

If you are developing this package locally:

```sh
npm install
npm run build
npm test
```

When running from this cloned repository instead of an installed package, use `node ./dist/cli/index.js ...`.

## Usage

### Initialize a repository

```sh
npx oslite init .
npx oslite init . --document-language zh-CN
npx oslite init . --profile unity-tolua-game --project-name "BuYuDaLuanDou" --bootstrap-agent codex
npx oslite init . --profile unity-tolua-hall --project-name "NeoHall" --bootstrap-agent codex
```

Notes:

- Supported document languages are `en-US` and `zh-CN`.
- In non-interactive environments, the shipped profiles require both `--project-name` and `--bootstrap-agent`.
- `--bootstrap-agent` accepts `codex`, `claude-code`, or `none`.

### Inspect bootstrap state

```sh
npx oslite status .
```

`status` reports whether the repo is initialized, which profile is active, where docs live, and how many active and archived changes exist.

### Verify profile-driven docs

```sh
npx oslite docs verify .
```

`docs verify` is only available for repositories initialized with a profile, because it validates the active profile's authoring pack and checklist.

### Track a lightweight change

```sh
npx oslite change new improve-readme .
# edit files and update the change notes
npx oslite change apply .oslite/changes/active/improve-readme
npx oslite change verify .oslite/changes/active/improve-readme
npx oslite change archive .oslite/changes/active/improve-readme
```

## Typical Profile Workflow

1. Run `oslite init` with the right profile.
2. Fill `.oslite/docs/agents/authoring/evidence-map.md` before the final docs.
3. Complete `AGENTS.md`, `CLAUDE.md`, `.oslite/docs/project/*`, and `.oslite/docs/agents/*`.
4. Finish with `oslite docs verify .`.

## Profiles

| Profile | Target repository | Required repo anchors | Output language |
| --- | --- | --- | --- |
| `unity-tolua-game` | Unity + ToLua sub-game repos | `Script/MJGame.lua` | `zh-CN` |
| `unity-tolua-hall` | Unity + ToLua hall / lobby repos | `Assets/_GameCenter/...` startup files | `zh-CN` |

Both shipped profiles:

- are content-only asset packs, not executable plugins
- add `.oslite/docs/agents/authoring/*`
- can generate repo-local Codex and Claude Code wrappers
- require `projectName` and `bootstrapAgent` during init

Profile docs:

- [profiles/README.md](./profiles/README.md)
- [profiles/unity-tolua-game/README.md](./profiles/unity-tolua-game/README.md)
- [profiles/unity-tolua-hall/README.md](./profiles/unity-tolua-hall/README.md)

## Codex Plugin

This repository now ships a repo-local Codex companion plugin under [`plugins/ospec-lite-codex/`](./plugins/ospec-lite-codex).

- Plugin manifest: [`plugins/ospec-lite-codex/.codex-plugin/plugin.json`](./plugins/ospec-lite-codex/.codex-plugin/plugin.json)
- Repo marketplace entry: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- Primary skill: `$ospec-lite-workflow`

Open this repository in Codex and let it discover the repo-local marketplace. The plugin does not replace `oslite`; it teaches Codex when to use the CLI and how to follow profile-backed OSpec Lite workflows consistently.

Example prompts:

- `Initialize this repo with OSpec Lite.`
- `Check OSpec Lite status and explain the missing markers.`
- `Continue the profile docs and run oslite docs verify.`
- `Create an OSpec Lite change for add-login-flow.`

## Command Summary

```text
oslite init [path] [--document-language en-US|zh-CN] [--profile <profile-id>] [--project-name <name>] [--bootstrap-agent codex|claude-code|none]
oslite status [path]
oslite docs verify [path]
oslite change new <slug> [path]
oslite change apply <change-path>
oslite change verify <change-path>
oslite change archive <change-path>
```

## Docs

- [docs/ospec-lite-v1-core-spec.md](./docs/ospec-lite-v1-core-spec.md)

## Development

```sh
npm install
npm run build
npm run typecheck
npm test
```
