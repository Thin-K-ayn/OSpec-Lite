import { createHash } from "node:crypto";
import * as path from "node:path";
import { AgentEntryService } from "../agents/ospec-lite-agent-entry-service";
import { ClaudeCodeAdapter } from "../agents/ospec-lite-claude-code-adapter";
import { CodexAdapter } from "../agents/ospec-lite-codex-adapter";
import {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
  BUG_ACTIVE_BUGS_PATH,
  BUG_INDEX_PATH,
  BUG_MEMORY_DIR,
  BUG_MEMORY_PATH,
  BUG_PLAYBOOK_PATH,
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START,
  OSPEC_LITE_DIR
} from "../core/ospec-lite-schema";
import {
  LoadedOSpecLiteProfile,
  OSpecLiteIndex,
  UpdateAction,
  UpdateResult
} from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";
import { BugService } from "../bug/ospec-lite-bug-service";
import { IndexService } from "../init/ospec-lite-index-service";
import { KnowledgeTemplateService } from "../init/ospec-lite-knowledge-template-service";
import { ScanService } from "../init/ospec-lite-scan-service";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";
import { StatusService } from "../status/ospec-lite-status-service";

export interface UpdateOptions {
  dryRun?: boolean;
}

export class UpdateService {
  constructor(
    private readonly repo: FileRepo,
    private readonly scanner: ScanService,
    private readonly agentEntries: AgentEntryService,
    private readonly indexService: IndexService,
    private readonly profiles: ProfileLoader,
    private readonly statusService: StatusService,
    private readonly knowledge: KnowledgeTemplateService,
    private readonly bugService: BugService
  ) {}

  async update(rootDir: string, options: UpdateOptions = {}): Promise<UpdateResult> {
    const dryRun = options.dryRun === true;
    const before = await this.statusService.getStatus(rootDir);
    const actions: UpdateAction[] = [];
    const warnings: string[] = [];

    if (before.state === "uninitialized") {
      warnings.push("Repository is not initialized for OSpec Lite. Run `oslite init` first.");
      return {
        rootDir,
        dryRun,
        stateBefore: before.state,
        stateAfter: before.state,
        actions,
        warnings,
        reviewNeededDocs: [],
        baselineInitializedDocs: []
      };
    }

    if (!before.config) {
      warnings.push("Cannot update because .oslite/config.json is missing or invalid.");
      return {
        rootDir,
        dryRun,
        stateBefore: before.state,
        stateAfter: before.state,
        actions,
        warnings,
        reviewNeededDocs: [],
        baselineInitializedDocs: []
      };
    }

    const config = before.config;
    const profile = config.profileId ? await this.profiles.loadProfile(config.profileId) : null;
    const scan = await this.scanner.scan(rootDir);
    const artifacts = this.knowledge.buildArtifacts(scan, config, profile);
    const nextHashes = this.hashSuggestions(artifacts.humanDocSuggestions);
    const templateHashes = this.knowledge.collectTemplateHashes(profile);
    const indexPath = path.join(rootDir, OSPEC_LITE_DIR, "index.json");
    const previousIndex = await this.readIndex(indexPath);
    const comparison = this.compareSuggestionHashes(previousIndex?.docSuggestionHashes, nextHashes);

    for (const dirPath of this.requiredDirectories(config.authoringPackRoot)) {
      await this.ensureDir(rootDir, dirPath, dryRun, actions);
    }

    const nextIndex = this.indexService.buildIndex(scan, config, nextHashes, templateHashes);
    await this.writeJsonIfChanged(
      path.join(rootDir, OSPEC_LITE_DIR, "index.json"),
      nextIndex,
      ".oslite/index.json",
      "refresh-index",
      "Refresh repository scan index and doc suggestion baselines.",
      dryRun,
      actions
    );

    await this.ensureManagedSection(
      rootDir,
      new CodexAdapter().fileName,
      artifacts.codexSection.content,
      AGENTS_MANAGED_START,
      AGENTS_MANAGED_END,
      dryRun,
      actions
    );
    await this.ensureManagedSection(
      rootDir,
      new ClaudeCodeAdapter().fileName,
      artifacts.claudeSection.content,
      CLAUDE_MANAGED_START,
      CLAUDE_MANAGED_END,
      dryRun,
      actions
    );
    await this.writeMissingLocalOverrides(rootDir, dryRun, actions);

    await this.writeMissingSuggestions(rootDir, artifacts.humanDocSuggestions, dryRun, actions);
    if (profile && artifacts.profileTemplateValues) {
      await this.writeMissingProfileSupportAssets(
        rootDir,
        profile,
        artifacts.profileTemplateValues,
        new Set(Object.keys(artifacts.humanDocSuggestions)),
        dryRun,
        actions
      );
    }

    if (await this.needsBugRepair(rootDir)) {
      this.pushAction(actions, {
        kind: "repair-bugs",
        path: ".oslite/bugs",
        status: dryRun ? "planned" : "applied",
        reason: "Repair bug queue, bug memory, and bug index support files."
      });
      if (!dryRun) {
        await this.bugService.ensureSupportArtifacts(rootDir);
      }
    }

    const after = dryRun ? before : await this.statusService.getStatus(rootDir);
    return {
      rootDir,
      dryRun,
      stateBefore: before.state,
      stateAfter: after.state,
      actions,
      warnings,
      reviewNeededDocs: comparison.reviewNeededDocs,
      baselineInitializedDocs: comparison.baselineInitializedDocs
    };
  }

  private requiredDirectories(authoringPackRoot: string | undefined): string[] {
    const dirs = [
      OSPEC_LITE_DIR,
      `${OSPEC_LITE_DIR}/bugs`,
      `${OSPEC_LITE_DIR}/docs/project`,
      `${OSPEC_LITE_DIR}/docs/agents`,
      BUG_MEMORY_DIR,
      `${OSPEC_LITE_DIR}/changes/active`,
      `${OSPEC_LITE_DIR}/changes/archived`
    ];
    if (authoringPackRoot) {
      dirs.push(authoringPackRoot);
    }
    return dirs;
  }

  private async ensureDir(
    rootDir: string,
    relativePath: string,
    dryRun: boolean,
    actions: UpdateAction[]
  ): Promise<void> {
    const absolutePath = path.join(rootDir, relativePath);
    if (await this.repo.exists(absolutePath)) {
      return;
    }

    this.pushAction(actions, {
      kind: "ensure-dir",
      path: relativePath,
      status: dryRun ? "planned" : "applied",
      reason: "Create missing protocol directory."
    });
    if (!dryRun) {
      await this.repo.ensureDir(absolutePath);
    }
  }

  private async writeMissingSuggestions(
    rootDir: string,
    suggestions: Record<string, string>,
    dryRun: boolean,
    actions: UpdateAction[]
  ): Promise<void> {
    for (const [relativePath, content] of Object.entries(suggestions)) {
      const targetPath = path.join(rootDir, relativePath);
      if (await this.repo.exists(targetPath)) {
        continue;
      }

      this.pushAction(actions, {
        kind: "write-missing",
        path: relativePath,
        status: dryRun ? "planned" : "applied",
        reason: "Write missing human-owned guidance from the current suggestion."
      });
      if (!dryRun) {
        await this.repo.writeText(targetPath, content);
      }
    }
  }

  private async writeMissingLocalOverrides(
    rootDir: string,
    dryRun: boolean,
    actions: UpdateAction[]
  ): Promise<void> {
    const skeleton =
      "<!-- Add your local overrides below this line. This file is not managed by ospec-lite. -->\n";
    for (const relativePath of ["AGENTS.local.md", "CLAUDE.local.md"]) {
      const targetPath = path.join(rootDir, relativePath);
      if (await this.repo.exists(targetPath)) {
        continue;
      }

      this.pushAction(actions, {
        kind: "write-missing",
        path: relativePath,
        status: dryRun ? "planned" : "applied",
        reason: "Write missing local agent override skeleton."
      });
      if (!dryRun) {
        await this.repo.writeText(targetPath, skeleton);
      }
    }
  }

  private async writeMissingProfileSupportAssets(
    rootDir: string,
    profile: LoadedOSpecLiteProfile,
    values: NonNullable<ReturnType<KnowledgeTemplateService["buildArtifacts"]>["profileTemplateValues"]>,
    humanDocTargets: Set<string>,
    dryRun: boolean,
    actions: UpdateAction[]
  ): Promise<void> {
    for (const asset of profile.assets) {
      if (asset.mode || humanDocTargets.has(asset.target)) {
        continue;
      }

      const targetPath = path.join(rootDir, asset.target);
      if (await this.repo.exists(targetPath)) {
        continue;
      }

      this.pushAction(actions, {
        kind: "write-missing",
        path: asset.target,
        status: dryRun ? "planned" : "applied",
        reason: "Write missing profile support asset."
      });
      if (!dryRun) {
        await this.repo.writeText(targetPath, this.profiles.renderAsset(profile, asset, values));
      }
    }
  }

  private async ensureManagedSection(
    rootDir: string,
    fileName: string,
    sectionContent: string,
    managedStart: string,
    managedEnd: string,
    dryRun: boolean,
    actions: UpdateAction[]
  ): Promise<void> {
    const targetPath = path.join(rootDir, fileName);
    const existing = (await this.repo.exists(targetPath))
      ? await this.repo.readText(targetPath)
      : null;
    const nextContent = existing
      ? this.upsertManagedSection(existing, sectionContent, managedStart, managedEnd)
      : sectionContent;

    if (existing === nextContent) {
      return;
    }

    this.pushAction(actions, {
      kind: "refresh-managed",
      path: fileName,
      status: dryRun ? "planned" : "applied",
      reason: "Refresh managed agent instruction section."
    });
    if (!dryRun) {
      if (fileName === new CodexAdapter().fileName) {
        await this.agentEntries.ensureManagedSection(
          rootDir,
          new CodexAdapter(),
          sectionContent,
          managedStart,
          managedEnd
        );
      } else {
        await this.agentEntries.ensureManagedSection(
          rootDir,
          new ClaudeCodeAdapter(),
          sectionContent,
          managedStart,
          managedEnd
        );
      }
    }
  }

  private upsertManagedSection(
    existing: string,
    nextSection: string,
    managedStart: string,
    managedEnd: string
  ): string {
    const startIndex = existing.indexOf(managedStart);
    const endIndex = existing.indexOf(managedEnd);
    const managedBody = this.extractManagedBody(nextSection, managedStart, managedEnd);

    if (startIndex >= 0 && endIndex >= 0 && endIndex > startIndex) {
      const before = existing.slice(0, startIndex);
      const after = existing.slice(endIndex + managedEnd.length);
      return `${before}${managedBody}${after}`.replace(/\n{3,}/g, "\n\n");
    }

    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    return `${existing}${separator}${managedBody}`;
  }

  private extractManagedBody(
    content: string,
    managedStart: string,
    managedEnd: string
  ): string {
    const startIndex = content.indexOf(managedStart);
    const endIndex = content.indexOf(managedEnd);
    if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
      return content;
    }
    return content.slice(startIndex, endIndex + managedEnd.length);
  }

  private async writeJsonIfChanged(
    targetPath: string,
    value: unknown,
    relativePath: string,
    kind: UpdateAction["kind"],
    reason: string,
    dryRun: boolean,
    actions: UpdateAction[]
  ): Promise<void> {
    const nextContent = `${JSON.stringify(value, null, 2)}\n`;
    const existing = (await this.repo.exists(targetPath))
      ? await this.repo.readText(targetPath)
      : null;
    if (existing === nextContent) {
      return;
    }

    this.pushAction(actions, {
      kind,
      path: relativePath,
      status: dryRun ? "planned" : "applied",
      reason
    });
    if (!dryRun) {
      await this.repo.writeText(targetPath, nextContent);
    }
  }

  private async needsBugRepair(rootDir: string): Promise<boolean> {
    const expected = [
      BUG_PLAYBOOK_PATH,
      BUG_ACTIVE_BUGS_PATH,
      BUG_MEMORY_PATH,
      BUG_INDEX_PATH,
      BUG_MEMORY_DIR
    ];
    for (const relativePath of expected) {
      if (!(await this.repo.exists(path.join(rootDir, relativePath)))) {
        return true;
      }
    }
    return false;
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

  private pushAction(actions: UpdateAction[], action: UpdateAction): void {
    actions.push({
      ...action,
      path: action.path.replace(/\\/g, "/")
    });
  }
}
