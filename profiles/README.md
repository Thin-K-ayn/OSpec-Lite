# Profiles

`profiles/` contains optional content-only profile packs for `ospec-lite`.

A profile pack may provide:
- repo-specific doc templates
- a shared agent authoring pack
- thin Codex / Claude Code wrappers that point to the authoring pack
- a deterministic documentation checklist

Profiles are assets, not executable plugins.

Notes:
- `unity-tolua-game` may ask for `projectName` and `bootstrapAgent` during init.
- In non-interactive environments, that profile requires explicit init flags instead of prompts.
- Team-facing usage guidance for that profile lives in [`unity-tolua-game/README.md`](./unity-tolua-game/README.md).
