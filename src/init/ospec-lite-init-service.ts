import { createHash } from "node:crypto";
import * as path from "node:path";
import {
  AGENTS_FILE,
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
  AUTHORING_PACK_FILES,
  BUG_ACTIVE_BUGS_PATH,
  BUG_MEMORY_DIR,
  BUG_MEMORY_PATH,
  CLAUDE_FILE,
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START,
  DEFAULT_DOCUMENT_LANGUAGE,
  INIT_MARKERS,
  OSPEC_LITE_DIR
} from "../core/ospec-lite-schema";
import {
  BootstrapAgent,
  DocumentLanguage,
  HostAgent,
  InitBootstrapPlan,
  InitOptions,
  InitResult,
  InitState,
  LoadedOSpecLiteProfile,
  OSpecLiteConfig,
  ProfileTemplateValues
} from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";
import { AgentEntryService } from "../agents/ospec-lite-agent-entry-service";
import { CodexAdapter } from "../agents/ospec-lite-codex-adapter";
import { ClaudeCodeAdapter } from "../agents/ospec-lite-claude-code-adapter";
import { ScanService } from "./ospec-lite-scan-service";
import { MarkdownRenderer } from "../render/ospec-lite-markdown-renderer";
import { IndexService } from "./ospec-lite-index-service";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";
import { ProfilePreconditionError } from "../core/ospec-lite-errors";
import { KnowledgeTemplateService } from "./ospec-lite-knowledge-template-service";
import { BugTemplateService } from "../bug/ospec-lite-bug-template-service";

export class InitService {
  private static readonly bootstrapCommands: Record<Exclude<BootstrapAgent, "none">, string> = {
    codex: "Use $oslite-fill-project-docs to fill the project docs for this repo.",
    "claude-code": "/oslite-fill-project-docs"
  };
  private readonly knowledge: KnowledgeTemplateService;
  private readonly bugTemplates = new BugTemplateService();

  constructor(
    private readonly repo: FileRepo,
    private readonly scanner: ScanService,
    renderer: MarkdownRenderer,
    private readonly agentEntries: AgentEntryService,
    private readonly indexService: IndexService,
    private readonly profiles: ProfileLoader
  ) {
    this.knowledge = new KnowledgeTemplateService(renderer, profiles);
  }

  async getInitState(rootDir: string): Promise<InitResult> {
    const configPath = path.join(rootDir, OSPEC_LITE_DIR, "config.json");
    const indexPath = path.join(rootDir, OSPEC_LITE_DIR, "index.json");
    const hasBootstrapArtifacts =
      (await this.repo.exists(configPath)) || (await this.repo.exists(indexPath));
    const config =
      hasBootstrapArtifacts && (await this.repo.exists(configPath))
        ? await this.tryReadConfig(configPath)
        : null;

    const missingMarkers: string[] = [];
    for (const marker of this.getExpectedMarkers(
      config?.authoringPackRoot,
      config?.profileOutputs
    )) {
      if (!(await this.repo.exists(path.join(rootDir, marker)))) {
        missingMarkers.push(marker);
      }
    }

    const state: InitState =
      !hasBootstrapArtifacts
        ? "uninitialized"
        : missingMarkers.length === 0
          ? "initialized"
          : "incomplete";

    return {
      state,
      configPath,
      indexPath,
      missingMarkers,
      config
    };
  }

  async init(rootDir: string, options: InitOptions = {}): Promise<InitResult> {
    const initState = await this.getInitState(rootDir);
    if (initState.state !== "uninitialized") {
      return initState;
    }

    const profile = options.profileId ? await this.profiles.loadProfile(options.profileId) : null;
    if (profile) {
      await this.ensureProfileRequirements(rootDir, profile);
    }
    const language =
      options.documentLanguage ?? profile?.documentLanguage ?? DEFAULT_DOCUMENT_LANGUAGE;
    const scan = await this.scanner.scan(rootDir);
    const projectName = options.projectName?.trim() || scan.projectName;
    const config = this.createConfig(
      language,
      profile,
      profile ? projectName : undefined,
      profile ? options.bootstrapAgent : undefined
    );
    const artifacts = this.knowledge.buildArtifacts(scan, config, profile);

    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR));
    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR, "bugs"));
    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR, "docs", "project"));
    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR, "docs", "agents"));
    await this.repo.ensureDir(path.join(rootDir, BUG_MEMORY_DIR));
    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR, "changes", "active"));
    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR, "changes", "archived"));
    if (config.authoringPackRoot) {
      await this.repo.ensureDir(path.join(rootDir, config.authoringPackRoot));
    }

    await this.repo.writeJson(path.join(rootDir, OSPEC_LITE_DIR, "config.json"), config);
    await this.repo.writeJson(
      path.join(rootDir, OSPEC_LITE_DIR, "index.json"),
      this.indexService.buildIndex(scan, config, this.hashSuggestions(artifacts.humanDocSuggestions))
    );

    await this.writeHumanDocSuggestionsIfMissing(rootDir, artifacts.humanDocSuggestions);
    await this.repo.writeTextIfMissing(
      path.join(rootDir, BUG_ACTIVE_BUGS_PATH),
      this.bugTemplates.renderQueue()
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, BUG_MEMORY_PATH),
      this.bugTemplates.renderMemoryIndex(null, [])
    );
    await this.writeManagedSections(
      rootDir,
      artifacts.codexSection.content,
      artifacts.claudeSection.content
    );
    if (profile && artifacts.profileTemplateValues) {
      await this.applyProfileSupportAssets(
        rootDir,
        profile,
        artifacts.profileTemplateValues,
        new Set(Object.keys(artifacts.humanDocSuggestions))
      );
    }

    const result = await this.getInitState(rootDir);
    result.config = config;
    result.bootstrapPlan = this.buildBootstrapPlan(config, options.hostAgent ?? "unknown");
    return result;
  }

  private createConfig(
    documentLanguage: DocumentLanguage,
    profile: LoadedOSpecLiteProfile | null,
    projectName?: string,
    bootstrapAgent?: BootstrapAgent
  ): OSpecLiteConfig {
    return {
      version: 1,
      documentLanguage,
      initializedAt: new Date().toISOString(),
      agentTargets: ["codex", "claude-code"],
      agentEntryFiles: {
        codex: AGENTS_FILE,
        "claude-code": CLAUDE_FILE
      },
      agentWrapperFiles: profile?.agentWrapperFiles,
      projectName,
      bootstrapAgent,
      projectDocsRoot: ".oslite/docs/project",
      agentDocsRoot: ".oslite/docs/agents",
      changeRoot: ".oslite/changes",
      archiveLayout: "date-slug",
      profileId: profile?.id,
      authoringPackRoot: profile?.authoringPackRoot,
      profileOutputs: profile?.outputs
    };
  }

  private async tryReadConfig(configPath: string): Promise<OSpecLiteConfig | null> {
    try {
      return await this.repo.readJson<OSpecLiteConfig>(configPath);
    } catch {
      return null;
    }
  }

  private getExpectedMarkers(authoringPackRoot?: string, profileOutputs?: string[]): string[] {
    const markers = new Set<string>(INIT_MARKERS);

    if (authoringPackRoot) {
      for (const fileName of AUTHORING_PACK_FILES) {
        markers.add(path.join(authoringPackRoot, fileName).replace(/\\/g, "/"));
      }
    }

    for (const output of profileOutputs ?? []) {
      markers.add(output);
    }

    return [...markers];
  }

  private async writeHumanDocSuggestionsIfMissing(
    rootDir: string,
    suggestions: Record<string, string>
  ): Promise<void> {
    for (const [relativePath, content] of Object.entries(suggestions)) {
      await this.repo.writeTextIfMissing(path.join(rootDir, relativePath), content);
    }
  }

  private async writeManagedSections(
    rootDir: string,
    codexContent: string,
    claudeContent: string
  ): Promise<void> {
    const codexAdapter = new CodexAdapter();
    await this.agentEntries.ensureManagedSection(
      rootDir,
      codexAdapter,
      codexContent,
      AGENTS_MANAGED_START,
      AGENTS_MANAGED_END
    );

    const claudeAdapter = new ClaudeCodeAdapter();
    await this.agentEntries.ensureManagedSection(
      rootDir,
      claudeAdapter,
      claudeContent,
      CLAUDE_MANAGED_START,
      CLAUDE_MANAGED_END
    );
  }

  private async applyProfileSupportAssets(
    rootDir: string,
    profile: LoadedOSpecLiteProfile,
    values: ProfileTemplateValues,
    humanDocTargets: Set<string>
  ): Promise<void> {
    for (const asset of profile.assets) {
      if (asset.mode || humanDocTargets.has(asset.target)) {
        continue;
      }

      const content = this.profiles.renderAsset(profile, asset, values);
      await this.repo.writeTextIfMissing(path.join(rootDir, asset.target), content);
    }
  }

  private hashSuggestions(suggestions: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(suggestions).map(([filePath, content]) => [
        filePath,
        this.hashContent(content)
      ])
    );
  }

  private hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private async ensureProfileRequirements(
    rootDir: string,
    profile: LoadedOSpecLiteProfile
  ): Promise<void> {
    const missingPaths: string[] = [];
    for (const relativePath of profile.requiredRepoPaths ?? []) {
      if (!(await this.repo.exists(path.join(rootDir, relativePath)))) {
        missingPaths.push(relativePath);
      }
    }

    if (missingPaths.length > 0) {
      throw new ProfilePreconditionError(profile.id, missingPaths);
    }
  }

  private buildBootstrapPlan(
    config: OSpecLiteConfig,
    hostAgent: HostAgent
  ): InitBootstrapPlan | null {
    const bootstrapAgent = config.bootstrapAgent;
    if (!bootstrapAgent) {
      return null;
    }

    if (bootstrapAgent === "none") {
      return {
        bootstrapAgent,
        hostAgent,
        shouldBootstrapNow: false,
        nextStep: "No bootstrap step configured."
      };
    }

    const wrapperPath = config.agentWrapperFiles?.[bootstrapAgent]?.[0];
    return {
      bootstrapAgent,
      hostAgent,
      wrapperPath,
      shouldBootstrapNow: hostAgent === bootstrapAgent,
      nextStep: InitService.bootstrapCommands[bootstrapAgent]
    };
  }
}
