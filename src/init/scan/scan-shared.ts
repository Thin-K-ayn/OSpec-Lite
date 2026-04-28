import {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START
} from "../../core/ospec-lite-schema";
import { FileRepo } from "../../fs/file-repo";

export const ALWAYS_IGNORED_DIRECTORIES = new Set([".git", ".oslite", "node_modules"]);
export const ALWAYS_IGNORED_TOP_LEVEL_FILES = new Set(["agents.md", "claude.md"]);
export const GENERATED_DIRECTORY_NAMES = new Set([
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

export function shouldSkipTopLevelFile(name: string, isDirectory: boolean): boolean {
  return !isDirectory && ALWAYS_IGNORED_TOP_LEVEL_FILES.has(name.toLowerCase());
}

export function shouldSkipDirectoryEntry(name: string, isDirectory: boolean): boolean {
  return isDirectory && ALWAYS_IGNORED_DIRECTORIES.has(name.toLowerCase());
}

export function shouldSkipDirectory(name: string, ignoreGenerated: boolean): boolean {
  const normalized = name.toLowerCase();
  if (ALWAYS_IGNORED_DIRECTORIES.has(normalized)) {
    return true;
  }

  if (ignoreGenerated && GENERATED_DIRECTORY_NAMES.has(normalized)) {
    return true;
  }

  return false;
}

export async function safeReadFile(repo: FileRepo, filePath: string): Promise<string> {
  try {
    const content = await repo.readText(filePath);
    return content.slice(0, 64000);
  } catch {
    return "";
  }
}

export function stripManagedInstructionSections(content: string): string {
  return stripManagedSection(
    stripManagedSection(content, AGENTS_MANAGED_START, AGENTS_MANAGED_END),
    CLAUDE_MANAGED_START,
    CLAUDE_MANAGED_END
  );
}

export function stripManagedSection(
  content: string,
  startMarker: string,
  endMarker: string
): string {
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

export function parseHeading(line: string): { level: number; title: string } | null {
  const match = /^\s*(#{1,6})\s+(.*?)\s*$/.exec(line);
  if (!match) {
    return null;
  }

  return {
    level: match[1].length,
    title: match[2].trim()
  };
}

export function collectBulletLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}
