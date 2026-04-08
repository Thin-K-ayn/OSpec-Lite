import { OsliteConfig, RepositoryScanResult, RuleItem } from "../core/types";

export class MarkdownRenderer {
  renderOverview(scan: RepositoryScanResult, config: OsliteConfig): string {
    const areas = scan.directoryMap
      .filter((item) => item.kind === "directory")
      .slice(0, 10)
      .map((item) => `- \`${item.path}\`: ${item.role}`)
      .join("\n");

    const signals = Object.entries(scan.signals)
      .filter(([, value]) => value)
      .map(([key]) => `- ${key}`)
      .join("\n");

    return `# Project Overview

## Project Summary

\`${scan.projectName}\` has been initialized with OSpec Lite for ${config.agentTargets.join(
      ", "
    )}.

This document is a first-pass repository summary generated from the current filesystem structure. It is intended to help coding agents orient quickly and should be refined manually when needed.

## Repo Signals

${signals || "- No strong repo signals detected yet."}

## Main Working Areas

${areas || "- No top-level working areas detected yet."}

## Needs Human Confirmation

- Confirm the project summary in business terms.
- Confirm the most important runtime entrypoints.
- Add any repository-specific rules that agents must follow.
`;
  }

  renderArchitecture(scan: RepositoryScanResult): string {
    const entrypoints = this.renderBullets(
      scan.entrypoints.map(
        (item) => `\`${item.path}\` (score ${item.score}; ${item.reasons.join(", ")})`
      ),
      "No likely entrypoints were detected yet."
    );

    const boundaries = this.renderBullets(
      scan.directoryMap
        .filter((item) => item.kind === "directory")
        .slice(0, 8)
        .map((item) => `\`${item.path}\` behaves like ${item.role}.`),
      "Directory boundaries need human confirmation."
    );

    return `# Architecture

## Runtime Shape

This document captures a generic, scan-based view of the repository. It should be treated as an orientation aid, not as the final source of truth.

## Important Boundaries

${boundaries}

## Central Orchestration Points

${entrypoints}

## Risks And Unknowns

- Scan-based entrypoint detection may miss project-specific bootstrap files.
- Directory roles are inferred conservatively.
- Add human-confirmed architecture notes here when they matter for implementation safety.
`;
  }

  renderRepoMap(scan: RepositoryScanResult): string {
    const directoryRows = scan.directoryMap
      .map((item) => `- \`${item.path}\` (${item.kind}): ${item.role}`)
      .join("\n");

    return `# Repo Map

## Top-Level Directories

${directoryRows || "- No top-level entries detected."}

## High-Value Files

${this.renderBullets(
      scan.importantFiles.map((filePath) => `\`${filePath}\``),
      "No high-value files detected yet."
    )}

## Where To Add New Work

- Prefer existing source directories over creating new top-level areas.
- If a new top-level area is necessary, document why in the active change plan.
- When in doubt, inspect the highest-scoring entrypoints and nearby source folders first.

## Needs Human Confirmation

- Which top-level directories are primary product code versus support code.
- Where new modules should live by default.
- Which files are considered high-risk to edit.
`;
  }

  renderCodingRules(scan: RepositoryScanResult): string {
    return `# Coding Rules

## Hard Rules

${this.renderRuleBullets(scan.rules)}

## Recommended Practices

- Read the active change plan before editing code.
- Keep edits small and explain non-obvious decisions in the change files.
- Prefer preserving existing naming and structure conventions.

## Compatibility Expectations

- Avoid changing public or widely shared interfaces without documenting the reason.
- Record any migration note in \`apply.md\` when compatibility changes are unavoidable.

## Documentation Expectations

- Update project guidance when repo structure or conventions materially change.
- Record checks and remaining risks in \`verify.md\`.
`;
  }

  renderGlossary(scan: RepositoryScanResult): string {
    return `# Glossary

## Confirmed Terms

- Add human-confirmed business and technical terms here.

## Candidate Terms From Scan

${this.renderBullets(scan.glossarySeeds, "No candidate terms were detected yet.")}
`;
  }

  renderEntrypoints(scan: RepositoryScanResult): string {
    const lines = scan.entrypoints.map(
      (item) => `- \`${item.path}\`: ${item.reasons.join(", ")}`
    );

    return `# Entrypoints

## Likely Entrypoints

${this.renderBullets(
      lines.map((line) => line.replace(/^- /, "")),
      "No likely entrypoints detected yet."
    )}

## High-Risk Central Files

${this.renderBullets(
      scan.entrypoints.slice(0, 5).map((item) => `\`${item.path}\``),
      "No central files detected yet."
    )}

## Notes For Safe Investigation

- Start from the top-scoring files in this document.
- Treat highly connected files as higher-risk edit points.
- If you discover a true runtime bootstrap file, document it here.
`;
  }

  renderQuickstart(scan: RepositoryScanResult, config: OsliteConfig): string {
    const files = scan.importantFiles.slice(0, 6).map((filePath) => `- \`${filePath}\``);
    return `# Quickstart

## Read These First

- \`AGENTS.md\`
- \`CLAUDE.md\`
- \`${config.projectDocsRoot}/overview.md\`
- \`${config.projectDocsRoot}/architecture.md\`
- \`${config.projectDocsRoot}/repo-map.md\`

## How To Explore Safely

${this.renderBullets(files, "Start with the project docs.")}

## How To Choose Where Code Belongs

- Follow existing directory conventions before creating new top-level structure.
- Prefer local, bounded changes near the relevant entrypoint or source area.
- Record your decision in the active change plan when placement is ambiguous.

## What To Double-Check Before Editing

- Relevant project rules in \`${config.projectDocsRoot}/coding-rules.md\`
- Active change scope in \`changes/active/<change>/plan.md\`
- Whether the target file is a high-risk central file
`;
  }

  renderChangePlaybook(): string {
    return `# Change Playbook

## Start A Change

1. Create a change with \`oslite change new <slug> .\`
2. Capture the request in \`request.md\`
3. Write the intended approach in \`plan.md\`

## Plan Before Editing

- Clarify scope, affected files, and expected risks.
- Do not start broad refactors without writing them down first.

## Record Applied Work

- Update \`apply.md\` with the files you changed and any deviation from plan.
- Move the change status to \`applied\` when the implementation is complete locally.

## Record Verification

- Add checks, manual validation notes, and remaining risks to \`verify.md\`.
- Move the change status to \`verified\` after validation.

## Archive When Done

- Archive only after the change status is \`verified\`.
- Use \`oslite change archive <path>\` to move the change into history.
`;
  }

  private renderRuleBullets(rules: RuleItem[]): string {
    if (rules.length === 0) {
      return "- Add repository-specific rules here.";
    }
    return rules.map((rule) => `- ${rule.text}`).join("\n");
  }

  private renderBullets(items: string[], fallback: string): string {
    if (items.length === 0) {
      return `- ${fallback}`;
    }
    return items.map((item) => (item.startsWith("- ") ? item : `- ${item}`)).join("\n");
  }
}
