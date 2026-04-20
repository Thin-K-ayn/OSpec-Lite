import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import * as path from "node:path";

export class FileRepo {
  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(targetPath: string): Promise<void> {
    await fs.mkdir(targetPath, { recursive: true });
  }

  async readText(targetPath: string): Promise<string> {
    return fs.readFile(targetPath, "utf8");
  }

  async writeText(targetPath: string, content: string): Promise<void> {
    await this.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, content, "utf8");
  }

  async writeTextIfMissing(targetPath: string, content: string): Promise<void> {
    if (await this.exists(targetPath)) {
      return;
    }
    await this.writeText(targetPath, content);
  }

  async readJson<T>(targetPath: string): Promise<T> {
    const content = await this.readText(targetPath);
    return JSON.parse(content) as T;
  }

  async writeJson(targetPath: string, value: unknown): Promise<void> {
    await this.writeText(targetPath, `${JSON.stringify(value, null, 2)}\n`);
  }

  async copyDir(fromPath: string, toPath: string): Promise<void> {
    await this.ensureDir(path.dirname(toPath));
    await fs.cp(fromPath, toPath, {
      recursive: true,
      force: true
    });
  }

  async listDirEntries(targetPath: string): Promise<string[]> {
    const entries = await fs.readdir(targetPath);
    return entries.sort((left, right) => left.localeCompare(right));
  }

  async listDirents(targetPath: string): Promise<Dirent[]> {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    return entries.sort((left, right) => left.name.localeCompare(right.name));
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    await this.ensureDir(path.dirname(toPath));
    await fs.rename(fromPath, toPath);
  }

  async remove(targetPath: string): Promise<void> {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}
