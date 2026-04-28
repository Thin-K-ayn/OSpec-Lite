import * as path from "node:path";
import {
  DependencyInsight,
  DependencySection,
  PackageManagerInfo,
  RepoCommandSet,
  ToolingInsight
} from "../../core/ospec-lite-types";
import { FileRepo } from "../../fs/file-repo";

export const PACKAGE_MANAGER_LOCKFILES: ReadonlyArray<{
  fileName: string;
  name: PackageManagerInfo["name"];
}> = [
  { fileName: "pnpm-lock.yaml", name: "pnpm" },
  { fileName: "yarn.lock", name: "yarn" },
  { fileName: "bun.lockb", name: "bun" },
  { fileName: "bun.lock", name: "bun" },
  { fileName: "package-lock.json", name: "npm" }
];

const COMMAND_SCRIPT_NAMES: Array<keyof RepoCommandSet> = [
  "dev",
  "start",
  "build",
  "test",
  "lint",
  "typecheck"
];

const DEPENDENCY_SECTION_WEIGHT: Record<DependencySection, number> = {
  dependencies: 80,
  peerDependencies: 70,
  optionalDependencies: 60,
  devDependencies: 50
};

const DEPENDENCY_PRIORITY_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  score: number;
}> = [
  { pattern: /^(react|react-dom|next|vue|nuxt|svelte|solid-js|angular)$/i, score: 70 },
  { pattern: /^(typescript|ts-node|tsx|@types\/node)$/i, score: 65 },
  { pattern: /^(vite|webpack|rollup|esbuild|tsup|parcel)$/i, score: 60 },
  { pattern: /^(jest|vitest|mocha|ava|cypress|playwright|@playwright\/test)$/i, score: 55 },
  { pattern: /^(eslint|prettier|stylelint|biome)$/i, score: 50 },
  { pattern: /^(express|fastify|koa|hono|nestjs)$/i, score: 45 },
  { pattern: /^(electron|tauri|expo)$/i, score: 40 }
];

interface PackageJsonShape {
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export class ToolingAnalyzer {
  constructor(private readonly repo: FileRepo) {}

  async collectTooling(rootDir: string, topLevelNames: string[]): Promise<ToolingInsight> {
    const topLevel = new Set(topLevelNames.map((name) => name.toLowerCase()));
    const packageJson = await this.readPackageJson(rootDir);
    const packageManager = this.detectPackageManager(topLevel, packageJson);
    const scripts = this.normalizeScripts(packageJson?.scripts);

    return {
      packageManager,
      scripts,
      commands: this.collectCommands(packageManager, scripts, packageJson),
      majorDependencies: this.collectMajorDependencies(packageJson)
    };
  }

  private async readPackageJson(rootDir: string): Promise<PackageJsonShape | null> {
    const packageJsonPath = path.join(rootDir, "package.json");
    if (!(await this.repo.exists(packageJsonPath))) {
      return null;
    }

    try {
      return await this.repo.readJson<PackageJsonShape>(packageJsonPath);
    } catch {
      return null;
    }
  }

  private normalizeScripts(
    scripts: Record<string, string> | undefined
  ): Record<string, string> {
    if (!scripts) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(scripts)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .sort((left, right) => left[0].localeCompare(right[0]))
    );
  }

  private detectPackageManager(
    topLevel: Set<string>,
    packageJson: PackageJsonShape | null
  ): PackageManagerInfo | null {
    for (const lockfile of PACKAGE_MANAGER_LOCKFILES) {
      if (topLevel.has(lockfile.fileName.toLowerCase())) {
        return this.buildPackageManagerInfo(lockfile.name, "lockfile", lockfile.fileName);
      }
    }

    const declaredPackageManager = packageJson?.packageManager?.split("@")[0]?.trim().toLowerCase();
    if (
      declaredPackageManager === "npm" ||
      declaredPackageManager === "pnpm" ||
      declaredPackageManager === "yarn" ||
      declaredPackageManager === "bun"
    ) {
      return this.buildPackageManagerInfo(declaredPackageManager, "package-json");
    }

    if (packageJson) {
      return this.buildPackageManagerInfo("npm", "heuristic");
    }

    return null;
  }

  private buildPackageManagerInfo(
    name: PackageManagerInfo["name"],
    source: PackageManagerInfo["source"],
    lockFile?: string
  ): PackageManagerInfo {
    switch (name) {
      case "npm":
        return {
          name,
          source,
          lockFile,
          installCommand: lockFile ? "npm ci" : "npm install",
          scriptCommandPrefix: "npm run"
        };
      case "pnpm":
        return {
          name,
          source,
          lockFile,
          installCommand: "pnpm install --frozen-lockfile",
          scriptCommandPrefix: "pnpm"
        };
      case "yarn":
        return {
          name,
          source,
          lockFile,
          installCommand: lockFile ? "yarn install --immutable" : "yarn install",
          scriptCommandPrefix: "yarn"
        };
      case "bun":
        return {
          name,
          source,
          lockFile,
          installCommand: "bun install",
          scriptCommandPrefix: "bun run"
        };
      default:
        return {
          name,
          source,
          lockFile
        };
    }
  }

  private collectCommands(
    packageManager: PackageManagerInfo | null,
    scripts: Record<string, string>,
    packageJson: PackageJsonShape | null
  ): RepoCommandSet {
    const commands: RepoCommandSet = {};
    if (packageManager?.installCommand) {
      commands.install = packageManager.installCommand;
    }

    for (const scriptName of COMMAND_SCRIPT_NAMES) {
      if (!scripts[scriptName]) {
        continue;
      }
      commands[scriptName] = this.renderScriptCommand(packageManager, scriptName);
    }

    if (packageJson?.name && packageManager?.name === "npm") {
      commands.pack = "npm pack --dry-run";
    }

    return commands;
  }

  private renderScriptCommand(
    packageManager: PackageManagerInfo | null,
    scriptName: keyof RepoCommandSet
  ): string {
    switch (packageManager?.name) {
      case "pnpm":
        return `pnpm ${scriptName}`;
      case "yarn":
        return `yarn ${scriptName}`;
      case "bun":
        return `bun run ${scriptName}`;
      case "npm":
      default:
        if (scriptName === "test") {
          return "npm test";
        }
        return `npm run ${scriptName}`;
    }
  }

  private collectMajorDependencies(
    packageJson: PackageJsonShape | null
  ): DependencyInsight[] {
    if (!packageJson) {
      return [];
    }

    const dependencies: Array<DependencyInsight & { score: number }> = [];
    for (const section of Object.keys(DEPENDENCY_SECTION_WEIGHT) as DependencySection[]) {
      const sectionDependencies = packageJson[section];
      if (!sectionDependencies) {
        continue;
      }

      for (const [name, version] of Object.entries(sectionDependencies)) {
        let score = DEPENDENCY_SECTION_WEIGHT[section];
        for (const priority of DEPENDENCY_PRIORITY_PATTERNS) {
          if (priority.pattern.test(name)) {
            score += priority.score;
            break;
          }
        }

        dependencies.push({
          name,
          version,
          section,
          score
        });
      }
    }

    return dependencies
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.section.localeCompare(right.section) ||
          left.name.localeCompare(right.name)
      )
      .slice(0, 12)
      .map(({ score: _score, ...dependency }) => dependency);
  }
}
