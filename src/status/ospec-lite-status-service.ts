import * as path from "node:path";
import {
  AUTHORING_PACK_FILES,
  INIT_MARKERS,
  OSPEC_LITE_DIR
} from "../core/ospec-lite-schema";
import { OSpecLiteConfig, StatusReport } from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";

export class StatusService {
  constructor(private readonly repo: FileRepo) {}

  async getStatus(rootDir: string): Promise<StatusReport> {
    const configPath = path.join(rootDir, OSPEC_LITE_DIR, "config.json");
    const indexPath = path.join(rootDir, OSPEC_LITE_DIR, "index.json");
    const hasBootstrapArtifacts =
      (await this.repo.exists(configPath)) || (await this.repo.exists(indexPath));
    const config =
      statefulConfigRequired(hasBootstrapArtifacts, await this.repo.exists(configPath))
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

    const state =
      !hasBootstrapArtifacts
        ? "uninitialized"
        : missingMarkers.length === 0
          ? "initialized"
          : "incomplete";

    return {
      state,
      missingMarkers,
      config,
      activeChanges: await this.listChangeNames(path.join(rootDir, OSPEC_LITE_DIR, "changes", "active")),
      archivedChanges: await this.listArchivedChangeNames(path.join(rootDir, OSPEC_LITE_DIR, "changes", "archived"))
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

function statefulConfigRequired(
  hasBootstrapArtifacts: boolean,
  hasConfigFile: boolean
): boolean {
  return hasBootstrapArtifacts && hasConfigFile;
}
