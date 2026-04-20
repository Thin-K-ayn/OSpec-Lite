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

## What To Double-Check Before Editing

- Relevant project rules in `{{projectDocsRoot}}/coding-rules.md`
- Active change scope in `.oslite/changes/active/<change>/plan.md`
- Relevant lessons in `.oslite/docs/project/bug-memory.md` and its linked segment files before repeating a bug investigation
- Whether the target file is a high-risk central file
- Whether `oslite refresh .` reports any human-owned docs that need review
