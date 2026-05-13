# Upgrading OSpec Lite Projects

Use `oslite update` after upgrading the CLI package or when an initialized repository is missing managed OSpec Lite files.

```sh
oslite update .
oslite update . --dry-run
oslite update . --dry-run --json
```

## What Update Does

- repairs missing protocol directories
- refreshes `.oslite/index.json`
- refreshes managed sections in `AGENTS.md` and `CLAUDE.md`
- writes missing human-owned doc suggestions without overwriting edited docs
- writes missing profile support assets
- repairs bug queue, bug memory, and bug index support files

## What Update Does Not Do

- initialize an uninitialized repository
- overwrite human-owned project docs
- install new plugins automatically
- migrate active work into a new workflow model

## Recommended Flow

1. Run `oslite update . --dry-run`.
2. Review planned actions.
3. Run `oslite update .`.
4. Run `oslite status .`.
5. Run `oslite docs verify .` for profile-backed repositories.
