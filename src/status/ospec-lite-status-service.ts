import * as path from "node:path";
import { INIT_MARKERS, OSPEC_LITE_DIR } from "../core/ospec-lite-schema";
import { OSpecLiteConfig, StatusReport } from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";

export class StatusService {
  constructor(private readonly repo: FileRepo) {}

  async getStatus(rootDir: string): Promise<StatusReport> {
    const missingMarkers: string[] = [];
    for (const marker of INIT_MARKERS) {
      if (!(await this.repo.exists(path.join(rootDir, marker)))) {
        missingMarkers.push(marker);
      }
    }

    const state =
      missingMarkers.length === INIT_MARKERS.length
        ? "uninitialized"
        : missingMarkers.length === 0
          ? "initialized"
          : "incomplete";

    const configPath = path.join(rootDir, OSPEC_LITE_DIR, "config.json");
    const config =
      state !== "uninitialized" && (await this.repo.exists(configPath))
        ? await this.repo.readJson<OSpecLiteConfig>(configPath)
        : null;

    return {
      state,
      missingMarkers,
      config,
      activeChanges: await this.listChangeNames(path.join(rootDir, "changes", "active")),
      archivedChanges: await this.listArchivedChangeNames(path.join(rootDir, "changes", "archived"))
    };
  }

  private async listChangeNames(dirPath: string): Promise<string[]> {
    if (!(await this.repo.exists(dirPath))) {
      return [];
    }
    const entries = await this.repo.listDirents(dirPath);
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  }

  private async listArchivedChangeNames(dirPath: string): Promise<string[]> {
    if (!(await this.repo.exists(dirPath))) {
      return [];
    }

    const result: string[] = [];
    const monthDirs = await this.repo.listDirents(dirPath);
    for (const monthDir of monthDirs) {
      if (!monthDir.isDirectory()) {
        continue;
      }
      const monthPath = path.join(dirPath, monthDir.name);
      const dayDirs = await this.repo.listDirents(monthPath);
      for (const dayDir of dayDirs) {
        if (!dayDir.isDirectory()) {
          continue;
        }
        const dayPath = path.join(monthPath, dayDir.name);
        const changes = await this.repo.listDirents(dayPath);
        for (const changeDir of changes) {
          if (changeDir.isDirectory()) {
            result.push(changeDir.name);
          }
        }
      }
    }
    return result.sort((left, right) => left.localeCompare(right));
  }
}
