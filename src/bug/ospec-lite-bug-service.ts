import * as path from "node:path";
import {
  BUG_ACTIVE_BUGS_PATH,
  BUG_INDEX_PATH,
  BUG_MEMORY_DIR,
  BUG_MEMORY_PATH,
  BUG_PLAYBOOK_PATH,
  OSPEC_LITE_DIR
} from "../core/ospec-lite-schema";
import {
  BugIndex,
  BugKnowledgeFileRecord,
  BugRecord,
  BugStatus,
  BugValidationPhase
} from "../core/ospec-lite-types";
import {
  BugValidationError,
  NotInitializedError,
  OSpecLiteError
} from "../core/ospec-lite-errors";
import { FileRepo } from "../fs/file-repo";
import { StatusService } from "../status/ospec-lite-status-service";
import { BugTemplateService } from "./ospec-lite-bug-template-service";

const KNOWLEDGE_FILE_PREFIX = "memory-";
const TEMPLATE_PLACEHOLDER_PATTERNS = [
  /\[TODO:[^\]]+\]/,
  /\breplace with the command you ran\b/i,
  /\breplace with the outcome and key evidence\b/i
];

interface BugServiceOptions {
  knowledgeFileMaxBytes?: number;
  knowledgeFileMinBytes?: number;
}

interface BugQueueSection {
  id: string;
  title: string;
  content: string;
}

interface BugKnowledgeEntry {
  id: string;
  title: string;
  content: string;
  gap: string;
  reality: string;
  checkFirst: string;
  remember: string;
}

export class BugService {
  private readonly knowledgeFileMaxBytes: number;
  private readonly knowledgeFileMinBytes: number;

  constructor(
    private readonly repo: FileRepo,
    private readonly statusService: StatusService,
    private readonly templates = new BugTemplateService(),
    options: BugServiceOptions = {}
  ) {
    this.knowledgeFileMaxBytes = options.knowledgeFileMaxBytes ?? 16 * 1024;
    this.knowledgeFileMinBytes = Math.min(
      options.knowledgeFileMinBytes ?? 4 * 1024,
      this.knowledgeFileMaxBytes
    );
  }

  async ensureSupportArtifacts(rootDir: string): Promise<void> {
    await this.repo.ensureDir(path.join(rootDir, OSPEC_LITE_DIR, "bugs"));
    await this.repo.ensureDir(path.join(rootDir, BUG_MEMORY_DIR));
    await this.repo.writeTextIfMissing(
      path.join(rootDir, BUG_PLAYBOOK_PATH),
      this.templates.renderPlaybook()
    );
    await this.repo.writeTextIfMissing(
      path.join(rootDir, BUG_ACTIVE_BUGS_PATH),
      this.templates.renderQueue()
    );

    let index = (await this.tryReadBugIndex(rootDir)) ?? this.createEmptyIndex();

    if (
      !index.knowledgeFiles.some((file) => file.path === index.currentKnowledgeFile)
    ) {
      index.knowledgeFiles.push(
        this.createKnowledgeFileRecord(index.currentKnowledgeFile, 0, 0)
      );
    }

    const currentMemoryPath = path.join(rootDir, index.currentKnowledgeFile);
    if (!(await this.repo.exists(currentMemoryPath))) {
      await this.repo.writeText(
        currentMemoryPath,
        this.templates.renderMemorySegment(index.currentKnowledgeFile, [])
      );
    }

    index = await this.refreshKnowledgeFileMetadata(rootDir, index);
    await this.repo.writeJson(path.join(rootDir, BUG_INDEX_PATH), index);
    await this.repo.writeText(
      path.join(rootDir, BUG_MEMORY_PATH),
      this.templates.renderMemoryIndex(index.currentKnowledgeFile, index.knowledgeFiles)
    );
  }

  async newBug(rootDir: string, title: string): Promise<string> {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      throw new OSpecLiteError("Missing bug title.");
    }

    await this.ensureInitialized(rootDir);
    await this.ensureSupportArtifacts(rootDir);

    const queuePath = path.join(rootDir, BUG_ACTIVE_BUGS_PATH);
    const queue = await this.repo.readText(queuePath);
    const index = await this.readBugIndex(rootDir);
    const bugId = this.formatBugId(index.nextBugNumber);
    const now = new Date().toISOString();
    const record: BugRecord = {
      version: 1,
      id: bugId,
      title: trimmedTitle,
      status: "reported",
      createdAt: now,
      updatedAt: now,
      source: {
        type: "manual",
        id: ""
      },
      affects: [],
      owner: "",
      notes: ""
    };

    index.items.push(record);
    index.nextBugNumber += 1;

    const nextQueue = `${queue.trimEnd()}\n\n${this.templates.renderQueueItem(bugId, trimmedTitle)}`;
    await this.repo.writeText(queuePath, `${nextQueue.trimEnd()}\n`);
    await this.repo.writeJson(path.join(rootDir, BUG_INDEX_PATH), index);

    return bugId;
  }

  async markFixed(rootDir: string, bugId: string): Promise<void> {
    await this.ensureInitialized(rootDir);
    await this.ensureSupportArtifacts(rootDir);

    const index = await this.readBugIndex(rootDir);
    const record = this.findBugRecord(index, bugId);
    this.ensureAllowedCurrentStatus(record, ["reported"], "fixed");

    const queuePath = path.join(rootDir, BUG_ACTIVE_BUGS_PATH);
    const queue = await this.repo.readText(queuePath);
    const parsed = this.parseQueue(queue);
    const section = this.findQueueSection(parsed.sections, bugId);
    await this.validateTransitionRequirements(rootDir, section.content, "fix");

    record.status = "fixed";
    record.updatedAt = new Date().toISOString();
    record.affects = this.extractListValues(section.content, "Affects");

    const updatedSections = parsed.sections.map((candidate) =>
      candidate.id === bugId
        ? {
            ...candidate,
            content: this.updateQueueSection(candidate.content, "fixed", record.updatedAt)
          }
        : candidate
    );

    await this.repo.writeText(queuePath, this.renderQueue(parsed.preamble, updatedSections));
    await this.repo.writeJson(path.join(rootDir, BUG_INDEX_PATH), index);
  }

  async apply(rootDir: string, bugId: string): Promise<string> {
    await this.ensureInitialized(rootDir);
    await this.ensureSupportArtifacts(rootDir);

    const index = await this.readBugIndex(rootDir);
    const record = this.findBugRecord(index, bugId);
    this.ensureAllowedCurrentStatus(record, ["fixed"], "applied");

    const queuePath = path.join(rootDir, BUG_ACTIVE_BUGS_PATH);
    const queue = await this.repo.readText(queuePath);
    const parsed = this.parseQueue(queue);
    const section = this.findQueueSection(parsed.sections, bugId);
    await this.validateTransitionRequirements(rootDir, section.content, "apply");

    const appliedAt = new Date().toISOString();
    const memoryEntry = this.renderMemoryEntry(record, section.content, appliedAt);
    await this.appendToCurrentKnowledgeFile(rootDir, index, memoryEntry);

    record.status = "applied";
    record.appliedAt = appliedAt;
    record.updatedAt = appliedAt;
    record.affects = this.extractListValues(section.content, "Affects");

    const remainingSections = parsed.sections.filter((candidate) => candidate.id !== bugId);
    await this.repo.writeText(queuePath, this.renderQueue(parsed.preamble, remainingSections));

    let nextIndex = await this.refreshKnowledgeFileMetadata(rootDir, index);
    if (this.shouldCompact(nextIndex)) {
      nextIndex = await this.compactKnowledgeFiles(rootDir, nextIndex);
    } else {
      await this.repo.writeText(
        path.join(rootDir, BUG_MEMORY_PATH),
        this.templates.renderMemoryIndex(nextIndex.currentKnowledgeFile, nextIndex.knowledgeFiles)
      );
    }

    await this.repo.writeJson(path.join(rootDir, BUG_INDEX_PATH), nextIndex);
    return path.join(rootDir, nextIndex.currentKnowledgeFile);
  }

  private createEmptyIndex(): BugIndex {
    const currentKnowledgeFile = this.buildKnowledgeFilePath(1);
    return {
      version: 1,
      nextBugNumber: 1,
      nextKnowledgeFileNumber: 2,
      currentKnowledgeFile,
      knowledgeFileMaxBytes: this.knowledgeFileMaxBytes,
      knowledgeFileMinBytes: this.knowledgeFileMinBytes,
      items: [],
      knowledgeFiles: [
        this.createKnowledgeFileRecord(currentKnowledgeFile, 0, 0)
      ]
    };
  }

  private createKnowledgeFileRecord(
    filePath: string,
    bytes: number,
    entryCount: number
  ): BugKnowledgeFileRecord {
    return {
      path: filePath,
      bytes,
      entryCount,
      updatedAt: new Date().toISOString()
    };
  }

  private async tryReadBugIndex(rootDir: string): Promise<BugIndex | null> {
    const indexPath = path.join(rootDir, BUG_INDEX_PATH);
    if (!(await this.repo.exists(indexPath))) {
      return null;
    }

    try {
      const index = await this.repo.readJson<BugIndex>(indexPath);
      return {
        ...index,
        knowledgeFileMaxBytes: index.knowledgeFileMaxBytes ?? this.knowledgeFileMaxBytes,
        knowledgeFileMinBytes: Math.min(
          index.knowledgeFileMinBytes ?? this.knowledgeFileMinBytes,
          index.knowledgeFileMaxBytes ?? this.knowledgeFileMaxBytes
        ),
        items: index.items ?? [],
        knowledgeFiles: index.knowledgeFiles ?? []
      };
    } catch {
      return null;
    }
  }

  private async readBugIndex(rootDir: string): Promise<BugIndex> {
    const index = await this.tryReadBugIndex(rootDir);
    if (!index) {
      throw new OSpecLiteError(`Missing bug index: ${rootDir}`);
    }
    return index;
  }

  private formatBugId(number: number): string {
    return `bug-${String(number).padStart(4, "0")}`;
  }

  private buildKnowledgeFilePath(number: number): string {
    return `${BUG_MEMORY_DIR}/${KNOWLEDGE_FILE_PREFIX}${String(number).padStart(4, "0")}.md`;
  }

  private parseQueue(content: string): {
    preamble: string;
    sections: BugQueueSection[];
  } {
    const matches = [...content.matchAll(/^##\s+(bug-\d{4}):\s+(.+)$/gm)];
    if (matches.length === 0) {
      return {
        preamble: content.trimEnd(),
        sections: []
      };
    }

    const sections: BugQueueSection[] = matches.map((match, index) => {
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? content.length;
      return {
        id: match[1],
        title: match[2].trim(),
        content: content.slice(start, end).trim()
      };
    });

    return {
      preamble: content.slice(0, matches[0].index ?? 0).trimEnd(),
      sections
    };
  }

  private renderQueue(preamble: string, sections: BugQueueSection[]): string {
    const parts = [preamble.trimEnd(), ...sections.map((section) => section.content.trim())]
      .filter((value) => value.length > 0);
    return `${parts.join("\n\n")}\n`;
  }

  private findQueueSection(sections: BugQueueSection[], bugId: string): BugQueueSection {
    const section = sections.find((candidate) => candidate.id === bugId);
    if (!section) {
      throw new OSpecLiteError(`Cannot find bug in queue: ${bugId}`);
    }
    return section;
  }

  private findBugRecord(index: BugIndex, bugId: string): BugRecord {
    const record = index.items.find((candidate) => candidate.id === bugId);
    if (!record) {
      throw new OSpecLiteError(`Cannot find bug: ${bugId}`);
    }
    return record;
  }

  private updateQueueSection(
    content: string,
    nextStatus: BugStatus,
    updatedAt: string
  ): string {
    return this.replaceLabeledValue(
      this.replaceLabeledValue(content, "Status", nextStatus),
      "Updated",
      updatedAt
    );
  }

  private replaceLabeledValue(content: string, label: string, value: string): string {
    const regex = new RegExp(`(^- ${this.escapeRegex(label)}:\\s*).+$`, "m");
    if (!regex.test(content)) {
      throw new OSpecLiteError(`Missing ${label} in active bug section.`);
    }
    return content.replace(regex, `$1${value}`);
  }

  private async validateTransitionRequirements(
    rootDir: string,
    section: string,
    phase: BugValidationPhase
  ): Promise<void> {
    const issues: string[] = [];
    const requiredFixLabels = [
      "Affects",
      "Summary",
      "Actual",
      "Expected",
      "Repro",
      "Investigation",
      "Cause",
      "Fix Summary",
      "File",
      "Reason"
    ];

    for (const label of requiredFixLabels) {
      if (!this.hasMeaningfulEntries(this.extractLabeledValues(section, label), true)) {
        issues.push(`active bug entry must include a real \`${label}\` entry.`);
      }
    }

    if (phase === "apply") {
      for (const label of ["Command", "Result", "Validation", "Gap", "Reality", "Check First", "Remember"]) {
        if (!this.hasMeaningfulEntries(this.extractLabeledValues(section, label), true)) {
          issues.push(`active bug entry must include a real \`${label}\` entry.`);
        }
      }

      const checkFirstValues = this.extractLabeledValues(section, "Check First");
      const checkFirstPaths = this.extractRepoPaths(checkFirstValues.join(", "));
      if (checkFirstPaths.length === 0) {
        issues.push("active bug entry must point `Check First` at at least one repo path.");
      } else {
        const hasExistingPath = await this.someRepoPathExists(rootDir, checkFirstPaths);
        if (!hasExistingPath) {
          issues.push("active bug entry must point `Check First` at an existing repo path.");
        }
      }
    }

    if (issues.length > 0) {
      const bugId = this.readBugId(section);
      throw new BugValidationError(bugId, phase, issues);
    }
  }

  private readBugId(section: string): string {
    const match = /^##\s+(bug-\d{4}):/m.exec(section);
    if (!match) {
      throw new OSpecLiteError("Missing bug id in active bug section.");
    }
    return match[1];
  }

  private extractLabeledValues(content: string, label: string): string[] {
    const regex = new RegExp(`^- ${this.escapeRegex(label)}:\\s*(.+)$`, "gm");
    const values: string[] = [];
    let match: RegExpExecArray | null = regex.exec(content);

    while (match) {
      values.push(match[1].trim());
      match = regex.exec(content);
    }

    return values;
  }

  private extractListValues(content: string, label: string): string[] {
    return this.extractLabeledValues(content, label)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => this.isMeaningfulValue(value, true));
  }

  private hasMeaningfulEntries(values: string[], rejectBarePlaceholders = false): boolean {
    return values.some((value) => this.isMeaningfulValue(value, rejectBarePlaceholders));
  }

  private isMeaningfulValue(value: string, rejectBarePlaceholders: boolean): boolean {
    const trimmed = value.trim();
    if (trimmed.length === 0 || this.containsTemplatePlaceholders(trimmed)) {
      return false;
    }

    if (!rejectBarePlaceholders) {
      return true;
    }

    return !/^(?:none|n\/a|na)$/i.test(trimmed);
  }

  private containsTemplatePlaceholders(content: string): boolean {
    return TEMPLATE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content));
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private renderMemoryEntry(record: BugRecord, section: string, appliedAt: string): string {
    const commands = this.extractLabeledValues(section, "Command")
      .filter((value) => this.isMeaningfulValue(value, true))
      .map((value) => `- Command: ${value}`);
    const results = this.extractLabeledValues(section, "Result")
      .filter((value) => this.isMeaningfulValue(value, true))
      .map((value) => `- Result: ${value}`);
    const gap = this.getFirstRequiredValue(section, "Gap");
    const reality = this.getFirstRequiredValue(section, "Reality");
    const checkFirst = this.getFirstRequiredValue(section, "Check First");
    const remember = this.getFirstRequiredValue(section, "Remember");

    return [
      `## ${record.id}: ${record.title}`,
      "",
      `- Applied: ${appliedAt}`,
      `- Gap: ${gap}`,
      `- Reality: ${reality}`,
      `- Check First: ${checkFirst}`,
      `- Remember: ${remember}`,
      ...commands,
      ...results,
      ""
    ].join("\n");
  }

  private getFirstRequiredValue(content: string, label: string): string {
    const values = this.extractLabeledValues(content, label);
    const value = values.find((candidate) => this.isMeaningfulValue(candidate, true));
    if (!value) {
      throw new OSpecLiteError(`Missing required ${label} entry.`);
    }
    return value;
  }

  private async appendToCurrentKnowledgeFile(
    rootDir: string,
    index: BugIndex,
    entry: string
  ): Promise<void> {
    const currentFilePath = path.join(rootDir, index.currentKnowledgeFile);
    const existing =
      (await this.repo.exists(currentFilePath))
        ? await this.repo.readText(currentFilePath)
        : this.templates.renderMemorySegment(index.currentKnowledgeFile, []);
    const entries = this.parseKnowledgeEntries(existing).map((item) => item.content);
    entries.push(entry.trim());
    const nextContent = this.templates.renderMemorySegment(index.currentKnowledgeFile, entries);
    await this.repo.writeText(currentFilePath, nextContent);
  }

  private shouldCompact(index: BugIndex): boolean {
    const current = index.knowledgeFiles.find(
      (file) => file.path === index.currentKnowledgeFile
    );
    return Boolean(current && current.bytes > index.knowledgeFileMaxBytes);
  }

  private async compactKnowledgeFiles(
    rootDir: string,
    index: BugIndex
  ): Promise<BugIndex> {
    const allEntries: BugKnowledgeEntry[] = [];
    for (const file of index.knowledgeFiles) {
      const filePath = path.join(rootDir, file.path);
      if (!(await this.repo.exists(filePath))) {
        continue;
      }

      const content = await this.repo.readText(filePath);
      const entries = this.parseKnowledgeEntries(content);
      for (const entry of entries) {
        if (await this.knowledgeEntryStillRelevant(rootDir, entry)) {
          allEntries.push(entry);
        }
      }
    }

    const packedContents = this.packKnowledgeEntries(
      allEntries,
      index.knowledgeFileMaxBytes,
      index.knowledgeFileMinBytes
    );
    const nextFiles = packedContents.map((content, offset) => {
      const filePath = this.buildKnowledgeFilePath(offset + 1);
      return {
        path: filePath,
        content,
        entryCount: this.parseKnowledgeEntries(content).length,
        bytes: Buffer.byteLength(content, "utf8")
      };
    });

    if (nextFiles.length === 0) {
      const filePath = this.buildKnowledgeFilePath(1);
      nextFiles.push({
        path: filePath,
        content: this.templates.renderMemorySegment(filePath, []),
        entryCount: 0,
        bytes: Buffer.byteLength(this.templates.renderMemorySegment(filePath, []), "utf8")
      });
    }

    const lastFile = nextFiles[nextFiles.length - 1];
    if (lastFile && lastFile.bytes > index.knowledgeFileMaxBytes) {
      const filePath = this.buildKnowledgeFilePath(nextFiles.length + 1);
      const content = this.templates.renderMemorySegment(filePath, []);
      nextFiles.push({
        path: filePath,
        content,
        entryCount: 0,
        bytes: Buffer.byteLength(content, "utf8")
      });
    }

    const existingFiles = await this.repo.listDirents(path.join(rootDir, BUG_MEMORY_DIR));
    for (const entry of existingFiles) {
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = `${BUG_MEMORY_DIR}/${entry.name}`;
      if (!nextFiles.some((candidate) => candidate.path === relativePath)) {
        await this.repo.remove(path.join(rootDir, relativePath));
      }
    }

    for (const file of nextFiles) {
      await this.repo.writeText(path.join(rootDir, file.path), file.content);
    }

    const refreshedIndex: BugIndex = {
      ...index,
      currentKnowledgeFile:
        nextFiles[nextFiles.length - 1]?.path ?? this.buildKnowledgeFilePath(1),
      nextKnowledgeFileNumber: nextFiles.length + 1,
      knowledgeFiles: nextFiles.map((file) =>
        this.createKnowledgeFileRecord(file.path, file.bytes, file.entryCount)
      )
    };

    await this.repo.writeText(
      path.join(rootDir, BUG_MEMORY_PATH),
      this.templates.renderMemoryIndex(
        refreshedIndex.currentKnowledgeFile,
        refreshedIndex.knowledgeFiles
      )
    );

    return refreshedIndex;
  }

  private parseKnowledgeEntries(content: string): BugKnowledgeEntry[] {
    const matches = [...content.matchAll(/^##\s+(bug-\d{4}):\s+(.+)$/gm)];
    return matches.map((match, index) => {
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? content.length;
      const entryContent = content.slice(start, end).trim();
      return {
        id: match[1],
        title: match[2].trim(),
        content: entryContent,
        gap: this.getFirstRequiredValue(entryContent, "Gap"),
        reality: this.getFirstRequiredValue(entryContent, "Reality"),
        checkFirst: this.getFirstRequiredValue(entryContent, "Check First"),
        remember: this.getFirstRequiredValue(entryContent, "Remember")
      };
    });
  }

  private packKnowledgeEntries(
    entries: BugKnowledgeEntry[],
    maxBytes: number,
    minBytes: number
  ): string[] {
    if (entries.length === 0) {
      return [];
    }

    const fileEntries: string[][] = [];
    let currentEntries: string[] = [];

    for (const entry of entries) {
      const nextEntries = [...currentEntries, entry.content];
      const trialPath = this.buildKnowledgeFilePath(fileEntries.length + 1);
      const trialContent = this.templates.renderMemorySegment(trialPath, nextEntries);
      if (
        currentEntries.length > 0 &&
        Buffer.byteLength(trialContent, "utf8") > maxBytes
      ) {
        fileEntries.push(currentEntries);
        currentEntries = [entry.content];
      } else {
        currentEntries = nextEntries;
      }
    }

    if (currentEntries.length > 0) {
      fileEntries.push(currentEntries);
    }

    let merged = true;
    while (merged) {
      merged = false;
      for (let index = 0; index < fileEntries.length - 1; index += 1) {
        const currentContent = this.templates.renderMemorySegment(
          this.buildKnowledgeFilePath(index + 1),
          fileEntries[index]
        );
        if (Buffer.byteLength(currentContent, "utf8") >= minBytes) {
          continue;
        }

        const combinedEntries = [...fileEntries[index], ...fileEntries[index + 1]];
        const combinedContent = this.templates.renderMemorySegment(
          this.buildKnowledgeFilePath(index + 1),
          combinedEntries
        );
        if (Buffer.byteLength(combinedContent, "utf8") > maxBytes) {
          continue;
        }

        fileEntries.splice(index, 2, combinedEntries);
        merged = true;
        break;
      }
    }

    return fileEntries.map((items, index) =>
      this.templates.renderMemorySegment(this.buildKnowledgeFilePath(index + 1), items)
    );
  }

  private async knowledgeEntryStillRelevant(
    rootDir: string,
    entry: BugKnowledgeEntry
  ): Promise<boolean> {
    const repoPaths = this.extractRepoPaths(entry.checkFirst);
    if (repoPaths.length === 0) {
      return true;
    }

    const existingPaths: string[] = [];
    for (const repoPath of repoPaths) {
      if (await this.repo.exists(path.join(rootDir, repoPath))) {
        existingPaths.push(repoPath);
      }
    }

    if (existingPaths.length === 0) {
      return false;
    }

    const anchors = this.extractBacktickedAnchors([entry.reality, entry.remember]);
    if (anchors.length === 0) {
      return true;
    }

    for (const repoPath of existingPaths) {
      try {
        const source = await this.repo.readText(path.join(rootDir, repoPath));
        if (anchors.some((anchor) => source.includes(anchor))) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  private extractRepoPaths(content: string): string[] {
    const discovered = new Set<string>();
    for (const match of content.matchAll(/`([^`]+)`/g)) {
      const candidate = match[1].trim();
      if (this.looksLikeRepoPath(candidate)) {
        discovered.add(candidate);
      }
    }

    for (const piece of content.split(/[,\n]/)) {
      const candidate = piece.trim().replace(/^[-*]\s*/, "");
      if (this.looksLikeRepoPath(candidate)) {
        discovered.add(candidate);
      }
    }

    return [...discovered];
  }

  private looksLikeRepoPath(candidate: string): boolean {
    const normalized = candidate.replace(/^["'`]+|["'`:.]+$/g, "");
    if (normalized.length === 0 || normalized.startsWith("http")) {
      return false;
    }

    return (
      normalized.includes("/") ||
      /\.(?:[a-z0-9]+)$/i.test(normalized)
    );
  }

  private extractBacktickedAnchors(values: string[]): string[] {
    const discovered = new Set<string>();
    for (const value of values) {
      for (const match of value.matchAll(/`([^`]+)`/g)) {
        const anchor = match[1].trim();
        if (anchor.length > 0 && !this.looksLikeRepoPath(anchor)) {
          discovered.add(anchor);
        }
      }
    }
    return [...discovered];
  }

  private async someRepoPathExists(rootDir: string, repoPaths: string[]): Promise<boolean> {
    for (const repoPath of repoPaths) {
      if (await this.repo.exists(path.join(rootDir, repoPath))) {
        return true;
      }
    }

    return false;
  }

  private async refreshKnowledgeFileMetadata(
    rootDir: string,
    index: BugIndex
  ): Promise<BugIndex> {
    const knowledgeFiles: BugKnowledgeFileRecord[] = [];
    for (const file of index.knowledgeFiles) {
      const filePath = path.join(rootDir, file.path);
      if (!(await this.repo.exists(filePath))) {
        continue;
      }

      const content = await this.repo.readText(filePath);
      knowledgeFiles.push({
        path: file.path,
        bytes: Buffer.byteLength(content, "utf8"),
        entryCount: this.parseKnowledgeEntries(content).length,
        updatedAt: new Date().toISOString()
      });
    }

    if (knowledgeFiles.length === 0) {
      const content = this.templates.renderMemorySegment(index.currentKnowledgeFile, []);
      await this.repo.writeText(path.join(rootDir, index.currentKnowledgeFile), content);
      knowledgeFiles.push({
        path: index.currentKnowledgeFile,
        bytes: Buffer.byteLength(content, "utf8"),
        entryCount: 0,
        updatedAt: new Date().toISOString()
      });
    }

    return {
      ...index,
      knowledgeFiles
    };
  }

  private async ensureInitialized(rootDir: string): Promise<void> {
    const status = await this.statusService.getStatus(rootDir);
    if (status.state !== "initialized") {
      throw new NotInitializedError(rootDir);
    }
  }

  private ensureAllowedCurrentStatus(
    record: BugRecord,
    allowedCurrent: BugStatus[],
    nextStatus: BugStatus
  ): void {
    if (!allowedCurrent.includes(record.status)) {
      throw new OSpecLiteError(`Cannot move bug from ${record.status} to ${nextStatus}.`);
    }
  }
}
