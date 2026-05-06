import { createHash } from "node:crypto";
import * as path from "node:path";
import {
  BUG_INDEX_PATH,
  OSPEC_LITE_DIR,
  REPORTS_ROOT,
  REPORT_SCHEDULE_PATH
} from "../core/ospec-lite-schema";
import { OSpecLiteError, ReportStateError } from "../core/ospec-lite-errors";
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
  ReportArtifact,
  ReportAutomationRunResult,
  ReportAutomationSchedule,
  ReportAutomationScheduleResult,
  ReportCadence,
  StatusReport
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
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class ReportService {
  constructor(
    private readonly repo: FileRepo,
    private readonly scanner: ScanService,
    private readonly profiles: ProfileLoader,
    private readonly statusService: StatusService,
    private readonly knowledge: KnowledgeTemplateService
  ) {}

  async report(rootDir: string, cadence: ReportCadence = "weekly"): Promise<OSpecLiteWorkReport> {
    const status = await this.getReportableStatus(rootDir);

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

  async emitReportArtifact(
    rootDir: string,
    cadence: ReportCadence = "weekly"
  ): Promise<ReportArtifact> {
    const report = await this.report(rootDir, cadence);
    return this.writeReportArtifact(rootDir, report);
  }

  async scheduleAutomation(
    rootDir: string,
    cadence: ReportCadence = "weekly"
  ): Promise<ReportAutomationScheduleResult> {
    await this.getReportableStatus(rootDir);

    const now = new Date().toISOString();
    const previous = await this.readSchedule(rootDir);
    const isSameCadence = previous?.cadence === cadence;
    const schedule: ReportAutomationSchedule = {
      version: 1,
      cadence,
      artifactRoot: REPORTS_ROOT,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      nextRunAt: isSameCadence ? previous.nextRunAt : now,
      lastGeneratedAt: isSameCadence ? previous.lastGeneratedAt : undefined,
      lastGeneratedPeriod: isSameCadence ? previous.lastGeneratedPeriod : undefined,
      lastArtifactPath: isSameCadence ? previous.lastArtifactPath : undefined,
      lastDataPath: isSameCadence ? previous.lastDataPath : undefined
    };

    await this.writeSchedule(rootDir, schedule);

    return {
      rootDir,
      schedulePath: REPORT_SCHEDULE_PATH,
      schedule
    };
  }

  async runAutomation(
    rootDir: string,
    options: { force?: boolean } = {}
  ): Promise<ReportAutomationRunResult> {
    await this.getReportableStatus(rootDir);

    const schedule = await this.readSchedule(rootDir);
    if (!schedule) {
      throw new OSpecLiteError(
        "No report automation schedule found. Run oslite report schedule [path] first."
      );
    }

    const now = new Date();
    const currentPeriod = this.toPeriodKey(schedule.cadence, now);
    if (!options.force && schedule.lastGeneratedPeriod === currentPeriod) {
      const nextSchedule = this.withNextRunAt(schedule, now);
      if (nextSchedule.nextRunAt !== schedule.nextRunAt) {
        await this.writeSchedule(rootDir, nextSchedule);
      }

      return {
        rootDir,
        schedulePath: REPORT_SCHEDULE_PATH,
        schedule: nextSchedule,
        generated: false,
        due: false,
        reason: `Report already emitted for ${currentPeriod}.`
      };
    }

    if (!options.force && Date.parse(schedule.nextRunAt) > now.getTime()) {
      return {
        rootDir,
        schedulePath: REPORT_SCHEDULE_PATH,
        schedule,
        generated: false,
        due: false,
        reason: `Next report is due at ${schedule.nextRunAt}.`
      };
    }

    const artifact = await this.emitReportArtifact(rootDir, schedule.cadence);
    const nextSchedule: ReportAutomationSchedule = {
      ...schedule,
      updatedAt: artifact.generatedAt,
      nextRunAt: this.nextPeriodStartsAt(
        schedule.cadence,
        new Date(artifact.generatedAt)
      ).toISOString(),
      lastGeneratedAt: artifact.generatedAt,
      lastGeneratedPeriod: artifact.period,
      lastArtifactPath: artifact.artifactPath,
      lastDataPath: artifact.dataPath
    };
    await this.writeSchedule(rootDir, nextSchedule);

    return {
      rootDir,
      schedulePath: REPORT_SCHEDULE_PATH,
      schedule: nextSchedule,
      generated: true,
      due: true,
      artifact
    };
  }

  private async getReportableStatus(
    rootDir: string
  ): Promise<StatusReport & { config: OSpecLiteConfig; state: "initialized" }> {
    const status = await this.statusService.getStatus(rootDir);
    if (status.state === "uninitialized" || status.state === "incomplete") {
      throw new ReportStateError(rootDir, status.state, status.missingMarkers);
    }
    if (!status.config) {
      throw new ReportStateError(rootDir, "incomplete", status.missingMarkers);
    }

    return {
      ...status,
      state: status.state,
      config: status.config
    };
  }

  private async writeReportArtifact(
    rootDir: string,
    report: OSpecLiteWorkReport
  ): Promise<ReportArtifact> {
    const period = this.toPeriodKey(report.reportWindow.cadence, new Date(report.generatedAt));
    const artifactPath = this.normalizePath(
      path.join(REPORTS_ROOT, report.reportWindow.cadence, `${period}.md`)
    );
    const dataPath = this.normalizePath(
      path.join(REPORTS_ROOT, report.reportWindow.cadence, `${period}.json`)
    );

    await this.repo.writeText(
      path.join(rootDir, artifactPath),
      this.renderReportMarkdown(report, period, dataPath)
    );
    await this.repo.writeJson(path.join(rootDir, dataPath), report);

    return {
      rootDir,
      cadence: report.reportWindow.cadence,
      period,
      generatedAt: report.generatedAt,
      artifactPath,
      dataPath
    };
  }

  private async readSchedule(rootDir: string): Promise<ReportAutomationSchedule | null> {
    const schedulePath = path.join(rootDir, REPORT_SCHEDULE_PATH);
    if (!(await this.repo.exists(schedulePath))) {
      return null;
    }

    const schedule = await this.repo.readJson<unknown>(schedulePath);
    if (!this.isReportAutomationSchedule(schedule)) {
      throw new OSpecLiteError(`Invalid report automation schedule: ${REPORT_SCHEDULE_PATH}`);
    }

    return schedule;
  }

  private async writeSchedule(
    rootDir: string,
    schedule: ReportAutomationSchedule
  ): Promise<void> {
    await this.repo.writeJson(path.join(rootDir, REPORT_SCHEDULE_PATH), schedule);
  }

  private isReportAutomationSchedule(value: unknown): value is ReportAutomationSchedule {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<ReportAutomationSchedule>;
    return (
      candidate.version === 1 &&
      (candidate.cadence === "daily" || candidate.cadence === "weekly") &&
      candidate.artifactRoot === REPORTS_ROOT &&
      typeof candidate.createdAt === "string" &&
      !Number.isNaN(Date.parse(candidate.createdAt)) &&
      typeof candidate.updatedAt === "string" &&
      !Number.isNaN(Date.parse(candidate.updatedAt)) &&
      typeof candidate.nextRunAt === "string" &&
      !Number.isNaN(Date.parse(candidate.nextRunAt)) &&
      (candidate.lastGeneratedAt === undefined ||
        (typeof candidate.lastGeneratedAt === "string" &&
          !Number.isNaN(Date.parse(candidate.lastGeneratedAt)))) &&
      (candidate.lastGeneratedPeriod === undefined ||
        typeof candidate.lastGeneratedPeriod === "string") &&
      (candidate.lastArtifactPath === undefined ||
        typeof candidate.lastArtifactPath === "string") &&
      (candidate.lastDataPath === undefined || typeof candidate.lastDataPath === "string")
    );
  }

  private withNextRunAt(
    schedule: ReportAutomationSchedule,
    now: Date
  ): ReportAutomationSchedule {
    const nextRunAt = this.nextPeriodStartsAt(schedule.cadence, now).toISOString();
    if (Date.parse(schedule.nextRunAt) > now.getTime() || schedule.nextRunAt === nextRunAt) {
      return schedule;
    }

    return {
      ...schedule,
      updatedAt: now.toISOString(),
      nextRunAt
    };
  }

  private renderReportMarkdown(
    report: OSpecLiteWorkReport,
    period: string,
    dataPath: string
  ): string {
    const lines: string[] = [
      "# OSpec Lite Work Report",
      "",
      `- Path: ${report.rootDir}`
    ];

    if (report.projectName) {
      lines.push(`- Project: ${report.projectName}`);
    }
    if (report.profileId) {
      lines.push(`- Profile: ${report.profileId}`);
    }
    if (report.bootstrapAgent) {
      lines.push(`- Bootstrap agent: ${report.bootstrapAgent}`);
    }
    lines.push(
      `- State: ${report.state}`,
      `- Cadence: ${report.reportWindow.cadence}`,
      `- Period: ${period}`,
      `- Window: last ${report.reportWindow.lookbackDays} day(s)`,
      `- Generated at: ${report.generatedAt}`,
      `- Structured data: ${dataPath}`
    );

    this.appendChangeSection(lines, "Completed changes this period", report.recentArchivedChanges);
    this.appendChangeSection(lines, "Open changes now", report.activeChanges);
    this.appendBugSection(lines, "Resolved bugs this period", report.recentAppliedBugs);
    this.appendBugSection(lines, "Open bugs now", report.activeBugs);
    this.appendPathSection(lines, "Docs needing review now", report.reviewNeededDocs);
    this.appendPathSection(
      lines,
      "Initialized doc suggestion baselines",
      report.baselineInitializedDocs
    );

    return `${lines.join("\n")}\n`;
  }

  private appendChangeSection(
    lines: string[],
    label: string,
    items: ChangeReportItem[]
  ): void {
    lines.push("", `## ${label} (${items.length})`);
    if (items.length === 0) {
      lines.push("- (none)");
      return;
    }

    for (const item of items) {
      const affects = item.affects.length > 0 ? item.affects.join(", ") : "(not recorded)";
      lines.push(`- ${item.slug} [${item.status}; ${item.updatedAt}; ${item.path}]`);
      lines.push(`  - affects: ${affects}`);
      lines.push(`  - owner: ${item.owner}`);
    }
  }

  private appendBugSection(
    lines: string[],
    label: string,
    items: BugReportItem[]
  ): void {
    lines.push("", `## ${label} (${items.length})`);
    if (items.length === 0) {
      lines.push("- (none)");
      return;
    }

    for (const item of items) {
      const affects = item.affects.length > 0 ? item.affects.join(", ") : "(not recorded)";
      lines.push(`- ${item.id}: ${item.title} [${item.status}; ${item.updatedAt}]`);
      lines.push(`  - affects: ${affects}`);
      lines.push(`  - owner: ${item.owner}`);
    }
  }

  private appendPathSection(lines: string[], label: string, items: string[]): void {
    lines.push("", `## ${label} (${items.length})`);
    if (items.length === 0) {
      lines.push("- (none)");
      return;
    }

    for (const item of items) {
      lines.push(`- ${item}`);
    }
  }

  private nextPeriodStartsAt(cadence: ReportCadence, date: Date): Date {
    if (cadence === "daily") {
      return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
      );
    }

    const day = date.getUTCDay() || 7;
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + (8 - day))
    );
  }

  private toPeriodKey(cadence: ReportCadence, date: Date): string {
    if (cadence === "daily") {
      return [
        date.getUTCFullYear(),
        this.pad(date.getUTCMonth() + 1),
        this.pad(date.getUTCDate())
      ].join("-");
    }

    return this.toIsoWeekKey(date);
  }

  private toIsoWeekKey(date: Date): string {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);

    const weekYear = target.getUTCFullYear();
    const yearStart = new Date(Date.UTC(weekYear, 0, 1));
    const weekNumber = Math.ceil(((target.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
    return `${weekYear}-W${this.pad(weekNumber)}`;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, "0");
  }

  private normalizePath(value: string): string {
    return value.replace(/\\/g, "/");
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
