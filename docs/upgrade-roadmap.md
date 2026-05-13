# OSpec Lite Upgrade Roadmap

This roadmap tracks the upgrades adopted from reviewing OpenSpec and OSpec while keeping OSpec Lite small, agent-first, and focused on Unity + ToLua repositories.

Check a milestone only after the implementation, tests, and relevant smoke checks pass.

| ID | Milestone | Status | Acceptance Criteria | Completed In |
| --- | --- | --- | --- | --- |
| U0 | Add upgrade roadmap document | [x] Done | Public checklist exists, README links to it, and every milestone has acceptance criteria. | Pending commit / next release |
| U1 | Add agent-readable JSON output | [x] Done | `status`, `report`, `docs verify`, `change`, and `bug` support `--json`; structured errors include useful details. | Pending commit / next release |
| U2 | Add `oslite update` migration/repair pipeline | [x] Done | `oslite update [path] [--dry-run] [--json]` repairs missing managed state while preserving human-owned docs. | Pending commit / next release |
| U3 | Add profile listing and validation tools | [x] Done | `profiles list`, `profiles info`, and `profiles validate` inspect bundled profile assets and checklist consistency. | Pending commit / next release |
| U4 | Add Unity/ToLua profile verifier | [x] Done | `docs verify` runs profile-scoped repository checks for Unity/ToLua anchors, Lua files, ToLua signals, and EmmyLua guidance. | Pending commit / next release |
| U5 | Add release smoke test coverage | [x] Done | `npm run release:smoke` exercises the packed CLI in a temp repo with paths containing spaces and runs in CI/release checks. | Pending commit / next release |
| U6 | Add adoption/comparison/profile docs | [x] Done | Public docs explain comparison, profile authoring, Unity/ToLua verification, and upgrade flow. | Pending commit / next release |
| U7 | Harden plugin inspection and diagnostics | [x] Done | `plugins info` and `plugins doctor` report local marketplace, manifest, bundled plugin, and compatibility diagnostics. | Pending commit / next release |

## Operating Rules

- Implement one milestone at a time when practical.
- Prefer typed service result objects and opt-in JSON over changing human output defaults.
- Keep profile and plugin systems local-first; do not add an npm-installed external plugin runtime in this roadmap.
- Treat Unity/ToLua support as a product differentiator, not a generic framework sample.

## Verification Checklist

Before checking off a milestone:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Relevant CLI smoke command for the milestone
- [x] Documentation updated when public behavior changes
