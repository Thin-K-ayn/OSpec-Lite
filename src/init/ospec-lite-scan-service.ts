import * as path from "node:path";
import {
  DirectoryMapItem,
  EntryPointItem,
  RepositoryScanResult,
  ToolingInsight
} from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";
import {
  PACKAGE_MANAGER_LOCKFILES,
  ToolingAnalyzer
} from "./scan/scan-tooling-analyzer";
import { RuleHarvester } from "./scan/scan-rule-harvester";
import { LanguageAnalyzer } from "./scan/scan-language-analyzer";
import {
  collectAskFirstAreas,
  collectRiskyPaths
} from "./scan/scan-advisory-builder";
import {
  shouldSkipDirectoryEntry,
  shouldSkipTopLevelFile
} from "./scan/scan-shared";

const GENERIC_ROLE_MAP: Record<string, string> = {
  ".agents": "repo-local agent plugin marketplace",
  ".claude": "Claude Code wrappers or settings",
  ".github": "automation and CI",
  ".vscode": "editor workspace settings",
  assets: "assets or Unity content",
  build: "generated output",
  config: "configuration",
  configs: "configuration",
  coverage: "test coverage output",
  dist: "generated output",
  docs: "documentation",
  out: "generated output",
  packages: "package modules",
  plugins: "plugin assets",
  profiles: "profile assets",
  script: "source or scripting area",
  scripts: "source or scripting area",
  src: "primary source code",
  test: "tests",
  tests: "tests",
  tools: "developer tooling"
};

export class ScanService {
  private readonly ruleHarvester: RuleHarvester;
  private readonly toolingAnalyzer: ToolingAnalyzer;
  private readonly languageAnalyzer: LanguageAnalyzer;

  constructor(private readonly repo: FileRepo) {
    this.ruleHarvester = new RuleHarvester(repo);
    this.toolingAnalyzer = new ToolingAnalyzer(repo);
    this.languageAnalyzer = new LanguageAnalyzer(repo);
  }

  async scan(rootDir: string): Promise<RepositoryScanResult> {
    const projectName = path.basename(path.resolve(rootDir));
    const topLevelEntries = await this.repo.listDirents(rootDir);
    const topLevelScanEntries = topLevelEntries.filter(
      (entry) =>
        !shouldSkipDirectoryEntry(entry.name, entry.isDirectory()) &&
        !shouldSkipTopLevelFile(entry.name, entry.isDirectory())
    );
    const topLevelNames = topLevelScanEntries.map((entry) => entry.name);
    const generatedDirectories = await this.languageAnalyzer.collectGeneratedDirectories(
      rootDir
    );
    const directoryMap = topLevelScanEntries.map((entry) =>
      this.toDirectoryMapItem(entry.name, entry.isDirectory())
    );

    const entrypoints = await this.languageAnalyzer.findLikelyEntrypoints(rootDir);
    const rules = await this.ruleHarvester.collectRules(rootDir);
    const tooling = await this.toolingAnalyzer.collectTooling(rootDir, topLevelNames);
    const importantFiles = this.collectImportantFiles(directoryMap, entrypoints, tooling);
    const glossarySeeds = this.collectGlossarySeeds(directoryMap, importantFiles);
    const primaryLanguages = await this.languageAnalyzer.collectPrimaryLanguages(rootDir);
    const riskyPaths = collectRiskyPaths(
      topLevelNames,
      tooling,
      entrypoints,
      generatedDirectories
    );
    const askFirstAreas = collectAskFirstAreas(topLevelNames, tooling, generatedDirectories);

    return {
      projectName,
      rootDir,
      directoryMap,
      entrypoints,
      rules,
      importantFiles,
      glossarySeeds,
      signals: await this.collectSignals(rootDir, topLevelNames, generatedDirectories),
      tooling,
      primaryLanguages,
      generatedDirectories,
      riskyPaths,
      askFirstAreas
    };
  }

  private toDirectoryMapItem(name: string, isDirectory: boolean): DirectoryMapItem {
    const normalized = name.toLowerCase();
    return {
      path: name,
      kind: isDirectory ? "directory" : "file",
      role:
        GENERIC_ROLE_MAP[normalized] ??
        (isDirectory ? "unknown working area" : "important root file")
    };
  }

  private async collectSignals(
    rootDir: string,
    topLevelNames: string[],
    generatedDirectories: string[]
  ): Promise<Record<string, boolean>> {
    const topLevel = new Set(topLevelNames.map((name) => name.toLowerCase()));
    return {
      hasGit: await this.repo.exists(path.join(rootDir, ".git")),
      hasPackageJson: topLevel.has("package.json"),
      hasReadme: topLevel.has("readme.md"),
      hasDocsDir: topLevel.has("docs"),
      hasSrcDir: topLevel.has("src"),
      hasTestsDir: topLevel.has("tests") || topLevel.has("test"),
      hasScriptDir: topLevel.has("script") || topLevel.has("scripts"),
      hasAssetsDir: topLevel.has("assets"),
      hasUnityProjectSettings: topLevel.has("projectsettings"),
      hasGithubDir: topLevel.has(".github"),
      hasLockfile: PACKAGE_MANAGER_LOCKFILES.some((item) =>
        topLevel.has(item.fileName.toLowerCase())
      ),
      hasGeneratedDir: generatedDirectories.length > 0
    };
  }

  private collectImportantFiles(
    directoryMap: DirectoryMapItem[],
    entrypoints: EntryPointItem[],
    tooling: ToolingInsight
  ): string[] {
    const important = new Set<string>([
      "README.md",
      "package.json",
      "AGENTS.md",
      "CLAUDE.md",
      ".oslite/docs/project/overview.md"
    ]);

    for (const item of directoryMap) {
      if (item.kind === "directory" && item.role !== "unknown working area") {
        important.add(item.path);
      }
    }

    if (tooling.packageManager?.lockFile) {
      important.add(tooling.packageManager.lockFile);
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
}
