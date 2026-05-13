import * as path from "node:path";
import {
  AUTHORING_PACK_FILES,
  DEFAULT_AUTHORING_PACK_ROOT,
  OSPEC_LITE_DIR
} from "../core/ospec-lite-schema";
import {
  DocChecklistFile,
  DocChecklistSectionRule,
  DocTaskChecklist,
  DocVerificationIssue,
  DocVerificationReport,
  LoadedOSpecLiteProfile,
  OSpecLiteConfig,
  RepositoryVerificationCheck
} from "../core/ospec-lite-types";
import {
  DocVerificationError,
  NotInitializedError,
  OSpecLiteError
} from "../core/ospec-lite-errors";
import { FileRepo } from "../fs/file-repo";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";

export class DocVerifierService {
  constructor(
    private readonly repo: FileRepo,
    private readonly profiles: ProfileLoader
  ) {}

  async verify(rootDir: string): Promise<DocVerificationReport> {
    const configPath = path.join(rootDir, OSPEC_LITE_DIR, "config.json");
    if (!(await this.repo.exists(configPath))) {
      throw new NotInitializedError(rootDir);
    }

    const config = await this.repo.readJson<OSpecLiteConfig>(configPath);
    if (!config.profileId) {
      throw new OSpecLiteError("This repository does not have an active ospec-lite profile.");
    }

    const authoringPackRoot = config.authoringPackRoot ?? DEFAULT_AUTHORING_PACK_ROOT;
    const checklistPath = path.join(rootDir, authoringPackRoot, "doc-task-checklist.json");
    if (!(await this.repo.exists(checklistPath))) {
      throw new OSpecLiteError(
        `Missing documentation checklist: ${path.relative(rootDir, checklistPath).replace(/\\/g, "/")}`
      );
    }

    for (const fileName of AUTHORING_PACK_FILES) {
      const absolutePath = path.join(rootDir, authoringPackRoot, fileName);
      if (!(await this.repo.exists(absolutePath))) {
        throw new OSpecLiteError(
          `Missing authoring pack file: ${path.relative(rootDir, absolutePath).replace(/\\/g, "/")}`
        );
      }
    }

    const checklist = await this.repo.readJson<DocTaskChecklist>(checklistPath);
    const issues: DocVerificationIssue[] = [];
    const warnings: DocVerificationIssue[] = [];
    const checkedFiles: string[] = [];
    const profile = await this.profiles.loadProfile(config.profileId);

    if (checklist.profileId !== config.profileId) {
      issues.push({
        file: path.relative(rootDir, checklistPath).replace(/\\/g, "/"),
        message: `Checklist profile id ${checklist.profileId} does not match config profile ${config.profileId}.`
      });
    }

    for (const fileRule of checklist.files) {
      checkedFiles.push(fileRule.path);
      await this.verifyFile(rootDir, checklist, fileRule, issues);
    }

    const report: DocVerificationReport = {
      profileId: config.profileId,
      checklistPath: path.relative(rootDir, checklistPath).replace(/\\/g, "/"),
      checkedFiles,
      issues,
      repoChecks: await this.verifyRepositoryProfile(rootDir, profile, issues, warnings),
      warnings
    };

    if (issues.length > 0) {
      throw new DocVerificationError(report.profileId, report.checklistPath, report.issues);
    }

    return report;
  }

  private async verifyFile(
    rootDir: string,
    checklist: DocTaskChecklist,
    fileRule: DocChecklistFile,
    issues: DocVerificationIssue[]
  ): Promise<void> {
    const targetPath = path.join(rootDir, fileRule.path);
    if (!(await this.repo.exists(targetPath))) {
      issues.push({
        file: fileRule.path,
        message: "Missing required file."
      });
      return;
    }

    const content = await this.repo.readText(targetPath);

    this.checkHeadings(fileRule, content, issues);
    this.checkRequiredSnippets(fileRule.path, fileRule.requiredSnippets ?? [], content, issues);
    this.checkRequiredPatterns(fileRule.path, fileRule.requiredPatterns ?? [], content, issues);

    if (!fileRule.skipPlaceholderCheck) {
      this.checkPatternHits(
        fileRule.path,
        checklist.placeholderPatterns,
        content,
        issues,
        "Contains placeholder text that must be replaced."
      );
    }

    this.checkPatternHits(
      fileRule.path,
      checklist.forbiddenPatterns,
      content,
      issues,
      "Contains content forbidden by the active profile."
    );
    this.checkPatternHits(
      fileRule.path,
      fileRule.forbiddenPatterns ?? [],
      content,
      issues,
      "Contains file-specific forbidden content."
    );

    await this.checkEvidenceSections(rootDir, checklist, fileRule, content, issues);
    this.checkSectionRules(fileRule.path, fileRule.sectionRules ?? [], content, issues);
  }

  private checkHeadings(
    fileRule: DocChecklistFile,
    content: string,
    issues: DocVerificationIssue[]
  ): void {
    for (const heading of fileRule.requiredHeadings ?? []) {
      if (!content.includes(heading)) {
        issues.push({
          file: fileRule.path,
          message: `Missing required heading: ${heading}`
        });
      }
    }
  }

  private checkRequiredSnippets(
    filePath: string,
    snippets: string[],
    content: string,
    issues: DocVerificationIssue[]
  ): void {
    for (const snippet of snippets) {
      if (!content.includes(snippet)) {
        issues.push({
          file: filePath,
          message: `Missing required snippet: ${snippet}`
        });
      }
    }
  }

  private checkRequiredPatterns(
    filePath: string,
    patterns: string[],
    content: string,
    issues: DocVerificationIssue[]
  ): void {
    for (const pattern of patterns) {
      const regex = this.compilePattern(pattern);
      if (!regex.test(content)) {
        issues.push({
          file: filePath,
          message: `Missing required pattern: ${pattern}`
        });
      }
    }
  }

  private checkPatternHits(
    filePath: string,
    patterns: string[],
    content: string,
    issues: DocVerificationIssue[],
    message: string
  ): void {
    for (const pattern of patterns) {
      const regex = this.compilePattern(pattern);
      if (regex.test(content)) {
        issues.push({
          file: filePath,
          message: `${message} Pattern: ${pattern}`
        });
      }
    }
  }

  private async checkEvidenceSections(
    rootDir: string,
    checklist: DocTaskChecklist,
    fileRule: DocChecklistFile,
    content: string,
    issues: DocVerificationIssue[]
  ): Promise<void> {
    const evidenceLabel = checklist.requiredEvidenceLabels[1];
    const statusLabel = checklist.requiredEvidenceLabels[2];

    for (const heading of fileRule.evidenceSections ?? []) {
      const section = this.extractSection(content, heading);
      if (!section) {
        issues.push({
          file: fileRule.path,
          message: `Missing evidence section: ${heading}`
        });
        continue;
      }

      for (const label of checklist.requiredEvidenceLabels) {
        const labelRegex = new RegExp(`${this.escapeRegex(label)}[:：]`, "m");
        if (!labelRegex.test(section)) {
          issues.push({
            file: fileRule.path,
            message: `Section ${heading} is missing label ${label}`
          });
        }
      }

      const evidenceBlock = evidenceLabel
        ? this.extractLabeledBlock(section, evidenceLabel, checklist.requiredEvidenceLabels)
        : null;
      if (!evidenceBlock || evidenceBlock.paths.length === 0) {
        issues.push({
          file: fileRule.path,
          message: `Section ${heading} must list at least one evidence file.`
        });
      } else {
        for (const evidencePath of evidenceBlock.paths) {
          if (!(await this.repo.exists(path.join(rootDir, evidencePath)))) {
            issues.push({
              file: fileRule.path,
              message: `Section ${heading} references missing evidence path: ${evidencePath}`
            });
          }
        }
      }

      const statusBlock = statusLabel
        ? this.extractLabeledBlock(section, statusLabel, checklist.requiredEvidenceLabels)
        : null;
      if (!statusBlock) {
        issues.push({
          file: fileRule.path,
          message: `Section ${heading} is missing status content.`
        });
      } else if (
        !checklist.allowedStatuses.some((status) =>
          new RegExp(`(^|\\s|- )${this.escapeRegex(status)}($|\\s)`, "m").test(
            statusBlock.content
          )
        )
      ) {
        issues.push({
          file: fileRule.path,
          message: `Section ${heading} must use one of the allowed statuses: ${checklist.allowedStatuses.join(", ")}`
        });
      }
    }
  }

  private checkSectionRules(
    filePath: string,
    sectionRules: DocChecklistSectionRule[],
    content: string,
    issues: DocVerificationIssue[]
  ): void {
    for (const rule of sectionRules) {
      const section = this.extractSection(content, rule.heading);
      if (!section) {
        issues.push({
          file: filePath,
          message: `Missing section required by sectionRules: ${rule.heading}`
        });
        continue;
      }

      for (const snippet of rule.requiredSnippets ?? []) {
        if (!section.includes(snippet)) {
          issues.push({
            file: filePath,
            message: `Section ${rule.heading} is missing required snippet: ${snippet}`
          });
        }
      }

      for (const pattern of rule.requiredPatterns ?? []) {
        const regex = this.compilePattern(pattern);
        if (!regex.test(section)) {
          issues.push({
            file: filePath,
            message: `Section ${rule.heading} is missing required pattern: ${pattern}`
          });
        }
      }

      for (const pattern of rule.forbiddenPatterns ?? []) {
        const regex = this.compilePattern(pattern);
        if (regex.test(section)) {
          issues.push({
            file: filePath,
            message: `Section ${rule.heading} contains forbidden pattern: ${pattern}`
          });
        }
      }
    }
  }

  private async verifyRepositoryProfile(
    rootDir: string,
    profile: LoadedOSpecLiteProfile,
    issues: DocVerificationIssue[],
    warnings: DocVerificationIssue[]
  ): Promise<RepositoryVerificationCheck[]> {
    if (!profile.id.startsWith("unity-tolua-")) {
      return [];
    }

    const checks: RepositoryVerificationCheck[] = [];
    for (const requiredPath of profile.requiredRepoPaths ?? []) {
      const exists = await this.repo.exists(path.join(rootDir, requiredPath));
      const check: RepositoryVerificationCheck = {
        id: "required-repo-path",
        status: exists ? "pass" : "fail",
        path: requiredPath,
        message: exists
          ? `Required profile anchor exists: ${requiredPath}`
          : `Required profile anchor is missing: ${requiredPath}`
      };
      checks.push(check);
      if (!exists) {
        issues.push({
          file: requiredPath,
          message: check.message
        });
      }
    }

    const luaFiles = await this.findRepoFiles(rootDir, (relativePath) =>
      relativePath.toLowerCase().endsWith(".lua")
    );
    checks.push({
      id: "lua-entrypoints",
      status: luaFiles.length > 0 ? "pass" : "fail",
      message:
        luaFiles.length > 0
          ? `Found ${luaFiles.length} Lua file(s) for profile verification.`
          : "No Lua files found in a Unity/ToLua profile repository."
    });
    if (luaFiles.length === 0) {
      issues.push({
        file: ".",
        message: "Unity/ToLua profile verification requires at least one Lua file."
      });
    }

    const toluaSignals = await this.findRepoFiles(rootDir, (relativePath) =>
      /tolua|luaframework/i.test(relativePath)
    );
    if (toluaSignals.length === 0) {
      const warning = {
        file: ".",
        message: "No ToLua or LuaFramework path signal was found; confirm this profile matches the repository."
      };
      warnings.push(warning);
      checks.push({
        id: "tolua-signal",
        status: "warn",
        message: warning.message
      });
    } else {
      checks.push({
        id: "tolua-signal",
        status: "pass",
        path: toluaSignals[0],
        message: `Found ToLua/LuaFramework signal: ${toluaSignals[0]}`
      });
    }

    const annotatedLuaFiles = await this.countAnnotatedLuaFiles(rootDir, luaFiles);
    if (luaFiles.length > 0 && annotatedLuaFiles === 0) {
      const warning = {
        file: ".",
        message:
          "No EmmyLua annotations were found in Lua files; classes and vague multi-parameter functions should use annotations."
      };
      warnings.push(warning);
      checks.push({
        id: "emmylua-signal",
        status: "warn",
        message: warning.message
      });
    } else if (luaFiles.length > 0) {
      checks.push({
        id: "emmylua-signal",
        status: "pass",
        message: `Found EmmyLua annotations in ${annotatedLuaFiles} Lua file(s).`
      });
    }

    return checks;
  }

  private async findRepoFiles(
    rootDir: string,
    predicate: (relativePath: string) => boolean
  ): Promise<string[]> {
    const result: string[] = [];
    await this.walkRepo(rootDir, ".", predicate, result);
    return result;
  }

  private async walkRepo(
    rootDir: string,
    relativeDir: string,
    predicate: (relativePath: string) => boolean,
    result: string[]
  ): Promise<void> {
    const absoluteDir = path.join(rootDir, relativeDir);
    if (!(await this.repo.exists(absoluteDir))) {
      return;
    }

    const entries = await this.repo.listDirents(absoluteDir);
    for (const entry of entries) {
      const relativePath = relativeDir === "." ? entry.name : `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (this.shouldSkipDirectory(entry.name)) {
          continue;
        }
        await this.walkRepo(rootDir, relativePath, predicate, result);
        continue;
      }
      if (entry.isFile() && predicate(relativePath)) {
        result.push(relativePath);
      }
    }
  }

  private shouldSkipDirectory(name: string): boolean {
    return [
      ".git",
      ".oslite",
      "Library",
      "Temp",
      "Obj",
      "Build",
      "Builds",
      "node_modules"
    ].includes(name);
  }

  private async countAnnotatedLuaFiles(rootDir: string, luaFiles: string[]): Promise<number> {
    let count = 0;
    for (const luaFile of luaFiles) {
      const content = await this.repo.readText(path.join(rootDir, luaFile));
      if (/---@(?:class|param|return|field|type)\b/.test(content)) {
        count += 1;
      }
    }
    return count;
  }

  private extractSection(content: string, heading: string): string | null {
    const headingRegex = new RegExp(
      `^(#{2,6})\\s+${this.escapeRegex(heading)}\\s*$`,
      "m"
    );
    const match = headingRegex.exec(content);
    if (!match || match.index === undefined) {
      return null;
    }

    const level = match[1].length;
    const sectionStart = match.index + match[0].length;
    const rest = content.slice(sectionStart);
    const nextHeadingRegex = new RegExp(`^#{1,${level}}\\s+`, "m");
    const nextMatch = nextHeadingRegex.exec(rest);
    const sectionEnd =
      nextMatch && nextMatch.index !== undefined
        ? sectionStart + nextMatch.index
        : content.length;

    return content.slice(match.index, sectionEnd).trim();
  }

  private extractLabeledBlock(
    section: string,
    label: string,
    labels: string[]
  ): { content: string; paths: string[] } | null {
    const currentIndex = labels.indexOf(label);
    if (currentIndex < 0) {
      return null;
    }

    const nextLabels = labels.slice(currentIndex + 1);
    const nextPattern =
      nextLabels.length > 0
        ? `(?=^(${nextLabels.map((item) => this.escapeRegex(item)).join("|")})[:：])`
        : "(?=$)";
    const regex = new RegExp(
      `^${this.escapeRegex(label)}[:：]\\s*\\n([\\s\\S]*?)${nextPattern}`,
      "m"
    );
    const match = regex.exec(section);
    if (!match) {
      return null;
    }

    const content = match[1].trim();
    const paths = Array.from(content.matchAll(/`([^`\r\n]+)`/g)).map((item) => item[1]);
    return { content, paths };
  }

  private compilePattern(pattern: string): RegExp {
    const flags = new Set<string>(["m"]);
    let source = pattern;

    const inlineFlags = source.match(/^\(\?([ims]+)\)/);
    if (inlineFlags) {
      source = source.slice(inlineFlags[0].length);
      for (const flag of inlineFlags[1]) {
        flags.add(flag);
      }
    }

    return new RegExp(source, [...flags].join(""));
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
