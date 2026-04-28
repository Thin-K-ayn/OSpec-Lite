import { OSpecLiteError } from "../core/ospec-lite-errors";

/**
 * Reads the value for a `--flag value` form. Returns the value and the index
 * to advance to. Throws if the next arg is missing or starts with `--`.
 */
export function readFlagValue(
  args: string[],
  index: number,
  flagName: string
): { value: string; nextIndex: number } {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new OSpecLiteError(`Missing value for ${flagName}.`);
  }
  return { value, nextIndex: index + 1 };
}

export function isCompleteStatusConfig(
  value: unknown
): value is {
  agentTargets: string[];
  agentEntryFiles: Record<string, string>;
  projectDocsRoot: string;
  changeRoot: string;
  profileId?: string;
  authoringPackRoot?: string;
  agentWrapperFiles?: Record<string, string[]>;
  projectName?: string;
  bootstrapAgent?: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    agentTargets?: unknown;
    agentEntryFiles?: unknown;
    projectDocsRoot?: unknown;
    changeRoot?: unknown;
    profileId?: unknown;
    authoringPackRoot?: unknown;
    agentWrapperFiles?: unknown;
    projectName?: unknown;
    bootstrapAgent?: unknown;
  };

  return (
    Array.isArray(candidate.agentTargets) &&
    candidate.agentTargets.every((item) => typeof item === "string") &&
    !!candidate.agentEntryFiles &&
    typeof candidate.agentEntryFiles === "object" &&
    Object.values(candidate.agentEntryFiles).every((item) => typeof item === "string") &&
    typeof candidate.projectDocsRoot === "string" &&
    typeof candidate.changeRoot === "string" &&
    (candidate.profileId === undefined || typeof candidate.profileId === "string") &&
    (candidate.projectName === undefined || typeof candidate.projectName === "string") &&
    (candidate.bootstrapAgent === undefined ||
      candidate.bootstrapAgent === "codex" ||
      candidate.bootstrapAgent === "claude-code" ||
      candidate.bootstrapAgent === "none") &&
    (candidate.authoringPackRoot === undefined ||
      typeof candidate.authoringPackRoot === "string") &&
    (candidate.agentWrapperFiles === undefined ||
      isStringArrayRecord(candidate.agentWrapperFiles))
  );
}

export function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value).every(
    (item) => Array.isArray(item) && item.every((entry) => typeof entry === "string")
  );
}

export function printAgentWrappers(
  wrappers: Record<string, string[]> | undefined
): void {
  if (!wrappers || Object.keys(wrappers).length === 0) {
    return;
  }

  console.log("Agent wrappers:");
  for (const [target, files] of Object.entries(wrappers)) {
    for (const filePath of files) {
      console.log(`- ${target}: ${filePath}`);
    }
  }
}

export function printPathList(label: string, items: string[]): void {
  console.log(`${label}:`);
  if (items.length === 0) {
    console.log("- (none)");
    return;
  }

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

