# Coding Rules

## Hard Rules

{{hardRules}}

## Recommended Practices

- Read the active change plan before editing code.
- Keep edits small and explain non-obvious decisions in the change files.
- Prefer preserving existing naming and structure conventions.

## Compatibility Expectations

- Avoid changing public or widely shared interfaces without documenting the reason.
- Record any migration note in `apply.md` when compatibility changes are unavoidable.

## Documentation Expectations

- Update project guidance when repo structure or conventions materially change.
- Read `.oslite/docs/project/bug-memory.md` and its linked segment files before fixing a repeat bug or risky logic path.
- Keep `change.json.affects` accurate before marking work as applied.
- Record commands, results, and remaining risks in `verify.md`.
