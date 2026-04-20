import {
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START
} from "../core/ospec-lite-schema";
import { AgentTemplateService } from "./ospec-lite-agent-template-service";
import { AgentAdapter } from "./ospec-lite-agent-target-types";

export class ClaudeCodeAdapter implements AgentAdapter {
  public readonly target = "claude-code" as const;
  public readonly fileName = "CLAUDE.md";
  private readonly templates = new AgentTemplateService();

  buildSection(input: {
    projectName: string;
    summary: string;
    docsRoot: string;
    agentDocsRoot: string;
    rules: string[];
    importantFiles: string[];
    preferredCommands: string[];
    verificationCommands: string[];
    generatedFiles: string[];
    askBeforeEditAreas: string[];
  }) {
    const content = this.templates.renderTemplate("claude.md", {
      managedStart: CLAUDE_MANAGED_START,
      managedEnd: CLAUDE_MANAGED_END,
      projectName: input.projectName,
      summary: input.summary,
      docsRoot: input.docsRoot,
      agentDocsRoot: input.agentDocsRoot,
      hardRules: input.rules.map((rule) => `- ${rule}`).join("\n"),
      highValueFiles: input.importantFiles
        .slice(0, 5)
        .map((filePath) => `- \`${filePath}\``)
        .join("\n")
    });

    return {
      title: "CLAUDE",
      content,
      managedStart: CLAUDE_MANAGED_START,
      managedEnd: CLAUDE_MANAGED_END
    };
  }
}
