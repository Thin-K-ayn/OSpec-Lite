import * as path from "node:path";
import { EntryPointItem, LanguageInsight } from "../../core/ospec-lite-types";
import { FileRepo } from "../../fs/file-repo";
import {
  ALWAYS_IGNORED_DIRECTORIES,
  GENERATED_DIRECTORY_NAMES,
  safeReadFile,
  shouldSkipDirectory
} from "./scan-shared";

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

const MAX_LANGUAGE_FILES = 4000;
const MAX_LANGUAGE_DEPTH = 8;
const MAX_GENERATED_DIR_DEPTH = 5;

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

export class LanguageAnalyzer {
  constructor(private readonly repo: FileRepo) {}

  async collectPrimaryLanguages(rootDir: string): Promise<LanguageInsight[]> {
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
          if (shouldSkipDirectory(entry.name, true)) {
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

  async collectGeneratedDirectories(rootDir: string): Promise<string[]> {
    const results = new Set<string>();
    await this.walkGeneratedDirectories(rootDir, 0, rootDir, results);
    return Array.from(results).sort((left, right) => left.localeCompare(right));
  }

  private async walkGeneratedDirectories(
    currentPath: string,
    currentDepth: number,
    rootDir: string,
    results: Set<string>
  ): Promise<void> {
    if (currentDepth > MAX_GENERATED_DIR_DEPTH) {
      return;
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
      const normalized = entry.name.toLowerCase();

      if (GENERATED_DIRECTORY_NAMES.has(normalized)) {
        results.add(path.relative(rootDir, nextPath).replace(/\\/g, "/"));
        continue;
      }

      await this.walkGeneratedDirectories(nextPath, currentDepth + 1, rootDir, results);
    }
  }

  async findLikelyEntrypoints(rootDir: string): Promise<EntryPointItem[]> {
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

      const content = await safeReadFile(this.repo, filePath);
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
      if (entry.isDirectory() && shouldSkipDirectory(entry.name, true)) {
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
}
