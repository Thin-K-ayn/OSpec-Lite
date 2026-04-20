import {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START
} from "../core/ospec-lite-schema";
import { AgentTemplateService } from "./ospec-lite-agent-template-service";
import { AgentAdapter } from "./ospec-lite-agent-target-types";

export class CodexAdapter implements AgentAdapter {
  public readonly target = "codex" as const;
  public readonly fileName = "AGENTS.md";
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
    const hardRules = input.rules.map((rule) => `- ${rule}`).join("\n");
    const highRiskAreas = input.importantFiles
      .slice(0, 5)
      .map((filePath) => `- \`${filePath}\``)
      .join("\n");
    const content = this.templates.renderTemplate("agents.md", {
      managedStart: AGENTS_MANAGED_START,
      managedEnd: AGENTS_MANAGED_END,
      projectName: input.projectName,
      summary: input.summary,
      docsRoot: input.docsRoot,
      agentDocsRoot: input.agentDocsRoot,
      hardRules,
      highRiskAreas: highRiskAreas || "- Review the project docs first.",
      preferredCommands: this.renderBullets(
        input.preferredCommands,
        "No preferred commands detected yet. Inspect local tooling before running broad commands."
      ),
      verificationCommands: this.renderBullets(
        input.verificationCommands,
        "No verification commands detected yet. Add the checks you trust for this repo."
      ),
      generatedFiles: this.renderBullets(
        input.generatedFiles.map((filePath) => `\`${filePath}\``),
        "No generated directories detected yet."
      ),
      askBeforeEditAreas: this.renderBullets(
        input.askBeforeEditAreas,
        "No explicit ask-before-edit areas detected yet, but still confirm risky changes."
      )
    });

    return {
      title: "AGENTS",
      content,
      managedStart: AGENTS_MANAGED_START,
      managedEnd: AGENTS_MANAGED_END
    };
  }

  private renderBullets(items: string[], fallback: string): string {
    if (items.length === 0) {
      return `- ${fallback}`;
    }

    return items.map((item) => (item.startsWith("- ") ? item : `- ${item}`)).join("\n");
  }
}
