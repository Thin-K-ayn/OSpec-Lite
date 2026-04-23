import { createHash } from "node:crypto";
import * as path from "node:path";
import { BUG_INDEX_PATH, OSPEC_LITE_DIR } from "../core/ospec-lite-schema";
import { ReportStateError } from "../core/ospec-lite-errors";
import {
  BugIndex,
  BugRecord,
  BugReportItem,
  ChangeRecord,
  ChangeReportItem,
  LoadedOSpecLiteProfile,
  OSpecLiteConfig,
  OSpecLiteIndex,
  OSpecLiteWorkReport,
  ReportCadence
} from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";
import { ScanService } from "../init/ospec-lite-scan-service";
import { KnowledgeTemplateService } from "../init/ospec-lite-knowledge-template-service";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";
import { StatusService } from "../status/ospec-lite-status-service";

const REPORT_LOOKBACK_DAYS: Record<ReportCadence, number> = {
  daily: 1,
  weekly: 7
};

export class ReportService {
  constructor(
    private readonly repo: FileRepo,
    private readonly scanner: ScanService,
    private readonly profiles: ProfileLoader,
    private readonly statusService: StatusService,
    private readonly knowledge: KnowledgeTemplateService
  ) {}

  async report(rootDir: string, cadence: ReportCadence = "weekly"): Promise<OSpecLiteWorkReport> {
    const status = await this.statusService.getStatus(rootDir);
    if (status.state === "uninitialized" || status.state === "incomplete") {
      throw new ReportStateError(rootDir, status.state, status.missingMarkers);
    }
    if (!status.config) {
      throw new ReportStateError(rootDir, "incomplete", status.missingMarkers);
    }

    const generatedAt = new Date();
    const lookbackDays = REPORT_LOOKBACK_DAYS[cadence];
    const startsAt = new Date(generatedAt.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const profile = status.config.profileId
      ? await this.profiles.loadProfile(status.config.profileId)
      : null;
    const previousIndex = await this.readIndex(path.join(rootDir, OSPEC_LITE_DIR, "index.json"));
    const docComparison = await this.compareDocSuggestions(
      rootDir,
      status.config,
      profile,
      previousIndex
    );

    return {
      rootDir,
      generatedAt: generatedAt.toISOString(),
      state: status.state,
      projectName: status.config.projectName,
      profileId: status.config.profileId,
      bootstrapAgent: status.config.bootstrapAgent,
      reportWindow: {
        cadence,
        lookbackDays,
        startsAt: startsAt.toISOString(),
        endsAt: generatedAt.toISOString()
      },
      activeChanges: await this.readActiveChanges(rootDir),
      recentArchivedChanges: await this.readArchivedChanges(rootDir, startsAt),
      activeBugs: await this.readActiveBugs(rootDir),
      recentAppliedBugs: await this.readRecentAppliedBugs(rootDir, startsAt),
      reviewNeededDocs: docComparison.reviewNeededDocs,
      baselineInitializedDocs: docComparison.baselineInitializedDocs
    };
  }

  private async compareDocSuggestions(
    rootDir: string,
    config: OSpecLiteConfig,
    profile: LoadedOSpecLiteProfile | null,
    previousIndex: OSpecLiteIndex | null
  ): Promise<{
    reviewNeededDocs: string[];
    baselineInitializedDocs: string[];
  }> {
    const scan = await this.scanner.scan(rootDir);
    const artifacts = this.knowledge.buildArtifacts(scan, config, profile);
    const nextHashes = this.hashSuggestions(artifacts.humanDocSuggestions);
    const reviewNeededDocs: string[] = [];
    const baselineInitializedDocs: string[] = [];

    for (const filePath of Object.keys(nextHashes).sort((left, right) => left.localeCompare(right))) {
      const previousHash = previousIndex?.docSuggestionHashes?.[filePath];
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

  private hashSuggestions(suggestions: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(suggestions).map(([filePath, content]) => [
        filePath,
        createHash("sha256").update(content).digest("hex")
      ])
    );
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

  private async readActiveChanges(rootDir: string): Promise<ChangeReportItem[]> {
    const activeRoot = path.join(rootDir, OSPEC_LITE_DIR, "changes", "active");
    if (!(await this.repo.exists(activeRoot))) {
      return [];
    }

    const entries = await this.repo.listDirents(activeRoot);
    const changes = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const relativePath = path.join(OSPEC_LITE_DIR, "changes", "active", entry.name);
          const record = await this.repo.readJson<ChangeRecord>(
            path.join(activeRoot, entry.name, "change.json")
          );
          return this.toChangeReportItem(relativePath, record);
        })
    );

    return this.sortByMostRecent(changes);
  }

  private async readArchivedChanges(
    rootDir: string,
    startsAt: Date
  ): Promise<ChangeReportItem[]> {
    const archivedRoot = path.join(rootDir, OSPEC_LITE_DIR, "changes", "archived");
    if (!(await this.repo.exists(archivedRoot))) {
      return [];
    }

    const changes: ChangeReportItem[] = [];
    const monthDirs = await this.repo.listDirents(archivedRoot);
    for (const monthDir of monthDirs) {
      if (!monthDir.isDirectory()) {
        continue;
      }

      const monthPath = path.join(archivedRoot, monthDir.name);
      const dayDirs = await this.repo.listDirents(monthPath);
      for (const dayDir of dayDirs) {
        if (!dayDir.isDirectory()) {
          continue;
        }

        const dayPath = path.join(monthPath, dayDir.name);
        const changeDirs = await this.repo.listDirents(dayPath);
        for (const changeDir of changeDirs) {
          if (!changeDir.isDirectory()) {
            continue;
          }

          const relativePath = path
            .join(OSPEC_LITE_DIR, "changes", "archived", monthDir.name, dayDir.name, changeDir.name)
            .replace(/\\/g, "/");
          const record = await this.repo.readJson<ChangeRecord>(
            path.join(dayPath, changeDir.name, "change.json")
          );

          if (!this.isOnOrAfter(record.updatedAt, startsAt)) {
            continue;
          }

          changes.push(this.toChangeReportItem(relativePath, record));
        }
      }
    }

    return this.sortByMostRecent(changes);
  }

  private async readActiveBugs(rootDir: string): Promise<BugReportItem[]> {
    const bugIndex = await this.readBugIndex(rootDir);
    return this.sortByMostRecent(
      bugIndex.items
        .filter((item) => item.status !== "applied")
        .map((item) => this.toBugReportItem(item))
    );
  }

  private async readRecentAppliedBugs(
    rootDir: string,
    startsAt: Date
  ): Promise<BugReportItem[]> {
    const bugIndex = await this.readBugIndex(rootDir);
    return this.sortByMostRecent(
      bugIndex.items
        .filter((item) => item.status === "applied" && this.isOnOrAfter(item.appliedAt, startsAt))
        .map((item) => this.toBugReportItem(item))
    );
  }

  private async readBugIndex(rootDir: string): Promise<BugIndex> {
    const indexPath = path.join(rootDir, BUG_INDEX_PATH);
    if (!(await this.repo.exists(indexPath))) {
      return {
        version: 1,
        nextBugNumber: 1,
        nextKnowledgeFileNumber: 1,
        currentKnowledgeFile: "",
        knowledgeFileMaxBytes: 0,
        knowledgeFileMinBytes: 0,
        items: [],
        knowledgeFiles: []
      };
    }

    return this.repo.readJson<BugIndex>(indexPath);
  }

  private toChangeReportItem(relativePath: string, record: ChangeRecord): ChangeReportItem {
    return {
      slug: record.slug,
      status: record.status,
      path: relativePath.replace(/\\/g, "/"),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      affects: [...record.affects],
      owner: record.owner
    };
  }

  private toBugReportItem(record: BugRecord): BugReportItem {
    return {
      id: record.id,
      title: record.title,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      appliedAt: record.appliedAt,
      affects: [...record.affects],
      owner: record.owner
    };
  }

  private isOnOrAfter(value: string | undefined, startsAt: Date): boolean {
    if (!value) {
      return false;
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return false;
    }

    return parsed >= startsAt.getTime();
  }

  private sortByMostRecent<T extends { updatedAt: string }>(items: T[]): T[] {
    return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}
