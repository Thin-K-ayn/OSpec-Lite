export const OSLITE_DIR = ".oslite";

export const INIT_MARKERS = [
  ".oslite/config.json",
  ".oslite/index.json",
  "AGENTS.md",
  "CLAUDE.md",
  "docs/project/overview.md",
  "docs/project/architecture.md",
  "docs/project/repo-map.md",
  "docs/project/coding-rules.md",
  "docs/project/glossary.md",
  "docs/project/entrypoints.md",
  "docs/agents/quickstart.md",
  "docs/agents/change-playbook.md",
  "changes/active",
  "changes/archived"
] as const;

export const DEFAULT_DOCUMENT_LANGUAGE = "en-US" as const;

export const AGENTS_FILE = "AGENTS.md";
export const CLAUDE_FILE = "CLAUDE.md";

export const AGENTS_MANAGED_START = "<!-- oslite:agents:start -->";
export const AGENTS_MANAGED_END = "<!-- oslite:agents:end -->";
export const CLAUDE_MANAGED_START = "<!-- oslite:claude:start -->";
export const CLAUDE_MANAGED_END = "<!-- oslite:claude:end -->";

export const CHANGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_RULES = [
  "Preserve public interfaces unless the change explicitly allows a breaking update.",
  "Prefer small, scoped edits over broad rewrites.",
  "Document assumptions and risks in the active change files.",
  "Update project guidance when structure or conventions materially change."
] as const;
