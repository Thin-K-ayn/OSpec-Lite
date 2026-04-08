import * as fs from "node:fs";
import * as path from "node:path";
import { OSpecLiteConfig, RepositoryScanResult, RuleItem } from "../core/ospec-lite-types";

export class MarkdownRenderer {
  private readonly templateCache = new Map<string, string>();

  constructor(
    private readonly templateRoot = path.join(__dirname, "templates")
  ) {}

  renderOverview(scan: RepositoryScanResult, config: OSpecLiteConfig): string {
    const areas = scan.directoryMap
      .filter((item) => item.kind === "directory")
      .slice(0, 10)
      .map((item) => `- \`${item.path}\`: ${item.role}`)
      .join("\n");

    const signals = Object.entries(scan.signals)
      .filter(([, value]) => value)
      .map(([key]) => `- ${key}`)
      .join("\n");

    return this.renderTemplate("overview.md", {
      projectName: scan.projectName,
      agentTargets: config.agentTargets.join(", "),
      repoSignals: signals || "- No strong repo signals detected yet.",
      mainWorkingAreas: areas || "- No top-level working areas detected yet."
    });
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

    return this.renderTemplate("architecture.md", {
      importantBoundaries: boundaries,
      centralOrchestrationPoints: entrypoints
    });
  }

  renderRepoMap(scan: RepositoryScanResult): string {
    const directoryRows = scan.directoryMap
      .map((item) => `- \`${item.path}\` (${item.kind}): ${item.role}`)
      .join("\n");

    return this.renderTemplate("repo-map.md", {
      topLevelDirectories: directoryRows || "- No top-level entries detected.",
      highValueFiles: this.renderBullets(
        scan.importantFiles.map((filePath) => `\`${filePath}\``),
        "No high-value files detected yet."
      )
    });
  }

  renderCodingRules(scan: RepositoryScanResult): string {
    return this.renderTemplate("coding-rules.md", {
      hardRules: this.renderRuleBullets(scan.rules)
    });
  }

  renderGlossary(scan: RepositoryScanResult): string {
    return this.renderTemplate("glossary.md", {
      candidateTerms: this.renderBullets(
        scan.glossarySeeds,
        "No candidate terms were detected yet."
      )
    });
  }

  renderEntrypoints(scan: RepositoryScanResult): string {
    const lines = scan.entrypoints.map(
      (item) => `- \`${item.path}\`: ${item.reasons.join(", ")}`
    );

    return this.renderTemplate("entrypoints.md", {
      likelyEntrypoints: this.renderBullets(
        lines.map((line) => line.replace(/^- /, "")),
        "No likely entrypoints detected yet."
      ),
      highRiskCentralFiles: this.renderBullets(
        scan.entrypoints.slice(0, 5).map((item) => `\`${item.path}\``),
        "No central files detected yet."
      )
    });
  }

  renderQuickstart(scan: RepositoryScanResult, config: OSpecLiteConfig): string {
    const files = scan.importantFiles.slice(0, 6).map((filePath) => `- \`${filePath}\``);
    return this.renderTemplate("quickstart.md", {
      projectDocsRoot: config.projectDocsRoot,
      safeExploration: this.renderBullets(files, "Start with the project docs.")
    });
  }

  renderChangePlaybook(): string {
    return this.renderTemplate("change-playbook.md", {});
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

  private renderTemplate(
    templateName: string,
    values: Record<string, string>
  ): string {
    const template = this.loadTemplate(templateName);
    return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => {
      return values[key] ?? "";
    });
  }

  private loadTemplate(templateName: string): string {
    const cached = this.templateCache.get(templateName);
    if (cached) {
      return cached;
    }

    const templatePath = path.join(this.templateRoot, templateName);
    const template = fs.readFileSync(templatePath, "utf8");
    this.templateCache.set(templateName, template);
    return template;
  }
}
