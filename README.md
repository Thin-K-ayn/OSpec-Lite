# OSpec Lite

[English](./README.md) | [简体中文](./README.zh-CN.md)

Minimal agent-first repository bootstrap for Codex and Claude Code.

`ospec-lite` helps a repository become easier for coding agents to understand, easier for humans to review, and safer to change. It bootstraps repo-local instructions, a machine-readable index, a small project knowledge layer, plus lightweight change and bug workflows under `.oslite/`.

V1 intentionally keeps the surface area small: one-time bootstrap, non-destructive refresh, optional profiles, deterministic profile-backed doc verification, and simple repo-local change and bug tracking.

[Why OSpec Lite](#why-ospec-lite) | [What It Creates](#what-it-creates) | [Install](#install) | [Usage](#usage) | [Profiles](#profiles) | [Codex Plugins](#codex-plugins) | [Plugins](#plugins) | [Development](#development)

## Why OSpec Lite

- Bootstraps `AGENTS.md` and `CLAUDE.md` so Codex and Claude Code get repo-local guidance immediately.
- Generates `.oslite/index.json` as a machine-readable summary of the repository.
- Creates `.oslite/docs/project/*` and `.oslite/docs/agents/*` so repo knowledge lives next to the code.
- Supports content-only profiles that add authoring packs and thin agent wrappers without introducing a plugin runtime.
- Tracks lightweight changes in `.oslite/changes/active/*` and archives them when verified.
- Tracks active bugs in `.oslite/bugs/active-bugs.md`, persists reusable lessons into rotating bug-memory files, and compacts stale knowledge when the memory grows too large.
- Verifies profile-driven documentation deterministically with `oslite docs verify`.
- Ships repo-local Codex companion plugins and a plugin module for scaffolding or installing more.

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
      bug-memory.md
      bug-memory/
    agents/
      quickstart.md
      change-playbook.md
      bug-playbook.md
  bugs/
    active-bugs.md
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
Use `oslite refresh` later to rescan the repo, rewrite only machine-managed artifacts, and report human-owned docs whose generated suggestions have drifted.

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
npx oslite refresh .
```

`status` reports whether the repo is initialized, which profile is active, where docs live, and how many active and archived changes and bugs exist.
`refresh` updates `.oslite/index.json` plus the managed sections in `AGENTS.md` and `CLAUDE.md`, then reports human-owned docs that need review without overwriting them.

### Verify profile-driven docs

```sh
npx oslite docs verify .
```

`docs verify` is only available for repositories initialized with a profile, because it validates the active profile's authoring pack and checklist.

### Track a lightweight change

A change is a repo-local work record for one non-trivial task. It is not a git branch and not a commit. Think of it as the smallest reviewable unit of intent, plan, implementation notes, and verification that lives next to the code.

Why it helps:

- gives humans and agents one shared place to capture scope before edits start
- makes handoff and review easier because request, plan, applied work, and verification are separated
- leaves an archived trail of why a change happened and how it was validated
- prevents status-only handoffs because apply/verify require actual evidence

Use a change when the task is more than a tiny typo, especially if it:

- touches multiple files
- changes behavior, interfaces, rules, or architecture
- needs explicit review notes or verification steps
- may outlive one chat session or one coding pass

What `oslite change new <slug> .` creates:

```text
.oslite/changes/active/<slug>/
  change.json
  request.md
  plan.md
  apply.md
  verify.md
```

File roles:

- `request.md`: what was asked for, intended scope, and acceptance notes
- `plan.md`: intended approach, expected files, and risks before editing
- `apply.md`: what actually changed and where implementation deviated from plan
- `verify.md`: commands, results, manual validation, and remaining risks
- `change.json`: machine-readable status and metadata

Typical flow:

1. Create the change folder.
2. Write `request.md` and `plan.md` before broad edits.
3. Fill `change.json.affects` before marking the change applied.
4. Implement the change.
5. Record the real work in `apply.md`, then mark it applied.
6. Record real commands and results in `verify.md`, then mark it verified.
7. Archive it once the work is done and verified.

```sh
npx oslite change new improve-readme .
# fill request.md and plan.md, then edit files
npx oslite change apply .oslite/changes/active/improve-readme
npx oslite change verify .oslite/changes/active/improve-readme
npx oslite change archive .oslite/changes/active/improve-readme
```

### Track and apply a bug fix

A bug item is the defect-oriented sibling of a change. It is where the team records the symptom, investigation, fix, validation, and the lessons that should prevent the same wrong assumption next time.

Why it helps:

- keeps one defect focused in one shared active bug section from report through applied fix
- requires the agent to write down the mistaken assumption and the actual code logic
- appends reusable reminders into `.oslite/docs/project/bug-memory.md` and its linked segment files

What `oslite bug new "<title>" .` creates:

```text
.oslite/bugs/active-bugs.md
.oslite/docs/project/bug-memory.md
.oslite/docs/project/bug-memory/memory-0001.md
```

Typical flow:

1. Create the bug item and fill the new `bug-####` section in `.oslite/bugs/active-bugs.md`.
2. Record the symptom, reproduction, investigation, and root cause in that active bug section.
3. Implement the fix and replace `Fix Summary`, `File`, and `Reason` with real details.
4. Run `oslite bug fix <bug-id>` once the implementation is complete.
5. Add real verification evidence plus cognitive-gap notes, including a concrete `Check First` repo path.
6. Run `oslite bug apply <bug-id>` to persist the lesson in bug memory, remove the bug from the active queue, and compact stale knowledge when needed.

```sh
npx oslite bug new "startup ordering blocks cold boot" .
# fill the new entry in .oslite/bugs/active-bugs.md, then implement the fix
npx oslite bug fix bug-0001 .
npx oslite bug apply bug-0001 .
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

## Codex Plugins

This repository now ships repo-local Codex companion plugins under [`plugins/`](./plugins).

- Core workflow plugin: [`plugins/ospec-lite-codex/`](./plugins/ospec-lite-codex)
- Repo marketplace entry: [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- Primary `ospec-lite` skill: `$ospec-lite-workflow`

Open this repository in Codex and let it discover the repo-local marketplace. The plugin does not replace `oslite`; it teaches Codex when to use the CLI and how to follow profile-backed OSpec Lite workflows consistently.

Example prompts:

- `Initialize this repo with OSpec Lite.`
- `Check OSpec Lite status and explain the missing markers.`
- `Continue the profile docs and run oslite docs verify.`
- `Create an OSpec Lite change for add-login-flow.`

## Plugins

`oslite plugins` manages repo-local Codex companion plugins as assets, not as an execution runtime. It keeps `plugins/<name>/` and `.agents/plugins/marketplace.json` in sync so a repository can ship discoverable local plugins without hand-editing manifests every time.

Bundled starter plugins:

- `ospec-lite-codex`: the OSpec Lite workflow companion plugin

Example commands:

```sh
npx oslite plugins list .
npx oslite plugins install-defaults .
npx oslite plugins install ../shared-plugins/my-plugin .
npx oslite plugins create my-plugin . --with-skills --with-hooks
```

## Command Summary

```text
oslite init [path] [--document-language en-US|zh-CN] [--profile <profile-id>] [--project-name <name>] [--bootstrap-agent codex|claude-code|none]
oslite status [path]
oslite refresh [path]
oslite bug new <title> [path]
oslite bug fix <bug-id> [path]
oslite bug apply <bug-id> [path]
oslite docs verify [path]
oslite plugins list [path]
oslite plugins install <plugin-name|plugin-path> [path] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
oslite plugins install-defaults [path] [--force]
oslite plugins create <plugin-name> [path] [--display-name <name>] [--description <text>] [--category <category>] [--with-skills] [--with-hooks] [--with-scripts] [--with-assets] [--with-mcp] [--with-apps] [--no-marketplace] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
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
