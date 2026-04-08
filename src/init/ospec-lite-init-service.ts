import * as path from "node:path";
import {
  AGENTS_FILE,
  CLAUDE_FILE,
  DEFAULT_DOCUMENT_LANGUAGE,
  INIT_MARKERS,
  OSPEC_LITE_DIR
} from "../core/ospec-lite-schema";
import {
  DocumentLanguage,
  InitResult,
  InitState,
  OSpecLiteConfig
} from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";
import { AgentEntryService } from "../agents/ospec-lite-agent-entry-service";
import { CodexAdapter } from "../agents/ospec-lite-codex-adapter";
import { ClaudeCodeAdapter } from "../agents/ospec-lite-claude-code-adapter";
import { ScanService } from "./ospec-lite-scan-service";
import { MarkdownRenderer } from "../render/ospec-lite-markdown-renderer";
import { IndexService } from "./ospec-lite-index-service";

export class InitService {
  constructor(
    private readonly repo: FileRepo,
    private readonly scanner: ScanService,
    private readonly renderer: MarkdownRenderer,
    private readonly agentEntries: AgentEntryService,
    private readonly indexService: IndexService
  ) {}

  async getInitState(rootDir: string): Promise<InitResult> {
    const missingMarkers: string[] = [];
    for (const marker of INIT_MARKERS) {
      if (!(await this.repo.exists(path.join(rootDir, marker)))) {
        missingMarkers.push(marker);
      }
    }

    const configPath = path.join(rootDir, OSPEC_LITE_DIR, "config.json");
    const indexPath = path.join(rootDir, OSPEC_LITE_DIR, "index.json");
    const state: InitState =
      missingMarkers.length === INIT_MARKERS.length
        ? "uninitialized"
        : missingMarkers.length === 0
          ? "initialized"
          : "incomplete";

    return {
      state,
      configPath,
      indexPath,
      missingMarkers
    };
  }

  async init(rootDir: string, documentLanguage?: DocumentLanguage): Promise<InitResult> {
    const initState = await this.getInitState(rootDir);
    if (initState.state !== "uninitialized") {
      return initState;
    }

    const language = documentLanguage ?? DEFAULT_DOCUMENT_LANGUAGE;
    const config = this.createConfig(language);
    const scan = await this.scanner.scan(rootDir);
    const summary = this.buildSummary(scan);

    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR));
    await this.repo.ensureDir(path.join(rootDir, "docs", "project"));
    await this.repo.ensureDir(path.join(rootDir, "docs", "agents"));
    await this.repo.ensureDir(path.join(rootDir, "changes", "active"));
    await this.repo.ensureDir(path.join(rootDir, "changes", "archived"));

    await this.repo.writeJson(path.join(rootDir, OSPEC_LITE_DIR, "config.json"), config);
    await this.repo.writeJson(
      path.join(rootDir, OSPEC_LITE_DIR, "index.json"),
      this.indexService.buildIndex(scan, config)
    );

    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "project", "overview.md"),
      this.renderer.renderOverview(scan, config)
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "project", "architecture.md"),
      this.renderer.renderArchitecture(scan)
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "project", "repo-map.md"),
      this.renderer.renderRepoMap(scan)
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "project", "coding-rules.md"),
      this.renderer.renderCodingRules(scan)
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "project", "glossary.md"),
      this.renderer.renderGlossary(scan)
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "project", "entrypoints.md"),
      this.renderer.renderEntrypoints(scan)
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "agents", "quickstart.md"),
      this.renderer.renderQuickstart(scan, config)
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, "docs", "agents", "change-playbook.md"),
      this.renderer.renderChangePlaybook()
    );

    const codexAdapter = new CodexAdapter();
    const codexSection = codexAdapter.buildSection({
      projectName: scan.projectName,
      summary,
      docsRoot: "docs/project",
      agentDocsRoot: "docs/agents",
      rules: scan.rules.map((rule) => rule.text),
      importantFiles: scan.importantFiles
    });
    await this.agentEntries.ensureManagedSection(
      rootDir,
      codexAdapter,
      codexSection.content,
      codexSection.managedStart,
      codexSection.managedEnd
    );

    const claudeAdapter = new ClaudeCodeAdapter();
    const claudeSection = claudeAdapter.buildSection({
      projectName: scan.projectName,
      summary,
      docsRoot: "docs/project",
      agentDocsRoot: "docs/agents",
      rules: scan.rules.map((rule) => rule.text),
      importantFiles: scan.importantFiles
    });
    await this.agentEntries.ensureManagedSection(
      rootDir,
      claudeAdapter,
      claudeSection.content,
      claudeSection.managedStart,
      claudeSection.managedEnd
    );

    return this.getInitState(rootDir);
  }

  private createConfig(documentLanguage: DocumentLanguage): OSpecLiteConfig {
    return {
      version: 1,
      documentLanguage,
      initializedAt: new Date().toISOString(),
      agentTargets: ["codex", "claude-code"],
      agentEntryFiles: {
        codex: AGENTS_FILE,
        "claude-code": CLAUDE_FILE
      },
      projectDocsRoot: "docs/project",
      agentDocsRoot: "docs/agents",
      changeRoot: "changes",
      archiveLayout: "date-slug"
    };
  }

  private buildSummary(scan: {
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
}
