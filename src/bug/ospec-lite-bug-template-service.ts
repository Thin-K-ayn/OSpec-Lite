import * as fs from "node:fs";
import * as path from "node:path";

export class BugTemplateService {
  private readonly templateCache = new Map<string, string>();

  constructor(
    private readonly templateRoot = path.join(__dirname, "templates")
  ) {}

  renderQueue(): string {
    return this.renderTemplate("active-bugs.md", {});
  }

  renderPlaybook(): string {
    return this.renderTemplate("bug-playbook.md", {});
  }

  renderQueueItem(id: string, title: string): string {
    const now = new Date().toISOString();
    return [
      `## ${id}: ${title}`,
      "",
      "- Status: reported",
      `- Created: ${now}`,
      `- Updated: ${now}`,
      `- Title: ${title}`,
      "- Affects: [TODO: list the file, module, or flow this bug touches]",
      "- Summary: [TODO: describe the bug in one or two sentences]",
      "- Actual: [TODO: describe what is actually happening]",
      "- Expected: [TODO: describe what should happen instead]",
      "- Repro: [TODO: record at least one reproduction step]",
      "- Investigation: [TODO: record the strongest investigation finding so far]",
      "- Cause: [TODO: describe the most likely root cause or uncertainty]",
      "- Fix Summary: [TODO: summarize the implemented bug fix]",
      "- File: [TODO: path/to/file.ext - explain why it changed]",
      "- Reason: [TODO: describe why the fix addresses the root cause]",
      "- Command: [TODO: replace with the command you ran]",
      "- Result: [TODO: replace with the outcome and key evidence]",
      "- Validation: [TODO: describe the manual validation or explain why it was not needed]",
      "- Risk: none",
      "- Gap: [TODO: describe the mistaken assumption the coding agent made]",
      "- Reality: [TODO: describe the actual logic in the codebase]",
      "- Check First: [TODO: record the repo path future agents should inspect first]",
      "- Remember: [TODO: write the reusable reminder that should prevent the same mistake next time]",
      ""
    ].join("\n");
  }

  renderMemoryIndex(
    currentFile: string | null,
    files: Array<{ path: string; entryCount: number; bytes: number }>
  ): string {
    return [
      "# Bug Memory",
      "",
      "This index points to durable bug-fix lessons that survived queue apply and memory compaction.",
      "",
      "- Read the current memory file first.",
      "- If the current file is not enough, continue through the older segment files listed below.",
      "- Compaction re-checks stored lessons against their `Check First` paths and removes stale entries.",
      "",
      "## Current Write File",
      "",
      currentFile ? `- File: \`${currentFile}\`` : "- File: (not created yet)",
      "",
      "## Memory Files",
      "",
      ...(files.length === 0
        ? ["- File: (none yet)"]
        : files.map(
            (file) => `- File: \`${file.path}\` (${file.entryCount} entries, ${file.bytes} bytes)`
          )),
      ""
    ].join("\n");
  }

  renderMemorySegment(filePath: string, entries: string[]): string {
    return [
      `# Bug Memory Segment`,
      "",
      `- File: \`${filePath}\``,
      "- Entries here came from `oslite bug apply`.",
      "- Compaction may remove stale entries or merge small segments.",
      "",
      ...(entries.length === 0 ? ["_No durable bug lessons have been recorded in this segment yet._", ""] : [
        entries.join("\n\n"),
        ""
      ])
    ].join("\n");
  }

  private renderTemplate(
    templateName: string,
    values: Record<string, string>
  ): string {
    const template = this.loadTemplate(templateName);
    return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => {
      return values[key] ?? "";
    });
  }

  private loadTemplate(templateName: string): string {
    const cached = this.templateCache.get(templateName);
    if (cached) {
      return cached;
    }

    const templatePath = path.join(this.templateRoot, templateName);
    const template = fs.readFileSync(templatePath, "utf8");
    this.templateCache.set(templateName, template);
    return template;
  }
}
