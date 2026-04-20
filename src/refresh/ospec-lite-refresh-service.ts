import { createHash } from "node:crypto";
import * as path from "node:path";
import { AgentEntryService } from "../agents/ospec-lite-agent-entry-service";
import { CodexAdapter } from "../agents/ospec-lite-codex-adapter";
import { ClaudeCodeAdapter } from "../agents/ospec-lite-claude-code-adapter";
import { RefreshStateError } from "../core/ospec-lite-errors";
import { OSpecLiteIndex, RefreshReport } from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";
import {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START
} from "../core/ospec-lite-schema";
import { IndexService } from "../init/ospec-lite-index-service";
import { KnowledgeTemplateService } from "../init/ospec-lite-knowledge-template-service";
import { ScanService } from "../init/ospec-lite-scan-service";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";
import { StatusService } from "../status/ospec-lite-status-service";

export class RefreshService {
  constructor(
    private readonly repo: FileRepo,
    private readonly scanner: ScanService,
    private readonly agentEntries: AgentEntryService,
    private readonly indexService: IndexService,
    private readonly profiles: ProfileLoader,
    private readonly statusService: StatusService,
    private readonly knowledge: KnowledgeTemplateService
  ) {}

  async refresh(rootDir: string): Promise<RefreshReport> {
    const status = await this.statusService.getStatus(rootDir);
    if (status.state === "uninitialized" || status.state === "incomplete") {
      throw new RefreshStateError(rootDir, status.state, status.missingMarkers);
    }
    if (!status.config) {
      throw new RefreshStateError(rootDir, "incomplete", status.missingMarkers);
    }

    const config = status.config;
    const profile = config.profileId ? await this.profiles.loadProfile(config.profileId) : null;
    const scan = await this.scanner.scan(rootDir);
    const artifacts = this.knowledge.buildArtifacts(scan, config, profile);
    const nextHashes = this.hashSuggestions(artifacts.humanDocSuggestions);
    const indexPath = path.join(rootDir, ".oslite", "index.json");
    const previousIndex = await this.readIndex(indexPath);
    const comparison = this.compareSuggestionHashes(previousIndex?.docSuggestionHashes, nextHashes);
    const updatedArtifacts: string[] = [];

    const nextIndex = this.indexService.buildIndex(scan, config, nextHashes);
    if (await this.writeJsonIfChanged(indexPath, nextIndex)) {
      updatedArtifacts.push(".oslite/index.json");
    }
    if (
      await this.agentEntries.ensureManagedSection(
        rootDir,
        new CodexAdapter(),
        artifacts.codexSection.content,
        AGENTS_MANAGED_START,
        AGENTS_MANAGED_END
      )
    ) {
      updatedArtifacts.push("AGENTS.md");
    }
    if (
      await this.agentEntries.ensureManagedSection(
        rootDir,
        new ClaudeCodeAdapter(),
        artifacts.claudeSection.content,
        CLAUDE_MANAGED_START,
        CLAUDE_MANAGED_END
      )
    ) {
      updatedArtifacts.push("CLAUDE.md");
    }

    return {
      rootDir,
      updatedArtifacts,
      reviewNeededDocs: comparison.reviewNeededDocs,
      baselineInitializedDocs: comparison.baselineInitializedDocs
    };
  }

  private async readIndex(indexPath: string): Promise<OSpecLiteIndex | null> {
    if (!(await this.repo.exists(indexPath))) {
      return null;
    }

    try {
      return await this.repo.readJson<OSpecLiteIndex>(indexPath);
    } catch {
      return null;
    }
  }

  private hashSuggestions(suggestions: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(suggestions).map(([filePath, content]) => [
        filePath,
        createHash("sha256").update(content).digest("hex")
      ])
    );
  }

  private compareSuggestionHashes(
    previousHashes: Record<string, string> | undefined,
    nextHashes: Record<string, string>
  ): {
    reviewNeededDocs: string[];
    baselineInitializedDocs: string[];
  } {
    const reviewNeededDocs: string[] = [];
    const baselineInitializedDocs: string[] = [];

    for (const filePath of Object.keys(nextHashes).sort((left, right) => left.localeCompare(right))) {
      const previousHash = previousHashes?.[filePath];
      if (!previousHash) {
        baselineInitializedDocs.push(filePath);
        continue;
      }

      if (previousHash !== nextHashes[filePath]) {
        reviewNeededDocs.push(filePath);
      }
    }

    return {
      reviewNeededDocs,
      baselineInitializedDocs
    };
  }

  private async writeJsonIfChanged(targetPath: string, value: unknown): Promise<boolean> {
    const nextContent = `${JSON.stringify(value, null, 2)}\n`;
    const existingContent =
      (await this.repo.exists(targetPath)) ? await this.repo.readText(targetPath) : null;

    if (existingContent === nextContent) {
      return false;
    }

    await this.repo.writeText(targetPath, nextContent);
    return true;
  }
}
