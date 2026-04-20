import {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START
} from "../core/ospec-lite-schema";
import {
  LoadedOSpecLiteProfile,
  OSpecLiteConfig,
  ProfileTemplateValues,
  RepositoryScanResult
} from "../core/ospec-lite-types";
import { CodexAdapter } from "../agents/ospec-lite-codex-adapter";
import { ClaudeCodeAdapter } from "../agents/ospec-lite-claude-code-adapter";
import { AgentManagedSection } from "../agents/ospec-lite-agent-target-types";
import { MarkdownRenderer } from "../render/ospec-lite-markdown-renderer";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";
import { BugTemplateService } from "../bug/ospec-lite-bug-template-service";

export interface KnowledgeArtifacts {
  summary: string;
  codexSection: AgentManagedSection;
  claudeSection: AgentManagedSection;
  humanDocSuggestions: Record<string, string>;
  profileTemplateValues?: ProfileTemplateValues;
}

export class KnowledgeTemplateService {
  private readonly codexAdapter = new CodexAdapter();
  private readonly claudeAdapter = new ClaudeCodeAdapter();
  private readonly bugTemplates = new BugTemplateService();

  constructor(
    private readonly renderer: MarkdownRenderer,
    private readonly profiles: ProfileLoader
  ) {}

  buildArtifacts(
    scan: RepositoryScanResult,
    config: OSpecLiteConfig,
    profile?: LoadedOSpecLiteProfile | null
  ): KnowledgeArtifacts {
    const summary = this.buildSummary(scan);
    return profile
      ? this.buildProfileArtifacts(scan, config, profile, summary)
      : this.buildGenericArtifacts(scan, config, summary);
  }

  buildSummary(scan: {
    signals: Record<string, boolean>;
    directoryMap: { path: string; kind: string }[];
  }): string {
    const workingAreas = scan.directoryMap
      .filter((item) => item.kind === "directory")
      .slice(0, 3)
      .map((item) => item.path);

    const summaryParts: string[] = ["A repository initialized for agent-guided development."];
    if (scan.signals.hasPackageJson) {
      summaryParts.push("It includes a Node or JavaScript toolchain signal.");
    }
    if (workingAreas.length > 0) {
      summaryParts.push(`Main working areas include ${workingAreas.join(", ")}.`);
    }
    return summaryParts.join(" ");
  }

  private buildGenericArtifacts(
    scan: RepositoryScanResult,
    config: OSpecLiteConfig,
    summary: string
  ): KnowledgeArtifacts {
    const humanDocSuggestions: Record<string, string> = {
      [`${config.projectDocsRoot}/overview.md`]: this.renderer.renderOverview(scan, config),
      [`${config.projectDocsRoot}/architecture.md`]: this.renderer.renderArchitecture(scan),
      [`${config.projectDocsRoot}/repo-map.md`]: this.renderer.renderRepoMap(scan),
      [`${config.projectDocsRoot}/coding-rules.md`]: this.renderer.renderCodingRules(scan),
      [`${config.projectDocsRoot}/glossary.md`]: this.renderer.renderGlossary(scan),
      [`${config.projectDocsRoot}/entrypoints.md`]: this.renderer.renderEntrypoints(scan),
      [`${config.agentDocsRoot}/quickstart.md`]: this.renderer.renderQuickstart(scan, config),
      [`${config.agentDocsRoot}/change-playbook.md`]: this.renderer.renderChangePlaybook(),
      [`${config.agentDocsRoot}/bug-playbook.md`]: this.bugTemplates.renderPlaybook()
    };

    const sharedInput = this.buildAgentSectionInput(scan, config, summary);

    return {
      summary,
      humanDocSuggestions,
      codexSection: this.codexAdapter.buildSection(sharedInput),
      claudeSection: this.claudeAdapter.buildSection(sharedInput)
    };
  }

  private buildProfileArtifacts(
    scan: RepositoryScanResult,
    config: OSpecLiteConfig,
    profile: LoadedOSpecLiteProfile,
    summary: string
  ): KnowledgeArtifacts {
    const values = this.createProfileTemplateValues(scan, config, profile, summary);
    const sharedInput = this.buildAgentSectionInput(scan, config, summary);
    const humanDocSuggestions: Record<string, string> = {};
    let codexSection = this.codexAdapter.buildSection(sharedInput);
    let claudeSection = this.claudeAdapter.buildSection(sharedInput);

    for (const asset of profile.assets) {
      if (asset.mode === "managed-codex-section") {
        codexSection = {
          title: "AGENTS",
          content: this.profiles.renderAsset(profile, asset, {
            ...values,
            managedStart: AGENTS_MANAGED_START,
            managedEnd: AGENTS_MANAGED_END
          }),
          managedStart: AGENTS_MANAGED_START,
          managedEnd: AGENTS_MANAGED_END
        };
        continue;
      }

      if (asset.mode === "managed-claude-section") {
        claudeSection = {
          title: "CLAUDE",
          content: this.profiles.renderAsset(profile, asset, {
            ...values,
            managedStart: CLAUDE_MANAGED_START,
            managedEnd: CLAUDE_MANAGED_END
          }),
          managedStart: CLAUDE_MANAGED_START,
          managedEnd: CLAUDE_MANAGED_END
        };
        continue;
      }

      if (this.isHumanDocTarget(asset.target, config)) {
        humanDocSuggestions[asset.target] = this.profiles.renderAsset(profile, asset, values);
      }
    }

    return {
      summary,
      codexSection,
      claudeSection,
      humanDocSuggestions,
      profileTemplateValues: values
    };
  }

  private buildAgentSectionInput(
    scan: RepositoryScanResult,
    config: OSpecLiteConfig,
    summary: string
  ) {
    const commands = scan.tooling.commands;
    const preferredCommands = [
      this.asCommandHint("Install", commands.install),
      this.asCommandHint("Start", commands.dev ?? commands.start),
      this.asCommandHint("Build", commands.build),
      this.asCommandHint("Test", commands.test)
    ].filter((value): value is string => Boolean(value));

    const verificationCommands = [
      this.asCommandHint("Test", commands.test),
      this.asCommandHint("Typecheck", commands.typecheck),
      this.asCommandHint("Lint", commands.lint),
      this.asCommandHint("Build", commands.build)
    ].filter((value): value is string => Boolean(value));

    return {
      projectName: config.projectName ?? scan.projectName,
      summary,
      docsRoot: config.projectDocsRoot,
      agentDocsRoot: config.agentDocsRoot,
      rules: scan.rules.map((rule) => rule.text),
      importantFiles: scan.importantFiles,
      preferredCommands,
      verificationCommands,
      generatedFiles: scan.generatedDirectories,
      askBeforeEditAreas: scan.askFirstAreas.map(
        (item) => `\`${item.path}\`: ${item.reason}`
      )
    };
  }

  private createProfileTemplateValues(
    scan: RepositoryScanResult,
    config: OSpecLiteConfig,
    profile: LoadedOSpecLiteProfile,
    summary: string
  ): ProfileTemplateValues {
    return {
      projectName: config.projectName ?? scan.projectName,
      summary,
      documentLanguage: config.documentLanguage,
      bootstrapAgent: config.bootstrapAgent ?? "none",
      docsRoot: config.projectDocsRoot,
      agentDocsRoot: config.agentDocsRoot,
      authoringPackRoot: config.authoringPackRoot ?? "",
      profileId: profile.id,
      managedStart: "",
      managedEnd: ""
    };
  }

  private isHumanDocTarget(targetPath: string, config: OSpecLiteConfig): boolean {
    const normalizedTarget = targetPath.replace(/\\/g, "/");
    const projectDocsRoot = `${config.projectDocsRoot}/`;
    const agentDocsRoot = `${config.agentDocsRoot}/`;
    return (
      normalizedTarget.startsWith(projectDocsRoot) ||
      normalizedTarget.startsWith(agentDocsRoot)
    );
  }

  private asCommandHint(label: string, command?: string): string | null {
    if (!command) {
      return null;
    }

    return `${label}: \`${command}\``;
  }
}
