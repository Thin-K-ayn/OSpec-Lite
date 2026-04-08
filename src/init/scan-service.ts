import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DEFAULT_RULES } from "../core/schema";
import {
  DirectoryMapItem,
  EntryPointItem,
  RepositoryScanResult,
  RuleItem
} from "../core/types";
import { FileRepo } from "../fs/file-repo";

const GENERIC_ROLE_MAP: Record<string, string> = {
  src: "primary source code",
  script: "source or scripting area",
  scripts: "source or scripting area",
  docs: "documentation",
  tests: "tests",
  test: "tests",
  assets: "assets or Unity content",
  tools: "developer tooling",
  config: "configuration",
  configs: "configuration",
  packages: "package modules",
  node_modules: "dependencies"
};

const IMPORT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".lua",
  ".py",
  ".cs"
]);

const ENTRYPOINT_BASENAMES = new Set([
  "main",
  "index",
  "app",
  "program",
  "start",
  "bootstrap",
  "server",
  "client"
]);

const ENTRYPOINT_KEYWORDS = ["entry", "bootstrap", "start", "main", "game"];

export class ScanService {
  constructor(private readonly repo: FileRepo) {}

  async scan(rootDir: string): Promise<RepositoryScanResult> {
    const projectName = path.basename(path.resolve(rootDir));
    const topLevelEntries = await this.repo.listDirents(rootDir);
    const directoryMap = topLevelEntries
      .filter((entry) => entry.name !== ".git")
      .filter((entry) => entry.name !== "node_modules")
      .map((entry) => this.toDirectoryMapItem(entry.name, entry.isDirectory()));

    const entrypoints = await this.findLikelyEntrypoints(rootDir);
    const rules = await this.collectRules(rootDir);
    const importantFiles = this.collectImportantFiles(directoryMap, entrypoints);
    const glossarySeeds = this.collectGlossarySeeds(directoryMap, importantFiles);

    return {
      projectName,
      rootDir,
      directoryMap,
      entrypoints,
      rules,
      importantFiles,
      glossarySeeds,
      signals: await this.collectSignals(rootDir, topLevelEntries.map((entry) => entry.name))
    };
  }

  private toDirectoryMapItem(name: string, isDirectory: boolean): DirectoryMapItem {
    const normalized = name.toLowerCase();
    return {
      path: name,
      kind: isDirectory ? "directory" : "file",
      role: GENERIC_ROLE_MAP[normalized] ?? (isDirectory ? "unknown working area" : "important root file")
    };
  }

  private async collectSignals(
    rootDir: string,
    topLevelNames: string[]
  ): Promise<Record<string, boolean>> {
    const topLevel = new Set(topLevelNames);
    return {
      hasGit: await this.repo.exists(path.join(rootDir, ".git")),
      hasPackageJson: topLevel.has("package.json"),
      hasReadme: topLevel.has("README.md"),
      hasDocsDir: topLevel.has("docs"),
      hasSrcDir: topLevel.has("src"),
      hasTestsDir: topLevel.has("tests"),
      hasScriptDir: topLevel.has("Script"),
      hasAssetsDir: topLevel.has("Assets"),
      hasUnityProjectSettings: topLevel.has("ProjectSettings")
    };
  }

  private async collectRules(rootDir: string): Promise<RuleItem[]> {
    const rules: RuleItem[] = DEFAULT_RULES.map((text, index) => ({
      id: `default-${index + 1}`,
      text,
      source: "default"
    }));

    for (const fileName of ["AGENTS.md", "CLAUDE.md"]) {
      const filePath = path.join(rootDir, fileName);
      if (!(await this.repo.exists(filePath))) {
        continue;
      }

      const content = await this.repo.readText(filePath);
      const harvested = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .filter((line) => /(must|never|should|required|avoid)/i.test(line))
        .slice(0, 6);

      for (const line of harvested) {
        rules.push({
          id: `harvested-${rules.length + 1}`,
          text: line.replace(/^- /, ""),
          source: "harvested"
        });
      }
    }

    return this.uniqueRules(rules);
  }

  private uniqueRules(rules: RuleItem[]): RuleItem[] {
    const seen = new Set<string>();
    const unique: RuleItem[] = [];

    for (const rule of rules) {
      const key = rule.text.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(rule);
    }

    return unique;
  }

  private collectImportantFiles(
    directoryMap: DirectoryMapItem[],
    entrypoints: EntryPointItem[]
  ): string[] {
    const important = new Set<string>([
      "README.md",
      "package.json",
      "AGENTS.md",
      "CLAUDE.md",
      "docs/project/overview.md"
    ]);

    for (const item of directoryMap) {
      if (item.kind === "directory" && item.role !== "unknown working area") {
        important.add(item.path);
      }
    }

    for (const entrypoint of entrypoints.slice(0, 6)) {
      important.add(entrypoint.path);
    }

    return Array.from(important).sort((left, right) => left.localeCompare(right));
  }

  private collectGlossarySeeds(
    directoryMap: DirectoryMapItem[],
    importantFiles: string[]
  ): string[] {
    const terms = new Set<string>();
    for (const item of directoryMap) {
      for (const token of this.tokenize(item.path)) {
        terms.add(token);
      }
    }
    for (const filePath of importantFiles) {
      for (const token of this.tokenize(path.basename(filePath, path.extname(filePath)))) {
        terms.add(token);
      }
    }
    return Array.from(terms)
      .filter((token) => token.length >= 3)
      .filter((token) => !["readme", "docs", "src", "tests", "tools"].includes(token))
      .sort((left, right) => left.localeCompare(right));
  }

  private tokenize(value: string): string[] {
    return value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_./\\-]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
  }

  private async findLikelyEntrypoints(rootDir: string): Promise<EntryPointItem[]> {
    const candidateFiles = await this.walkCandidateFiles(rootDir, 0, 2);
    const scored: EntryPointItem[] = [];

    for (const filePath of candidateFiles) {
      const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
      const extension = path.extname(filePath).toLowerCase();
      if (!IMPORT_EXTENSIONS.has(extension)) {
        continue;
      }

      let score = 0;
      const reasons: string[] = [];
      const baseName = path.basename(filePath, extension).toLowerCase();
      const depth = relativePath.split("/").length - 1;

      if (ENTRYPOINT_BASENAMES.has(baseName)) {
        score += 6;
        reasons.push("entrypoint filename");
      }

      if (ENTRYPOINT_KEYWORDS.some((keyword) => baseName.includes(keyword))) {
        score += 2;
        reasons.push("entrypoint keyword");
      }

      if (depth === 0) {
        score += 3;
        reasons.push("root-level file");
      } else if (depth === 1) {
        score += 1;
        reasons.push("near-root file");
      }

      const content = await this.safeReadFile(filePath);
      if (content.length > 0) {
        const importMatches =
          (content.match(/\brequire\s*\(/g)?.length ?? 0) +
          (content.match(/\bimport\s+/g)?.length ?? 0);
        if (importMatches > 0) {
          score += Math.min(importMatches, 10);
          reasons.push(`central dependency count: ${importMatches}`);
        }
      }

      if (score <= 0) {
        continue;
      }

      scored.push({
        path: relativePath,
        score,
        reasons
      });
    }

    return scored
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, 8);
  }

  private async walkCandidateFiles(
    currentPath: string,
    currentDepth: number,
    maxDepth: number
  ): Promise<string[]> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const output: string[] = [];

    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }

      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (currentDepth < maxDepth) {
          output.push(...(await this.walkCandidateFiles(nextPath, currentDepth + 1, maxDepth)));
        }
        continue;
      }

      output.push(nextPath);
    }

    return output;
  }

  private async safeReadFile(filePath: string): Promise<string> {
    try {
      const content = await this.repo.readText(filePath);
      return content.slice(0, 64000);
    } catch {
      return "";
    }
  }
}
