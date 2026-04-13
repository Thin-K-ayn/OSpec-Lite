# OSpec Lite Codex Plugin

`ospec-lite-codex` is the repo-local Codex companion plugin for `ospec-lite`.

It does not replace the `oslite` CLI. Instead, it teaches Codex when to use `oslite`, how to follow profile-backed authoring packs, and how to keep the lightweight change workflow consistent.

## Files

- Plugin manifest: `.codex-plugin/plugin.json`
- Primary skill: `skills/ospec-lite-workflow/SKILL.md`
- Repo marketplace entry: `../../.agents/plugins/marketplace.json`

## Use In Codex

1. Open this repository in Codex.
2. Let Codex discover the repo-local marketplace from `.agents/plugins/marketplace.json`.
3. Ask Codex to use the OSpec Lite workflow, or invoke the skill directly with `$ospec-lite-workflow`.

Example prompts:

- `Initialize this repo with OSpec Lite.`
- `Check OSpec Lite status and explain the missing markers.`
- `Continue the profile docs and run oslite docs verify.`
- `Create an OSpec Lite change for add-login-flow.`

## Command Strategy

The skill prefers these command entrypoints, in order:

1. `node ./dist/cli/index.js` when maintaining the `ospec-lite` source repo itself
2. `npx oslite` when the target repo already depends on `ospec-lite`
3. `npm exec --package ospec-lite@1.0.3 oslite --` as a fallback

## Moving To A Home-Local Plugin Later

If you want the same plugin across many repositories, copy `plugins/ospec-lite-codex/` to `~/plugins/ospec-lite-codex/` and mirror the marketplace entry into `~/.agents/plugins/marketplace.json`.
