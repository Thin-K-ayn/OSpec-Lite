# OSpec Lite Compared With OpenSpec And OSpec

OSpec Lite intentionally stays narrower than OpenSpec and OSpec.

| Project | Best Fit | What OSpec Lite Learns From It |
| --- | --- | --- |
| OpenSpec | Broad spec-driven workflows across many AI tools. | JSON-friendly agent commands, validation discipline, release hygiene, and clear docs surfaces. |
| OSpec | Document-driven workflow with update/migration, skills, plugins, and multilingual assets. | Project-scoped update repair, profile discipline, plugin diagnostics, and practical lifecycle commands. |
| OSpec Lite | Small agent-first repo bootstrap with Unity + ToLua profiles. | Keep the workflow compact, preserve human docs, and specialize around repo-local game project evidence. |

## Product Boundary

OSpec Lite should not become a full schema engine or broad AI-tool integration platform. The preferred direction is:

- better machine-readable command output
- safer update and repair behavior
- stronger profile validation
- Unity/ToLua verification that generic tools do not provide
- local Codex plugin metadata diagnostics

## Default Tradeoff

When a feature could be generic or profile-specific, prefer the profile-specific version if it improves Unity + ToLua reliability without making generic init harder to understand.
