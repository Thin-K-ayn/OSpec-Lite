import {
  EntryPointItem,
  PathAdvisory,
  ToolingInsight
} from "../../core/ospec-lite-types";

export function collectRiskyPaths(
  topLevelNames: string[],
  tooling: ToolingInsight,
  entrypoints: EntryPointItem[],
  generatedDirectories: string[]
): PathAdvisory[] {
  const advisories = new Map<string, PathAdvisory>();
  const topLevel = new Set(topLevelNames);

  if (topLevel.has("package.json")) {
    addAdvisory(advisories, {
      path: "package.json",
      kind: "package-manifest",
      reason: "Changes package metadata, scripts, and dependency declarations."
    });
  }

  if (tooling.packageManager?.lockFile) {
    addAdvisory(advisories, {
      path: tooling.packageManager.lockFile,
      kind: "lockfile",
      reason: "Changes dependency resolution for the whole repository."
    });
  }

  if (topLevel.has(".github")) {
    addAdvisory(advisories, {
      path: ".github/workflows",
      kind: "workflow",
      reason: "Changes CI or automation behavior for pull requests and pushes."
    });
  }

  if (topLevel.has("AGENTS.md")) {
    addAdvisory(advisories, {
      path: "AGENTS.md",
      kind: "agent-instructions",
      reason: "Changes repo-local agent instructions and task behavior."
    });
  }

  if (topLevel.has("CLAUDE.md")) {
    addAdvisory(advisories, {
      path: "CLAUDE.md",
      kind: "agent-instructions",
      reason: "Changes Claude Code project memory and repo-local guidance."
    });
  }

  for (const entrypoint of entrypoints.slice(0, 3)) {
    addAdvisory(advisories, {
      path: entrypoint.path,
      kind: "entrypoint",
      reason: "Likely bootstrap or central orchestration path."
    });
  }

  for (const generatedDirectory of generatedDirectories) {
    addAdvisory(advisories, {
      path: generatedDirectory,
      kind: "generated",
      reason: "Likely generated output. Prefer editing the source that produces it."
    });
  }

  return sortAdvisories(advisories);
}

export function collectAskFirstAreas(
  topLevelNames: string[],
  tooling: ToolingInsight,
  generatedDirectories: string[]
): PathAdvisory[] {
  const advisories = new Map<string, PathAdvisory>();
  const topLevel = new Set(topLevelNames);

  if (topLevel.has("package.json")) {
    addAdvisory(advisories, {
      path: "package.json",
      kind: "package-manifest",
      reason: "Confirm before changing packaging, scripts, or publish-facing metadata."
    });
  }

  if (tooling.packageManager?.lockFile) {
    addAdvisory(advisories, {
      path: tooling.packageManager.lockFile,
      kind: "lockfile",
      reason: "Confirm before changing dependency lockfiles or mass-updating packages."
    });
  }

  if (topLevel.has(".github")) {
    addAdvisory(advisories, {
      path: ".github/workflows",
      kind: "workflow",
      reason: "Confirm before changing repository automation or required checks."
    });
  }

  if (topLevel.has("AGENTS.md")) {
    addAdvisory(advisories, {
      path: "AGENTS.md",
      kind: "agent-instructions",
      reason: "Confirm before changing repo-local agent policies."
    });
  }

  if (topLevel.has("CLAUDE.md")) {
    addAdvisory(advisories, {
      path: "CLAUDE.md",
      kind: "agent-instructions",
      reason: "Confirm before changing Claude-specific repo guidance."
    });
  }

  for (const generatedDirectory of generatedDirectories) {
    addAdvisory(advisories, {
      path: generatedDirectory,
      kind: "generated",
      reason: "Confirm before editing generated output directly instead of its source."
    });
  }

  return sortAdvisories(advisories);
}

function addAdvisory(advisories: Map<string, PathAdvisory>, advisory: PathAdvisory): void {
  if (!advisories.has(advisory.path)) {
    advisories.set(advisory.path, advisory);
  }
}

function sortAdvisories(advisories: Map<string, PathAdvisory>): PathAdvisory[] {
  return Array.from(advisories.values()).sort(
    (left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind)
  );
}
