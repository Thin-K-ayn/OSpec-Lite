export const OSPEC_LITE_DIR = ".oslite";

export const INIT_MARKERS = [
  ".oslite/config.json",
  ".oslite/index.json",
  "AGENTS.md",
  "CLAUDE.md",
  ".oslite/docs/project/overview.md",
  ".oslite/docs/project/architecture.md",
  ".oslite/docs/project/repo-map.md",
  ".oslite/docs/project/coding-rules.md",
  ".oslite/docs/project/glossary.md",
  ".oslite/docs/project/entrypoints.md",
  ".oslite/docs/agents/quickstart.md",
  ".oslite/docs/agents/change-playbook.md",
  ".oslite/changes/active",
  ".oslite/changes/archived"
] as const;

export const AUTHORING_PACK_FILES = [
  "doc-contract.md",
  "project-brief.md",
  "repo-reading-checklist.md",
  "evidence-map.md",
  "fill-project-docs.md",
  "doc-task-checklist.json"
] as const;

export const DEFAULT_DOCUMENT_LANGUAGE = "en-US" as const;
export const DEFAULT_AUTHORING_PACK_ROOT = ".oslite/docs/agents/authoring" as const;

export const AGENTS_FILE = "AGENTS.md";
export const CLAUDE_FILE = "CLAUDE.md";

export const AGENTS_MANAGED_START = "<!-- oslite:agents:start -->";
export const AGENTS_MANAGED_END = "<!-- oslite:agents:end -->";
export const CLAUDE_MANAGED_START = "<!-- oslite:claude:start -->";
export const CLAUDE_MANAGED_END = "<!-- oslite:claude:end -->";

export const CHANGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BUG_PLAYBOOK_PATH = ".oslite/docs/agents/bug-playbook.md";
export const BUG_MEMORY_PATH = ".oslite/docs/project/bug-memory.md";
export const BUG_MEMORY_DIR = ".oslite/docs/project/bug-memory";
export const BUG_QUEUE_PATH = ".oslite/bugs/queue.md";
export const BUG_INDEX_PATH = ".oslite/bugs/index.json";

export const DEFAULT_RULES = [
  "Preserve public interfaces unless the change explicitly allows a breaking update.",
  "Prefer small, scoped edits over broad rewrites.",
  "Document assumptions and risks in the active change files.",
  "Update project guidance when structure or conventions materially change."
] as const;
