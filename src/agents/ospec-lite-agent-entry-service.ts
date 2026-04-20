import * as path from "node:path";
import { FileRepo } from "../fs/file-repo";
import { AgentAdapter } from "./ospec-lite-agent-target-types";

export class AgentEntryService {
  constructor(private readonly repo: FileRepo) {}

  async ensureManagedSection(
    rootDir: string,
    adapter: AgentAdapter,
    sectionContent: string,
    managedStart: string,
    managedEnd: string
  ): Promise<boolean> {
    const targetPath = path.join(rootDir, adapter.fileName);
    if (!(await this.repo.exists(targetPath))) {
      await this.repo.writeText(targetPath, sectionContent);
      return true;
    }

    const existing = await this.repo.readText(targetPath);
    const updated = this.upsertManagedSection(
      existing,
      sectionContent,
      managedStart,
      managedEnd
    );
    if (updated === existing) {
      return false;
    }
    await this.repo.writeText(targetPath, updated);
    return true;
  }

  private upsertManagedSection(
    existing: string,
    nextSection: string,
    managedStart: string,
    managedEnd: string
  ): string {
    const startIndex = existing.indexOf(managedStart);
    const endIndex = existing.indexOf(managedEnd);

    if (startIndex >= 0 && endIndex >= 0 && endIndex > startIndex) {
      const before = existing.slice(0, startIndex);
      const after = existing.slice(endIndex + managedEnd.length);
      const managedBody = this.extractManagedBody(nextSection, managedStart, managedEnd);
      return `${before}${managedBody}${after}`.replace(/\n{3,}/g, "\n\n");
    }

    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    return `${existing}${separator}${this.extractManagedBody(
      nextSection,
      managedStart,
      managedEnd
    )}`;
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
}
