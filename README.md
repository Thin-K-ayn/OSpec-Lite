# OSpec Lite

Minimal agent-first repository bootstrap for:

- `oslite init`
- `oslite status`
- `oslite change new`
- `oslite change apply`
- `oslite change verify`
- `oslite change archive`

V1 intentionally focuses on generic repo understanding plus first-class support for:

- `AGENTS.md`
- `CLAUDE.md`

## Why It Exists

`ospec-lite` is a smaller rewrite direction inspired by OSpec, but focused on one immediate outcome:

- after `init`, a repository should become easier for coding agents like Codex and Claude Code to understand and change safely

Instead of trying to solve every workflow problem up front, V1 keeps the surface small:

- one-time repo bootstrap
- machine-readable repo index
- agent-oriented docs
- lightweight change tracking

## Current V1 Scope

- one-time `init`
- generic repo scan
- `AGENTS.md` generation
- `CLAUDE.md` generation
- `.oslite/index.json`
- minimal `change -> apply -> verify -> archive`

## Build

```powershell
npm.cmd install
npm.cmd run build
```

## Usage

Run from this package directory:

```powershell
node .\dist\cli\index.js init ..
node .\dist\cli\index.js status ..
node .\dist\cli\index.js change new example-change ..
```

## Docs

- [V1 core spec](./docs/ospec-lite-v1-core-spec.md)

## Notes

- V1 `init` is intentionally one-shot. If the repo is already initialized, it logs that state and exits.
- Stack-specific understanding is out of scope for the core. Future versions can add external profiles without hard-coding them into this package.
