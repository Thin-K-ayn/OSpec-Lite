import * as path from "node:path";
import { CHANGE_SLUG_PATTERN, OSPEC_LITE_DIR } from "../core/ospec-lite-schema";
import {
  ChangeRecord,
  ChangeStatus,
  ChangeValidationPhase
} from "../core/ospec-lite-types";
import {
  ChangeValidationError,
  InvalidChangeSlugError,
  NotInitializedError,
  OSpecLiteError
} from "../core/ospec-lite-errors";
import { FileRepo } from "../fs/file-repo";
import { StatusService } from "../status/ospec-lite-status-service";
import { ChangeTemplateService } from "./ospec-lite-change-template-service";

const TEMPLATE_PLACEHOLDER_PATTERNS = [
  /\[TODO:[^\]]+\]/,
  /\bDescribe the request here\./,
  /\bAdd the intended scope here\./,
  /\bAdd acceptance notes here\./,
  /\bDescribe the intended implementation path\./,
  /\bAdd expected files or modules here\./,
  /\bAdd implementation risks here\./,
  /\bRecord what was actually changed\./,
  /\bAdd touched files here\./,
  /\bAdd deviations here if any\./,
  /\bRecord automated or manual checks here\./,
  /\bAdd manual validation notes here\./,
  /\bAdd any unresolved risks here\./
];

export class ChangeService {
  constructor(
    private readonly repo: FileRepo,
    private readonly statusService: StatusService,
    private readonly templates = new ChangeTemplateService()
  ) {}

  async newChange(rootDir: string, slug: string): Promise<string> {
    this.ensureSlug(slug);
    await this.ensureInitialized(rootDir);

    const changeDir = path.join(rootDir, OSPEC_LITE_DIR, "changes", "active", slug);
    if (await this.repo.exists(changeDir)) {
      throw new OSpecLiteError(`Change already exists: ${slug}`);
    }

    const now = new Date().toISOString();
    const record: ChangeRecord = {
      version: 1,
      slug,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      source: {
        type: "manual",
        id: ""
      },
      affects: [],
      owner: "",
      notes: ""
    };

    await this.repo.ensureDir(changeDir);
    await this.repo.writeJson(path.join(changeDir, "change.json"), record);
    await this.repo.writeText(path.join(changeDir, "request.md"), this.templates.renderRequest(slug));
    await this.repo.writeText(path.join(changeDir, "plan.md"), this.templates.renderPlan(slug));
    await this.repo.writeText(path.join(changeDir, "apply.md"), this.templates.renderApply(slug));
    await this.repo.writeText(path.join(changeDir, "verify.md"), this.templates.renderVerify(slug));

    return changeDir;
  }

  async markApplied(changePath: string): Promise<void> {
    this.ensureAllowedCurrentStatus(await this.readChangeRecord(changePath), ["draft", "active"], "applied");
    await this.validateTransitionRequirements(changePath, "apply");
    await this.transition(changePath, "applied");
  }

  async markVerified(changePath: string): Promise<void> {
    this.ensureAllowedCurrentStatus(await this.readChangeRecord(changePath), ["applied", "active"], "verified");
    await this.validateTransitionRequirements(changePath, "verify");
    await this.transition(changePath, "verified");
  }

  async archive(changePath: string): Promise<string> {
    const record = await this.readChangeRecord(changePath);
    if (record.status !== "verified") {
      throw new OSpecLiteError("Only verified changes can be archived.");
    }

    const rootDir = await this.findRootDir(changePath);
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const day = now.toISOString().slice(0, 10);
    const archiveDir = path.join(rootDir, OSPEC_LITE_DIR, "changes", "archived", month, day, record.slug);
    const archivedRecord: ChangeRecord = {
      ...record,
      status: "archived",
      updatedAt: now.toISOString()
    };

    await this.repo.writeJson(path.join(changePath, "change.json"), archivedRecord);
    try {
      await this.repo.move(changePath, archiveDir);
    } catch (error) {
      await this.repo.writeJson(path.join(changePath, "change.json"), record);
      throw error;
    }
    return archiveDir;
  }

  private async transition(changePath: string, nextStatus: ChangeStatus): Promise<void> {
    const record = await this.readChangeRecord(changePath);
    record.status = nextStatus;
    record.updatedAt = new Date().toISOString();
    await this.repo.writeJson(path.join(changePath, "change.json"), record);
  }

  private async validateTransitionRequirements(
    changePath: string,
    phase: ChangeValidationPhase
  ): Promise<void> {
    const record = await this.readChangeRecord(changePath);
    const request = await this.readRequiredText(changePath, "request.md");
    const plan = await this.readRequiredText(changePath, "plan.md");
    const apply = await this.readRequiredText(changePath, "apply.md");
    const issues: string[] = [];

    if (!this.hasFilledAffects(record.affects)) {
      issues.push("change.json must list at least one affected area in `affects`.");
    }

    for (const [fileName, content] of [
      ["request.md", request],
      ["plan.md", plan],
      ["apply.md", apply]
    ] as const) {
      if (this.containsTemplatePlaceholders(content)) {
        issues.push(`${fileName} still contains template placeholders.`);
      }
    }

    if (!this.hasMeaningfulEntries(this.extractLabeledValues(apply, "Summary"), true)) {
      issues.push("apply.md must include a real `Summary` entry.");
    }

    if (!this.hasMeaningfulEntries(this.extractLabeledValues(apply, "File"), true)) {
      issues.push("apply.md must include at least one real `File` entry.");
    }

    if (phase === "verify") {
      const verify = await this.readRequiredText(changePath, "verify.md");
      if (this.containsTemplatePlaceholders(verify)) {
        issues.push("verify.md still contains template placeholders.");
      }

      if (!this.hasMeaningfulEntries(this.extractLabeledValues(verify, "Command"), true)) {
        issues.push("verify.md must include at least one real `Command` entry.");
      }

      if (!this.hasMeaningfulEntries(this.extractLabeledValues(verify, "Result"), true)) {
        issues.push("verify.md must include at least one real `Result` entry.");
      }
    }

    if (issues.length > 0) {
      throw new ChangeValidationError(changePath, phase, issues);
    }
  }

  private async readChangeRecord(changePath: string): Promise<ChangeRecord> {
    const changeJsonPath = path.join(changePath, "change.json");
    if (!(await this.repo.exists(changeJsonPath))) {
      throw new OSpecLiteError(`Missing change.json: ${changePath}`);
    }
    return this.repo.readJson<ChangeRecord>(changeJsonPath);
  }

  private async readRequiredText(changePath: string, fileName: string): Promise<string> {
    const filePath = path.join(changePath, fileName);
    if (!(await this.repo.exists(filePath))) {
      throw new OSpecLiteError(`Missing ${fileName}: ${changePath}`);
    }

    return this.repo.readText(filePath);
  }

  private hasFilledAffects(affects: string[]): boolean {
    return affects.some((item) => item.trim().length > 0);
  }

  private extractLabeledValues(content: string, label: string): string[] {
    const regex = new RegExp(`^- ${this.escapeRegex(label)}:\\s*(.+)$`, "gm");
    const values: string[] = [];
    let match: RegExpExecArray | null = regex.exec(content);

    while (match) {
      values.push(match[1].trim());
      match = regex.exec(content);
    }

    return values;
  }

  private hasMeaningfulEntries(values: string[], rejectBarePlaceholders = false): boolean {
    return values.some((value) => this.isMeaningfulValue(value, rejectBarePlaceholders));
  }

  private isMeaningfulValue(value: string, rejectBarePlaceholders: boolean): boolean {
    const trimmed = value.trim();
    if (trimmed.length === 0 || this.containsTemplatePlaceholders(trimmed)) {
      return false;
    }

    if (!rejectBarePlaceholders) {
      return true;
    }

    return !/^(?:none|n\/a|na)$/i.test(trimmed);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private containsTemplatePlaceholders(content: string): boolean {
    return TEMPLATE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content));
  }

  private ensureSlug(slug: string): void {
    if (!CHANGE_SLUG_PATTERN.test(slug)) {
      throw new InvalidChangeSlugError(slug);
    }
  }

  private async ensureInitialized(rootDir: string): Promise<void> {
    const status = await this.statusService.getStatus(rootDir);
    if (status.state !== "initialized") {
      throw new NotInitializedError(rootDir);
    }
  }

  private async findRootDir(changePath: string): Promise<string> {
    let candidate = path.resolve(changePath);
    const root = path.parse(candidate).root;
    while (candidate !== root) {
      candidate = path.dirname(candidate);
      if (await this.repo.exists(path.join(candidate, OSPEC_LITE_DIR, "config.json"))) {
        return candidate;
      }
    }
    throw new OSpecLiteError(`Cannot find project root from change path: ${changePath}`);
  }

  private ensureAllowedCurrentStatus(
    record: ChangeRecord,
    allowedCurrent: ChangeStatus[],
    nextStatus: ChangeStatus
  ): void {
    if (!allowedCurrent.includes(record.status)) {
      throw new OSpecLiteError(`Cannot move change from ${record.status} to ${nextStatus}.`);
    }
  }
}
