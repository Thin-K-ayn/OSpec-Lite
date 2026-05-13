# Profile Authoring

Profiles are content-only asset packs. They should teach agents how to read a repository, fill project docs with evidence, and verify those docs without adding an execution runtime.

## Required Shape

Each profile directory must include:

- `profile.json`
- `README.md`
- `authoring-pack/doc-contract.md`
- `authoring-pack/project-brief.md`
- `authoring-pack/repo-reading-checklist.md`
- `authoring-pack/evidence-map.md`
- `authoring-pack/fill-project-docs.md`
- `authoring-pack/doc-task-checklist.json`

Profile assets should declare every generated output in `profile.json`. Wrapper files for Codex and Claude Code must be listed as both assets and outputs.

## Validation

Use:

```sh
oslite profiles list
oslite profiles info unity-tolua-game
oslite profiles validate all
```

Validation checks that asset sources exist, targets are repo-relative, outputs match assets, wrapper declarations are complete, authoring pack files are present, and documentation checklist paths are covered by profile outputs.

## Authoring Guidance

- Keep templates specific to the target repository shape.
- Use required repo anchors only when absence means the profile is wrong.
- Put evidence requirements in `doc-task-checklist.json`, not only prose.
- Preserve human-owned docs by writing suggestions only when files are missing.
