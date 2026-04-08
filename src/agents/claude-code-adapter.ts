import {
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START
} from "../core/ospec-lite-schema";
import { AgentAdapter } from "./agent-target-types";

export class ClaudeCodeAdapter implements AgentAdapter {
  public readonly target = "claude-code" as const;
  public readonly fileName = "CLAUDE.md";

  buildSection(input: {
    projectName: string;
    summary: string;
    docsRoot: string;
    agentDocsRoot: string;
    rules: string[];
    importantFiles: string[];
  }) {
    const content = `# Claude Code Project Memory

${CLAUDE_MANAGED_START}
@AGENTS.md

## Claude Code Notes

- Project: ${input.projectName}
- Summary: ${input.summary}
- Use @${input.agentDocsRoot}/quickstart.md for quick orientation.
- Use @${input.agentDocsRoot}/change-playbook.md for the lightweight change flow.
${CLAUDE_MANAGED_END}
`;

    return {
      title: "CLAUDE",
      content,
      managedStart: CLAUDE_MANAGED_START,
      managedEnd: CLAUDE_MANAGED_END
    };
  }
}
