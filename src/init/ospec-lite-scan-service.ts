import * as path from "node:path";
import {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START,
  DEFAULT_RULES
} from "../core/ospec-lite-schema";
import {
  DependencyInsight,
  DependencySection,
  DirectoryMapItem,
  EntryPointItem,
  LanguageInsight,
  PackageManagerInfo,
  PathAdvisory,
  RepositoryScanResult,
  RepoCommandSet,
  RuleItem,
  ToolingInsight
} from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";

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
const RULE_SECTION_HEADINGS = new Set(["Hard Rules", "关键写作规则"]);
const DIRECTIVE_RULE_PATTERNS = [
  /\b(?:must|never|should|required|avoid)\b/i,
  /必须|不要|禁止|避免|应当|应该|不得|先读|先完成/
];
const MAX_HARVESTED_RULES = 6;
const MAX_LANGUAGE_FILES = 4000;
const MAX_LANGUAGE_DEPTH = 8;
const MAX_GENERATED_DIR_DEPTH = 5;

const ALWAYS_IGNORED_DIRECTORIES = new Set([".git", ".oslite", "node_modules"]);
const ALWAYS_IGNORED_TOP_LEVEL_FILES = new Set(["agents.md", "claude.md"]);
const GENERATED_DIRECTORY_NAMES = new Set([
  ".cache",
  ".next",
  ".nuxt",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "gen",
  "generate",
  "generated",
  "out",
  "target",
  "tmp"
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".cjs": "JavaScript",
  ".cs": "C#",
  ".css": "CSS",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".json": "JSON",
  ".jsx": "JavaScript",
  ".lua": "Lua",
  ".md": "Markdown",
  ".mjs": "JavaScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".rs": "Rust",
  ".scss": "CSS",
  ".sh": "Shell",
  ".sql": "SQL",
  ".tsx": "TypeScript",
  ".ts": "TypeScript",
  ".vue": "Vue",
  ".xml": "XML",
  ".yaml": "YAML",
  ".yml": "YAML"
};

const LANGUAGE_PRIORITY: Record<string, number> = {
  "C#": 4,
  HTML: 3,
  Java: 4,
  JavaScript: 4,
  Lua: 4,
  Python: 4,
  Ruby: 4,
  Rust: 4,
  SQL: 3,
  TypeScript: 4,
  Vue: 4,
  XML: 2,
  CSS: 2,
  JSON: 1,
  Markdown: 1,
  Shell: 2,
  YAML: 1
};

const PACKAGE_MANAGER_LOCKFILES: ReadonlyArray<{
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

export class ScanService {
  constructor(private readonly repo: FileRepo) {}

  async scan(rootDir: string): Promise<RepositoryScanResult> {
    const projectName = path.basename(path.resolve(rootDir));
    const topLevelEntries = await this.repo.listDirents(rootDir);
    const topLevelScanEntries = topLevelEntries.filter(
      (entry) =>
        !this.shouldSkipDirectoryEntry(entry.name, entry.isDirectory()) &&
        !this.shouldSkipTopLevelFile(entry.name, entry.isDirectory())
    );
    const topLevelNames = topLevelScanEntries.map((entry) => entry.name);
    const generatedDirectories = await this.collectGeneratedDirectories(rootDir, 0);
    const directoryMap = topLevelScanEntries
      .map((entry) => this.toDirectoryMapItem(entry.name, entry.isDirectory()));

    const entrypoints = await this.findLikelyEntrypoints(rootDir);
    const rules = await this.collectRules(rootDir);
    const tooling = await this.collectTooling(rootDir, topLevelNames);
    const importantFiles = this.collectImportantFiles(directoryMap, entrypoints, tooling);
    const glossarySeeds = this.collectGlossarySeeds(directoryMap, importantFiles);
    const primaryLanguages = await this.collectPrimaryLanguages(rootDir);
    const riskyPaths = this.collectRiskyPaths(topLevelNames, tooling, entrypoints, generatedDirectories);
    const askFirstAreas = this.collectAskFirstAreas(topLevelNames, tooling, generatedDirectories);

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
      hasLockfile: PACKAGE_MANAGER_LOCKFILES.some((item) => topLevel.has(item.fileName.toLowerCase())),
      hasGeneratedDir: generatedDirectories.length > 0
    };
  }

  private async collectRules(rootDir: string): Promise<RuleItem[]> {
    const rules: RuleItem[] = DEFAULT_RULES.map((text, index) => ({
      id: `default-${index + 1}`,
      text,
      source: "default"
    }));
    const contents: string[] = [];

    for (const fileName of ["AGENTS.md", "CLAUDE.md"]) {
      const filePath = path.join(rootDir, fileName);
      if (!(await this.repo.exists(filePath))) {
        continue;
      }

      contents.push(this.stripManagedInstructionSections(await this.repo.readText(filePath)));
    }

    for (const text of this.collectHarvestedRuleTexts(contents)) {
      rules.push({
        id: `harvested-${rules.length + 1}`,
        text,
        source: "harvested"
      });
    }

    return this.uniqueRules(rules);
  }

  private collectHarvestedRuleTexts(contents: string[]): string[] {
    const sectionCandidates: string[] = [];
    const sectionKeys = new Set<string>();
    const fallbackCandidates: string[] = [];

    for (const content of contents) {
      for (const text of this.collectRuleSectionBullets(content)) {
        sectionCandidates.push(text);
        sectionKeys.add(this.toRuleKey(text));
      }
    }

    for (const content of contents) {
      for (const text of this.collectBulletLines(content)) {
        if (sectionKeys.has(this.toRuleKey(text))) {
          continue;
        }
        if (this.isDirectiveRule(text)) {
          fallbackCandidates.push(text);
        }
      }
    }

    return this.takeUniqueRules(sectionCandidates, fallbackCandidates);
  }

  private takeUniqueRules(...groups: string[][]): string[] {
    const harvested: string[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
      for (const text of group) {
        const key = this.toRuleKey(text);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        harvested.push(text);
        if (harvested.length === MAX_HARVESTED_RULES) {
          return harvested;
        }
      }
    }

    return harvested;
  }

  private collectRuleSectionBullets(content: string): string[] {
    const bullets: string[] = [];

    for (const sectionBody of this.extractRuleSectionBodies(content)) {
      bullets.push(...this.collectBulletLines(sectionBody));
    }

    return bullets;
  }

  private extractRuleSectionBodies(content: string): string[] {
    const lines = content.split(/\r?\n/);
    const sections: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const heading = this.parseHeading(lines[index]);
      if (!heading || !RULE_SECTION_HEADINGS.has(heading.title)) {
        continue;
      }

      let endIndex = lines.length;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const nextHeading = this.parseHeading(lines[cursor]);
        if (nextHeading && nextHeading.level <= heading.level) {
          endIndex = cursor;
          break;
        }
      }

      sections.push(lines.slice(index + 1, endIndex).join("\n"));
      index = endIndex - 1;
    }

    return sections;
  }

  private parseHeading(line: string): { level: number; title: string } | null {
    const match = /^\s*(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (!match) {
      return null;
    }

    return {
      level: match[1].length,
      title: match[2].trim()
    };
  }

  private collectBulletLines(content: string): string[] {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim())
      .filter(Boolean);
  }

  private isDirectiveRule(text: string): boolean {
    return DIRECTIVE_RULE_PATTERNS.some((pattern) => pattern.test(text));
  }

  private toRuleKey(text: string): string {
    return text.toLowerCase();
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

  private async collectTooling(
    rootDir: string,
    topLevelNames: string[]
  ): Promise<ToolingInsight> {
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

  private async collectPrimaryLanguages(rootDir: string): Promise<LanguageInsight[]> {
    const counts = new Map<string, { fileCount: number; extensions: Set<string> }>();
    let visitedFiles = 0;

    const walk = async (currentPath: string, currentDepth: number): Promise<void> => {
      if (currentDepth > MAX_LANGUAGE_DEPTH || visitedFiles >= MAX_LANGUAGE_FILES) {
        return;
      }

      const entries = await this.repo.listDirents(currentPath);
      for (const entry of entries) {
        if (visitedFiles >= MAX_LANGUAGE_FILES) {
          return;
        }

        if (entry.isDirectory()) {
          if (this.shouldSkipDirectory(entry.name, true)) {
            continue;
          }
          await walk(path.join(currentPath, entry.name), currentDepth + 1);
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        const language = LANGUAGE_BY_EXTENSION[extension];
        if (!language) {
          continue;
        }

        visitedFiles += 1;
        const current = counts.get(language) ?? {
          fileCount: 0,
          extensions: new Set<string>()
        };
        current.fileCount += 1;
        current.extensions.add(extension);
        counts.set(language, current);
      }
    };

    await walk(rootDir, 0);

    return Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        fileCount: value.fileCount,
        extensions: Array.from(value.extensions).sort((left, right) =>
          left.localeCompare(right)
        )
      }))
      .sort(
        (left, right) =>
          right.fileCount - left.fileCount ||
          (LANGUAGE_PRIORITY[right.name] ?? 0) - (LANGUAGE_PRIORITY[left.name] ?? 0) ||
          left.name.localeCompare(right.name)
      )
      .slice(0, 8);
  }

  private async collectGeneratedDirectories(
    currentPath: string,
    currentDepth: number,
    rootDir = currentPath,
    results = new Set<string>()
  ): Promise<string[]> {
    if (currentDepth > MAX_GENERATED_DIR_DEPTH) {
      return Array.from(results).sort((left, right) => left.localeCompare(right));
    }

    const entries = await this.repo.listDirents(currentPath);
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (ALWAYS_IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) {
        continue;
      }

      const nextPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootDir, nextPath).replace(/\\/g, "/");
      const normalized = entry.name.toLowerCase();

      if (GENERATED_DIRECTORY_NAMES.has(normalized)) {
        results.add(relativePath);
        continue;
      }

      await this.collectGeneratedDirectories(nextPath, currentDepth + 1, rootDir, results);
    }

    return Array.from(results).sort((left, right) => left.localeCompare(right));
  }

  private collectRiskyPaths(
    topLevelNames: string[],
    tooling: ToolingInsight,
    entrypoints: EntryPointItem[],
    generatedDirectories: string[]
  ): PathAdvisory[] {
    const advisories = new Map<string, PathAdvisory>();
    const topLevel = new Set(topLevelNames);

    if (topLevel.has("package.json")) {
      this.addAdvisory(advisories, {
        path: "package.json",
        kind: "package-manifest",
        reason: "Changes package metadata, scripts, and dependency declarations."
      });
    }

    if (tooling.packageManager?.lockFile) {
      this.addAdvisory(advisories, {
        path: tooling.packageManager.lockFile,
        kind: "lockfile",
        reason: "Changes dependency resolution for the whole repository."
      });
    }

    if (topLevel.has(".github")) {
      this.addAdvisory(advisories, {
        path: ".github/workflows",
        kind: "workflow",
        reason: "Changes CI or automation behavior for pull requests and pushes."
      });
    }

    if (topLevel.has("AGENTS.md")) {
      this.addAdvisory(advisories, {
        path: "AGENTS.md",
        kind: "agent-instructions",
        reason: "Changes repo-local agent instructions and task behavior."
      });
    }

    if (topLevel.has("CLAUDE.md")) {
      this.addAdvisory(advisories, {
        path: "CLAUDE.md",
        kind: "agent-instructions",
        reason: "Changes Claude Code project memory and repo-local guidance."
      });
    }

    for (const entrypoint of entrypoints.slice(0, 3)) {
      this.addAdvisory(advisories, {
        path: entrypoint.path,
        kind: "entrypoint",
        reason: "Likely bootstrap or central orchestration path."
      });
    }

    for (const generatedDirectory of generatedDirectories) {
      this.addAdvisory(advisories, {
        path: generatedDirectory,
        kind: "generated",
        reason: "Likely generated output. Prefer editing the source that produces it."
      });
    }

    return this.sortAdvisories(advisories);
  }

  private collectAskFirstAreas(
    topLevelNames: string[],
    tooling: ToolingInsight,
    generatedDirectories: string[]
  ): PathAdvisory[] {
    const advisories = new Map<string, PathAdvisory>();
    const topLevel = new Set(topLevelNames);

    if (topLevel.has("package.json")) {
      this.addAdvisory(advisories, {
        path: "package.json",
        kind: "package-manifest",
        reason: "Confirm before changing packaging, scripts, or publish-facing metadata."
      });
    }

    if (tooling.packageManager?.lockFile) {
      this.addAdvisory(advisories, {
        path: tooling.packageManager.lockFile,
        kind: "lockfile",
        reason: "Confirm before changing dependency lockfiles or mass-updating packages."
      });
    }

    if (topLevel.has(".github")) {
      this.addAdvisory(advisories, {
        path: ".github/workflows",
        kind: "workflow",
        reason: "Confirm before changing repository automation or required checks."
      });
    }

    if (topLevel.has("AGENTS.md")) {
      this.addAdvisory(advisories, {
        path: "AGENTS.md",
        kind: "agent-instructions",
        reason: "Confirm before changing repo-local agent policies."
      });
    }

    if (topLevel.has("CLAUDE.md")) {
      this.addAdvisory(advisories, {
        path: "CLAUDE.md",
        kind: "agent-instructions",
        reason: "Confirm before changing Claude-specific repo guidance."
      });
    }

    for (const generatedDirectory of generatedDirectories) {
      this.addAdvisory(advisories, {
        path: generatedDirectory,
        kind: "generated",
        reason: "Confirm before editing generated output directly instead of its source."
      });
    }

    return this.sortAdvisories(advisories);
  }

  private addAdvisory(advisories: Map<string, PathAdvisory>, advisory: PathAdvisory): void {
    if (!advisories.has(advisory.path)) {
      advisories.set(advisory.path, advisory);
    }
  }

  private sortAdvisories(advisories: Map<string, PathAdvisory>): PathAdvisory[] {
    return Array.from(advisories.values()).sort(
      (left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind)
    );
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
    const entries = await this.repo.listDirents(currentPath);
    const output: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && this.shouldSkipDirectory(entry.name, true)) {
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

  private shouldSkipTopLevelFile(name: string, isDirectory: boolean): boolean {
    return !isDirectory && ALWAYS_IGNORED_TOP_LEVEL_FILES.has(name.toLowerCase());
  }

  private stripManagedInstructionSections(content: string): string {
    return this.stripManagedSection(
      this.stripManagedSection(content, AGENTS_MANAGED_START, AGENTS_MANAGED_END),
      CLAUDE_MANAGED_START,
      CLAUDE_MANAGED_END
    );
  }

  private stripManagedSection(content: string, startMarker: string, endMarker: string): string {
    const startIndex = content.indexOf(startMarker);
    if (startIndex < 0) {
      return content;
    }

    const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
    if (endIndex < 0) {
      return content;
    }

    return `${content.slice(0, startIndex)}${content.slice(endIndex + endMarker.length)}`;
  }

  private shouldSkipDirectoryEntry(name: string, isDirectory: boolean): boolean {
    return isDirectory && ALWAYS_IGNORED_DIRECTORIES.has(name.toLowerCase());
  }

  private shouldSkipDirectory(name: string, ignoreGenerated: boolean): boolean {
    const normalized = name.toLowerCase();
    if (ALWAYS_IGNORED_DIRECTORIES.has(normalized)) {
      return true;
    }

    if (ignoreGenerated && GENERATED_DIRECTORY_NAMES.has(normalized)) {
      return true;
    }

    return false;
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
