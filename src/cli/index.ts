#!/usr/bin/env node

import * as path from "node:path";
import { FileRepo } from "../fs/file-repo";
import { ScanService } from "../init/ospec-lite-scan-service";
import { MarkdownRenderer } from "../render/ospec-lite-markdown-renderer";
import { AgentEntryService } from "../agents/ospec-lite-agent-entry-service";
import { IndexService } from "../init/ospec-lite-index-service";
import { InitService } from "../init/ospec-lite-init-service";
import { StatusService } from "../status/ospec-lite-status-service";
import { ChangeService } from "../change/ospec-lite-change-service";
import { DocumentLanguage } from "../core/ospec-lite-types";
import { InitIncompleteError, OSpecLiteError } from "../core/ospec-lite-errors";

const repo = new FileRepo();
const scanService = new ScanService(repo);
const renderer = new MarkdownRenderer();
const agentEntries = new AgentEntryService(repo);
const indexService = new IndexService();
const initService = new InitService(repo, scanService, renderer, agentEntries, indexService);
const statusService = new StatusService(repo);
const changeService = new ChangeService(repo, statusService);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  switch (command) {
    case "init":
      await handleInit(rest);
      return;
    case "status":
      await handleStatus(rest);
      return;
    case "change":
      await handleChange(rest);
      return;
    default:
      printHelp();
  }
}

async function handleInit(args: string[]): Promise<void> {
  const pathArg = args.find((arg) => !arg.startsWith("--")) ?? ".";
  const documentLanguage = readDocumentLanguageArg(args);
  const targetDir = path.resolve(pathArg);
  const before = await initService.getInitState(targetDir);

  if (before.state === "initialized") {
    console.log("OSpec Lite: repository already initialized");
    console.log(`Path: ${targetDir}`);
    console.log(`Config: ${path.relative(targetDir, before.configPath).replace(/\\/g, "/")}`);
    return;
  }

  if (before.state === "incomplete") {
    throw new InitIncompleteError(before.missingMarkers);
  }

  const result = await initService.init(targetDir, documentLanguage);
  console.log("OSpec Lite: repository initialized");
  console.log(`Path: ${targetDir}`);
  console.log(`Config: ${path.relative(targetDir, result.configPath).replace(/\\/g, "/")}`);
  console.log(`Index: ${path.relative(targetDir, result.indexPath).replace(/\\/g, "/")}`);
}

async function handleStatus(args: string[]): Promise<void> {
  const targetDir = path.resolve(args[0] ?? ".");
  const status = await statusService.getStatus(targetDir);

  console.log("OSpec Lite Status");
  console.log(`Initialized: ${status.state === "initialized" ? "yes" : "no"}`);
  console.log(`State: ${status.state}`);

  if (status.config) {
    console.log(`Agent targets: ${status.config.agentTargets.join(", ")}`);
    console.log("Agent entry files:");
    for (const [target, fileName] of Object.entries(status.config.agentEntryFiles)) {
      console.log(`- ${target}: ${fileName}`);
    }
    console.log(`Project docs: ${status.config.projectDocsRoot}`);
    console.log(`Changes root: ${status.config.changeRoot}`);
  }

  console.log(`Active changes: ${status.activeChanges.length}`);
  console.log(`Archived changes: ${status.archivedChanges.length}`);

  if (status.missingMarkers.length > 0) {
    console.log("Missing markers:");
    for (const marker of status.missingMarkers) {
      console.log(`- ${marker}`);
    }
  }
}

async function handleChange(args: string[]): Promise<void> {
  const [action, ...rest] = args;
  switch (action) {
    case "new": {
      const slug = rest[0];
      if (!slug) {
        throw new OSpecLiteError("Missing change slug.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      const changeDir = await changeService.newChange(targetDir, slug);
      console.log(`Created change: ${changeDir}`);
      return;
    }
    case "apply": {
      const changePath = path.resolve(rest[0] ?? ".");
      await changeService.markApplied(changePath);
      console.log(`Marked applied: ${changePath}`);
      return;
    }
    case "verify": {
      const changePath = path.resolve(rest[0] ?? ".");
      await changeService.markVerified(changePath);
      console.log(`Marked verified: ${changePath}`);
      return;
    }
    case "archive": {
      const changePath = path.resolve(rest[0] ?? ".");
      const archivePath = await changeService.archive(changePath);
      console.log(`Archived change to: ${archivePath}`);
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported change action: ${action ?? "(missing)"}`);
  }
}

function readDocumentLanguageArg(args: string[]): DocumentLanguage | undefined {
  const flagIndex = args.findIndex((arg) => arg === "--document-language");
  if (flagIndex < 0) {
    return undefined;
  }
  const value = args[flagIndex + 1];
  if (value === "en-US" || value === "zh-CN") {
    return value;
  }
  throw new OSpecLiteError(`Unsupported document language: ${value}`);
}

function printHelp(): void {
  console.log(`oslite <command>

Commands:
  oslite init [path] [--document-language en-US|zh-CN]
  oslite status [path]
  oslite change new <slug> [path]
  oslite change apply <change-path>
  oslite change verify <change-path>
  oslite change archive <change-path>`);
}

main().catch((error: unknown) => {
  if (error instanceof InitIncompleteError) {
    console.error("OSpec Lite: initialization incomplete");
    for (const marker of error.missingMarkers) {
      console.error(`- ${marker}`);
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
});
