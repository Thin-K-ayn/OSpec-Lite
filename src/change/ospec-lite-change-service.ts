import * as path from "node:path";
import { CHANGE_SLUG_PATTERN } from "../core/ospec-lite-schema";
import { ChangeRecord, ChangeStatus } from "../core/ospec-lite-types";
import {
  InvalidChangeSlugError,
  NotInitializedError,
  OSpecLiteError
} from "../core/ospec-lite-errors";
import { FileRepo } from "../fs/file-repo";
import { StatusService } from "../status/ospec-lite-status-service";

export class ChangeService {
  constructor(
    private readonly repo: FileRepo,
    private readonly statusService: StatusService
  ) {}

  async newChange(rootDir: string, slug: string): Promise<string> {
    this.ensureSlug(slug);
    await this.ensureInitialized(rootDir);

    const changeDir = path.join(rootDir, "changes", "active", slug);
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
    await this.repo.writeText(path.join(changeDir, "request.md"), this.renderRequest(slug));
    await this.repo.writeText(path.join(changeDir, "plan.md"), this.renderPlan(slug));
    await this.repo.writeText(path.join(changeDir, "apply.md"), this.renderApply(slug));
    await this.repo.writeText(path.join(changeDir, "verify.md"), this.renderVerify(slug));

    return changeDir;
  }

  async markApplied(changePath: string): Promise<void> {
    await this.transition(changePath, "applied", ["draft", "active"]);
  }

  async markVerified(changePath: string): Promise<void> {
    await this.transition(changePath, "verified", ["applied", "active"]);
  }

  async archive(changePath: string): Promise<string> {
    const record = await this.readChangeRecord(changePath);
    if (record.status !== "verified") {
      throw new OSpecLiteError("Only verified changes can be archived.");
    }

    const rootDir = path.resolve(changePath, "..", "..", "..");
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const day = now.toISOString().slice(0, 10);
    const archiveDir = path.join(rootDir, "changes", "archived", month, day, record.slug);

    record.status = "archived";
    record.updatedAt = now.toISOString();
    await this.repo.writeJson(path.join(changePath, "change.json"), record);
    await this.repo.move(changePath, archiveDir);
    return archiveDir;
  }

  private async transition(
    changePath: string,
    nextStatus: ChangeStatus,
    allowedCurrent: ChangeStatus[]
  ): Promise<void> {
    const record = await this.readChangeRecord(changePath);
    if (!allowedCurrent.includes(record.status)) {
      throw new OSpecLiteError(
        `Cannot move change from ${record.status} to ${nextStatus}.`
      );
    }

    record.status = nextStatus;
    record.updatedAt = new Date().toISOString();
    await this.repo.writeJson(path.join(changePath, "change.json"), record);
  }

  private async readChangeRecord(changePath: string): Promise<ChangeRecord> {
    const changeJsonPath = path.join(changePath, "change.json");
    if (!(await this.repo.exists(changeJsonPath))) {
      throw new OSpecLiteError(`Missing change.json: ${changePath}`);
    }
    return this.repo.readJson<ChangeRecord>(changeJsonPath);
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

  private renderRequest(slug: string): string {
    return `# Request

## Request

- Change: \`${slug}\`
- Describe the request here.

## Scope

- Add the intended scope here.

## Acceptance Notes

- Add acceptance notes here.
`;
  }

  private renderPlan(slug: string): string {
    return `# Plan

## Implementation Plan

- Change: \`${slug}\`
- Describe the intended implementation path.

## Files Or Modules Expected To Change

- Add expected files or modules here.

## Risks

- Add implementation risks here.
`;
  }

  private renderApply(slug: string): string {
    return `# Apply

## Applied Changes

- Change: \`${slug}\`
- Record what was actually changed.

## Files Touched

- Add touched files here.

## Deviations From Plan

- Add deviations here if any.
`;
  }

  private renderVerify(slug: string): string {
    return `# Verify

## Checks Performed

- Change: \`${slug}\`
- Record automated or manual checks here.

## Manual Validation

- Add manual validation notes here.

## Remaining Risks

- Add any unresolved risks here.
`;
  }
}
