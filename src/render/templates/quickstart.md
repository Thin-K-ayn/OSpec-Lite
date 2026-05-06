# Quickstart

## Read These First

- `AGENTS.md`
- `CLAUDE.md`
- `{{projectDocsRoot}}/overview.md`
- `{{projectDocsRoot}}/architecture.md`
- `{{projectDocsRoot}}/repo-map.md`

## How To Explore Safely

{{safeExploration}}

## How To Choose Where Code Belongs

- Follow existing directory conventions before creating new top-level structure.
- Prefer local, bounded changes near the relevant entrypoint or source area.
- Record your decision in the active change plan when placement is ambiguous.

## How To Report Work

- Run `oslite report . --cadence daily|weekly` for a terminal summary of current OSpec Lite work.
- Run `oslite report write . --cadence daily|weekly` to write Markdown and JSON artifacts under `.oslite/reports/<cadence>/`.
- Run `oslite report schedule . --cadence daily|weekly`, then have cron, CI, or an agent automation call `oslite report run .` repeatedly for recurring artifacts.

## What To Double-Check Before Editing

- Relevant project rules in `{{projectDocsRoot}}/coding-rules.md`
- Active change scope in `.oslite/changes/active/<change>/plan.md`
- Relevant lessons in `.oslite/docs/project/bug-memory.md` and its linked segment files before repeating a bug investigation
- Whether the target file is a high-risk central file
- Whether `oslite refresh .` reports any human-owned docs that need review
