import {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START
} from "../core/ospec-lite-schema";
import { AgentAdapter } from "./agent-target-types";

export class CodexAdapter implements AgentAdapter {
  public readonly target = "codex" as const;
  public readonly fileName = "AGENTS.md";

  buildSection(input: {
    projectName: string;
    summary: string;
    docsRoot: string;
    agentDocsRoot: string;
    rules: string[];
    importantFiles: string[];
  }) {
    const ruleLines = input.rules.map((rule) => `- ${rule}`).join("\n");
    const fileLines = input.importantFiles
      .slice(0, 5)
      .map((filePath) => `- \`${filePath}\``)
      .join("\n");

    const content = `# Agent Guide

${AGENTS_MANAGED_START}
## OSpec Lite

### What This Repo Is

- Project: ${input.projectName}
- Summary: ${input.summary}

### Hard Rules

${ruleLines}

### High-Value Files

${fileLines || "- Review the project docs first."}

### Read Next

- \`${input.docsRoot}/overview.md\`
- \`${input.docsRoot}/architecture.md\`
- \`${input.docsRoot}/repo-map.md\`
- \`${input.docsRoot}/coding-rules.md\`
- \`${input.agentDocsRoot}/change-playbook.md\`
${AGENTS_MANAGED_END}
`;

    return {
      title: "AGENTS",
      content,
      managedStart: AGENTS_MANAGED_START,
      managedEnd: AGENTS_MANAGED_END
    };
  }
}
