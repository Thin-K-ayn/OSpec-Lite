#!/usr/bin/env node

import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import { FileRepo } from "../fs/file-repo";
import { ScanService } from "../init/ospec-lite-scan-service";
import { MarkdownRenderer } from "../render/ospec-lite-markdown-renderer";
import { AgentEntryService } from "../agents/ospec-lite-agent-entry-service";
import { IndexService } from "../init/ospec-lite-index-service";
import { InitService } from "../init/ospec-lite-init-service";
import { StatusService } from "../status/ospec-lite-status-service";
import { ChangeService } from "../change/ospec-lite-change-service";
import { BugService } from "../bug/ospec-lite-bug-service";
import { RefreshService } from "../refresh/ospec-lite-refresh-service";
import {
  BootstrapAgent,
  DocumentLanguage,
  HostAgent
} from "../core/ospec-lite-types";
import {
  BugValidationError,
  ChangeValidationError,
  DocVerificationError,
  InitIncompleteError,
  OSpecLiteError,
  ProfileInitAnswersRequiredError,
  RefreshStateError
} from "../core/ospec-lite-errors";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";
import { DocVerifierService } from "../docs/ospec-lite-doc-verifier-service";
import { KnowledgeTemplateService } from "../init/ospec-lite-knowledge-template-service";
import { PluginService } from "../plugins/ospec-lite-plugin-service";
import {
  PluginAuthenticationPolicy,
  PluginInstallationPolicy
} from "../plugins/ospec-lite-plugin-types";

const repo = new FileRepo();
const scanService = new ScanService(repo);
const renderer = new MarkdownRenderer();
const agentEntries = new AgentEntryService(repo);
const indexService = new IndexService();
const profileLoader = new ProfileLoader(repo);
const knowledgeService = new KnowledgeTemplateService(renderer, profileLoader);
const initService = new InitService(
  repo,
  scanService,
  renderer,
  agentEntries,
  indexService,
  profileLoader
);
const statusService = new StatusService(repo);
const refreshService = new RefreshService(
  repo,
  scanService,
  agentEntries,
  indexService,
  profileLoader,
  statusService,
  knowledgeService
);
const changeService = new ChangeService(repo, statusService);
const bugService = new BugService(repo, statusService);
const docVerifier = new DocVerifierService(repo);
const pluginService = new PluginService(repo);

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
    case "refresh":
      await handleRefresh(rest);
      return;
    case "change":
      await handleChange(rest);
      return;
    case "bug":
      await handleBug(rest);
      return;
    case "docs":
      await handleDocs(rest);
      return;
    case "plugins":
      await handlePlugins(rest);
      return;
    default:
      printHelp();
  }
}

async function handleInit(args: string[]): Promise<void> {
  const { pathArg, documentLanguage, profileId, projectName, bootstrapAgent } =
    parseInitArgs(args);
  const targetDir = path.resolve(pathArg);
  const before = await initService.getInitState(targetDir);

  if (before.state === "initialized") {
    const status = await statusService.getStatus(targetDir);
    console.log("OSpec Lite: repository already initialized");
    console.log(`Path: ${targetDir}`);
    console.log(`Config: ${path.relative(targetDir, before.configPath).replace(/\\/g, "/")}`);
    if (isCompleteStatusConfig(status.config)) {
      if (status.config.projectName) {
        console.log(`Project: ${status.config.projectName}`);
      }
      if (status.config.profileId) {
        console.log(`Profile: ${status.config.profileId}`);
      }
      if (status.config.bootstrapAgent) {
        console.log(`Bootstrap agent: ${status.config.bootstrapAgent}`);
      }
      console.log(`Agent targets: ${status.config.agentTargets.join(", ")}`);
      console.log("Agent entry files:");
      for (const [target, fileName] of Object.entries(status.config.agentEntryFiles)) {
        console.log(`- ${target}: ${fileName}`);
      }
      printAgentWrappers(status.config.agentWrapperFiles);
      console.log(`Project docs: ${status.config.projectDocsRoot}`);
      if (status.config.authoringPackRoot) {
        console.log(`Authoring pack: ${status.config.authoringPackRoot}`);
      }
      console.log(`Changes root: ${status.config.changeRoot}`);
    }
    return;
  }

  if (before.state === "incomplete") {
    throw new InitIncompleteError(before.missingMarkers);
  }

  const resolvedAnswers = await resolveProfileInitAnswers(targetDir, {
    profileId,
    projectName,
    bootstrapAgent
  });
  const result = await initService.init(targetDir, {
    documentLanguage,
    profileId,
    projectName: resolvedAnswers.projectName,
    bootstrapAgent: resolvedAnswers.bootstrapAgent,
    hostAgent: detectHostAgent()
  });
  console.log("OSpec Lite: repository initialized");
  console.log(`Path: ${targetDir}`);
  console.log(`Config: ${path.relative(targetDir, result.configPath).replace(/\\/g, "/")}`);
  console.log(`Index: ${path.relative(targetDir, result.indexPath).replace(/\\/g, "/")}`);
  if (result.config?.projectName) {
    console.log(`Project: ${result.config.projectName}`);
  }
  if (result.config?.profileId) {
    console.log(`Profile: ${result.config.profileId}`);
  }
  if (result.config?.bootstrapAgent) {
    console.log(`Bootstrap agent: ${result.config.bootstrapAgent}`);
  }
  if (result.bootstrapPlan) {
    if (result.bootstrapPlan.shouldBootstrapNow) {
      console.log("Bootstrapping now...");
      if (result.bootstrapPlan.wrapperPath) {
        console.log(`Bootstrap wrapper: ${result.bootstrapPlan.wrapperPath}`);
      }
      if (result.bootstrapPlan.nextStep) {
        console.log(`Bootstrap command: ${result.bootstrapPlan.nextStep}`);
      }
    } else if (result.bootstrapPlan.nextStep) {
      console.log("Next step:");
      console.log(result.bootstrapPlan.nextStep);
      if (result.bootstrapPlan.wrapperPath) {
        console.log(`Wrapper: ${result.bootstrapPlan.wrapperPath}`);
      }
    }
  }
}

async function handleStatus(args: string[]): Promise<void> {
  const targetDir = path.resolve(args[0] ?? ".");
  const status = await statusService.getStatus(targetDir);

  console.log("OSpec Lite Status");
  console.log(`Initialized: ${status.state === "initialized" ? "yes" : "no"}`);
  console.log(`State: ${status.state}`);

  if (isCompleteStatusConfig(status.config)) {
    if (status.config.projectName) {
      console.log(`Project: ${status.config.projectName}`);
    }
    if (status.config.profileId) {
      console.log(`Profile: ${status.config.profileId}`);
    }
    if (status.config.bootstrapAgent) {
      console.log(`Bootstrap agent: ${status.config.bootstrapAgent}`);
    }
    console.log(`Agent targets: ${status.config.agentTargets.join(", ")}`);
    console.log("Agent entry files:");
    for (const [target, fileName] of Object.entries(status.config.agentEntryFiles)) {
      console.log(`- ${target}: ${fileName}`);
    }
    printAgentWrappers(status.config.agentWrapperFiles);
    console.log(`Project docs: ${status.config.projectDocsRoot}`);
    if (status.config.authoringPackRoot) {
      console.log(`Authoring pack: ${status.config.authoringPackRoot}`);
    }
    console.log(`Changes root: ${status.config.changeRoot}`);
  } else if (status.config) {
    console.log("Config: incomplete or invalid");
  }

  console.log(`Active changes: ${status.activeChanges.length}`);
  console.log(`Archived changes: ${status.archivedChanges.length}`);
  console.log(`Active bugs: ${status.activeBugs.length}`);
  console.log(`Applied bugs: ${status.appliedBugs.length}`);

  if (status.missingMarkers.length > 0) {
    console.log("Missing markers:");
    for (const marker of status.missingMarkers) {
      console.log(`- ${marker}`);
    }
  }
}

async function handleRefresh(args: string[]): Promise<void> {
  const targetDir = path.resolve(args[0] ?? ".");
  const report = await refreshService.refresh(targetDir);

  console.log("OSpec Lite refreshed");
  console.log(`Path: ${targetDir}`);
  printPathList("Updated machine-managed artifacts", report.updatedArtifacts);
  printPathList("Human-owned docs needing review", report.reviewNeededDocs);
  printPathList("Initialized doc suggestion baselines", report.baselineInitializedDocs);
  if (report.baselineInitializedDocs.length > 0) {
    console.log("Future refresh runs will flag these docs when the generated suggestion changes.");
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

async function handleBug(args: string[]): Promise<void> {
  const [action, ...rest] = args;
  switch (action) {
    case "new": {
      const title = rest[0];
      if (!title) {
        throw new OSpecLiteError("Missing bug title.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      const bugId = await bugService.newBug(targetDir, title);
      console.log(`Created bug: ${bugId}`);
      console.log("Active bugs: .oslite/bugs/active-bugs.md");
      return;
    }
    case "fix": {
      const bugId = rest[0];
      if (!bugId) {
        throw new OSpecLiteError("Missing bug id.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      await bugService.markFixed(targetDir, bugId);
      console.log(`Marked fixed: ${bugId}`);
      return;
    }
    case "apply": {
      const bugId = rest[0];
      if (!bugId) {
        throw new OSpecLiteError("Missing bug id.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      await bugService.apply(targetDir, bugId);
      console.log(`Applied bug: ${bugId}`);
      console.log("Updated bug memory: .oslite/docs/project/bug-memory.md");
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported bug action: ${action ?? "(missing)"}`);
  }
}

async function handleDocs(args: string[]): Promise<void> {
  const [action, ...rest] = args;
  switch (action) {
    case "verify": {
      const targetDir = path.resolve(rest[0] ?? ".");
      const report = await docVerifier.verify(targetDir);
      console.log("OSpec Lite docs verification passed");
      console.log(`Profile: ${report.profileId}`);
      console.log(`Checklist: ${report.checklistPath}`);
      console.log("Checked files:");
      for (const filePath of report.checkedFiles) {
        console.log(`- ${filePath}`);
      }
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported docs action: ${action ?? "(missing)"}`);
  }
}

async function handlePlugins(args: string[]): Promise<void> {
  const [action, ...rest] = args;

  switch (action) {
    case "list": {
      const targetDir = path.resolve(rest[0] ?? ".");
      const report = await pluginService.list(targetDir);
      console.log("OSpec Lite Plugins");
      console.log(`Marketplace: ${report.marketplacePath}`);
      console.log(`Marketplace exists: ${report.marketplaceExists ? "yes" : "no"}`);
      console.log("Bundled plugins:");
      for (const bundled of report.bundledPlugins) {
        console.log(`- ${bundled.name} [${bundled.installation}] - ${bundled.summary}`);
      }
      console.log("Installed plugins:");
      if (report.installedPlugins.length === 0) {
        console.log("- (none)");
      } else {
        for (const installed of report.installedPlugins) {
          console.log(
            `- ${installed.name} (${installed.source.path}; ${installed.policy.installation}; ${installed.policy.authentication})`
          );
        }
      }
      return;
    }
    case "install": {
      const { pluginRef, pathArg, force, installation, authentication } =
        parsePluginInstallArgs(rest);
      const targetDir = path.resolve(pathArg);
      const sourcePath = path.resolve(pluginRef);
      const manifestPath = path.join(sourcePath, ".codex-plugin", "plugin.json");
      const result =
        (await repo.exists(manifestPath))
          ? await pluginService.installFromPath(targetDir, sourcePath, {
              installation,
              authentication,
              force
            })
          : await pluginService.installBundled(targetDir, pluginRef, {
              installation,
              authentication,
              force
            });

      console.log(`Installed plugin: ${result.pluginName}`);
      console.log(`Plugin path: ${result.pluginDir}`);
      console.log(`Marketplace: ${result.marketplacePath}`);
      console.log(`Source: ${result.sourcePath}`);
      console.log(`Installation policy: ${result.installation}`);
      console.log(`Authentication policy: ${result.authentication}`);
      return;
    }
    case "install-defaults": {
      const { pathArg, force } = parsePluginDefaultsArgs(rest);
      const targetDir = path.resolve(pathArg);
      const results = await pluginService.installBundledDefaults(targetDir, { force });
      console.log("Installed default plugins:");
      for (const result of results) {
        console.log(`- ${result.pluginName}: ${result.pluginDir}`);
      }
      if (results.length > 0) {
        console.log(`Marketplace: ${results[0].marketplacePath}`);
      }
      return;
    }
    case "create": {
      const parsed = parsePluginCreateArgs(rest);
      const targetDir = path.resolve(parsed.pathArg);
      const result = await pluginService.createPlugin(targetDir, parsed.pluginName, {
        displayName: parsed.displayName,
        description: parsed.description,
        category: parsed.category,
        installation: parsed.installation,
        authentication: parsed.authentication,
        withMarketplace: parsed.withMarketplace,
        withSkills: parsed.withSkills,
        withHooks: parsed.withHooks,
        withScripts: parsed.withScripts,
        withAssets: parsed.withAssets,
        withMcp: parsed.withMcp,
        withApps: parsed.withApps,
        force: parsed.force
      });

      console.log(`Created plugin: ${result.pluginName}`);
      console.log(`Plugin path: ${result.pluginDir}`);
      console.log(`Manifest: ${result.manifestPath}`);
      if (result.marketplacePath) {
        console.log(`Marketplace: ${result.marketplacePath}`);
      }
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported plugins action: ${action ?? "(missing)"}`);
  }
}

function parseInitArgs(args: string[]): {
  pathArg: string;
  documentLanguage?: DocumentLanguage;
  profileId?: string;
  projectName?: string;
  bootstrapAgent?: BootstrapAgent;
} {
  let pathArg: string | undefined;
  let documentLanguage: DocumentLanguage | undefined;
  let profileId: string | undefined;
  let projectName: string | undefined;
  let bootstrapAgent: BootstrapAgent | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--document-language") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --document-language.");
      }
      documentLanguage = parseDocumentLanguage(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--document-language=")) {
      documentLanguage = parseDocumentLanguage(
        arg.slice("--document-language=".length)
      );
      continue;
    }

    if (arg === "--profile") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --profile.");
      }
      profileId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      profileId = arg.slice("--profile=".length);
      continue;
    }

    if (arg === "--project-name") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --project-name.");
      }
      projectName = value.trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--project-name=")) {
      projectName = arg.slice("--project-name=".length).trim();
      continue;
    }

    if (arg === "--bootstrap-agent") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --bootstrap-agent.");
      }
      bootstrapAgent = parseBootstrapAgent(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--bootstrap-agent=")) {
      bootstrapAgent = parseBootstrapAgent(arg.slice("--bootstrap-agent=".length));
      continue;
    }

    if (arg.startsWith("--")) {
      throw new OSpecLiteError(`Unsupported option: ${arg}`);
    }

    if (pathArg) {
      throw new OSpecLiteError(`Unexpected argument: ${arg}`);
    }

    pathArg = arg;
  }

  return {
    pathArg: pathArg ?? ".",
    documentLanguage,
    profileId,
    projectName,
    bootstrapAgent
  };
}

function parseDocumentLanguage(value: string): DocumentLanguage {
  if (value === "en-US" || value === "zh-CN") {
    return value;
  }
  throw new OSpecLiteError(`Unsupported document language: ${value}`);
}

function parseBootstrapAgent(value: string): BootstrapAgent {
  if (value === "codex" || value === "claude-code" || value === "none") {
    return value;
  }
  throw new OSpecLiteError(`Unsupported bootstrap agent: ${value}`);
}

function parsePluginInstallArgs(args: string[]): {
  pluginRef: string;
  pathArg: string;
  force: boolean;
  installation?: PluginInstallationPolicy;
  authentication?: PluginAuthenticationPolicy;
} {
  let pluginRef: string | undefined;
  let pathArg: string | undefined;
  let force = false;
  let installation: PluginInstallationPolicy | undefined;
  let authentication: PluginAuthenticationPolicy | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--installation") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --installation.");
      }
      installation = parsePluginInstallationPolicy(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--installation=")) {
      installation = parsePluginInstallationPolicy(arg.slice("--installation=".length));
      continue;
    }

    if (arg === "--authentication") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --authentication.");
      }
      authentication = parsePluginAuthenticationPolicy(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--authentication=")) {
      authentication = parsePluginAuthenticationPolicy(arg.slice("--authentication=".length));
      continue;
    }

    if (arg.startsWith("--")) {
      throw new OSpecLiteError(`Unsupported option: ${arg}`);
    }

    if (!pluginRef) {
      pluginRef = arg;
      continue;
    }

    if (!pathArg) {
      pathArg = arg;
      continue;
    }

    throw new OSpecLiteError(`Unexpected argument: ${arg}`);
  }

  if (!pluginRef) {
    throw new OSpecLiteError("Missing plugin name or plugin path.");
  }

  return {
    pluginRef,
    pathArg: pathArg ?? ".",
    force,
    installation,
    authentication
  };
}

function parsePluginDefaultsArgs(args: string[]): {
  pathArg: string;
  force: boolean;
} {
  let pathArg: string | undefined;
  let force = false;

  for (const arg of args) {
    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new OSpecLiteError(`Unsupported option: ${arg}`);
    }

    if (pathArg) {
      throw new OSpecLiteError(`Unexpected argument: ${arg}`);
    }

    pathArg = arg;
  }

  return {
    pathArg: pathArg ?? ".",
    force
  };
}

function parsePluginCreateArgs(args: string[]): {
  pluginName: string;
  pathArg: string;
  displayName?: string;
  description?: string;
  category?: string;
  installation?: PluginInstallationPolicy;
  authentication?: PluginAuthenticationPolicy;
  withMarketplace: boolean;
  withSkills: boolean;
  withHooks: boolean;
  withScripts: boolean;
  withAssets: boolean;
  withMcp: boolean;
  withApps: boolean;
  force: boolean;
} {
  let pluginName: string | undefined;
  let pathArg: string | undefined;
  let displayName: string | undefined;
  let description: string | undefined;
  let category: string | undefined;
  let installation: PluginInstallationPolicy | undefined;
  let authentication: PluginAuthenticationPolicy | undefined;
  let withMarketplace = true;
  let withSkills = false;
  let withHooks = false;
  let withScripts = false;
  let withAssets = false;
  let withMcp = false;
  let withApps = false;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--display-name") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --display-name.");
      }
      displayName = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--display-name=")) {
      displayName = arg.slice("--display-name=".length);
      continue;
    }

    if (arg === "--description") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --description.");
      }
      description = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--description=")) {
      description = arg.slice("--description=".length);
      continue;
    }

    if (arg === "--category") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --category.");
      }
      category = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--category=")) {
      category = arg.slice("--category=".length);
      continue;
    }

    if (arg === "--installation") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --installation.");
      }
      installation = parsePluginInstallationPolicy(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--installation=")) {
      installation = parsePluginInstallationPolicy(arg.slice("--installation=".length));
      continue;
    }

    if (arg === "--authentication") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new OSpecLiteError("Missing value for --authentication.");
      }
      authentication = parsePluginAuthenticationPolicy(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--authentication=")) {
      authentication = parsePluginAuthenticationPolicy(arg.slice("--authentication=".length));
      continue;
    }

    if (arg === "--with-skills") {
      withSkills = true;
      continue;
    }

    if (arg === "--with-hooks") {
      withHooks = true;
      continue;
    }

    if (arg === "--with-scripts") {
      withScripts = true;
      continue;
    }

    if (arg === "--with-assets") {
      withAssets = true;
      continue;
    }

    if (arg === "--with-mcp") {
      withMcp = true;
      continue;
    }

    if (arg === "--with-apps") {
      withApps = true;
      continue;
    }

    if (arg === "--no-marketplace") {
      withMarketplace = false;
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new OSpecLiteError(`Unsupported option: ${arg}`);
    }

    if (!pluginName) {
      pluginName = arg;
      continue;
    }

    if (!pathArg) {
      pathArg = arg;
      continue;
    }

    throw new OSpecLiteError(`Unexpected argument: ${arg}`);
  }

  if (!pluginName) {
    throw new OSpecLiteError("Missing plugin name.");
  }

  return {
    pluginName,
    pathArg: pathArg ?? ".",
    displayName,
    description,
    category,
    installation,
    authentication,
    withMarketplace,
    withSkills,
    withHooks,
    withScripts,
    withAssets,
    withMcp,
    withApps,
    force
  };
}

function parsePluginInstallationPolicy(value: string): PluginInstallationPolicy {
  if (
    value === "NOT_AVAILABLE" ||
    value === "AVAILABLE" ||
    value === "INSTALLED_BY_DEFAULT"
  ) {
    return value;
  }
  throw new OSpecLiteError(`Unsupported plugin installation policy: ${value}`);
}

function parsePluginAuthenticationPolicy(value: string): PluginAuthenticationPolicy {
  if (value === "ON_INSTALL" || value === "ON_USE") {
    return value;
  }
  throw new OSpecLiteError(`Unsupported plugin authentication policy: ${value}`);
}

function isCompleteStatusConfig(
  value: unknown
): value is {
  agentTargets: string[];
  agentEntryFiles: Record<string, string>;
  projectDocsRoot: string;
  changeRoot: string;
  profileId?: string;
  authoringPackRoot?: string;
  agentWrapperFiles?: Record<string, string[]>;
  projectName?: string;
  bootstrapAgent?: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    agentTargets?: unknown;
    agentEntryFiles?: unknown;
    projectDocsRoot?: unknown;
    changeRoot?: unknown;
    profileId?: unknown;
    authoringPackRoot?: unknown;
    agentWrapperFiles?: unknown;
    projectName?: unknown;
    bootstrapAgent?: unknown;
  };

  return (
    Array.isArray(candidate.agentTargets) &&
    candidate.agentTargets.every((item) => typeof item === "string") &&
    !!candidate.agentEntryFiles &&
    typeof candidate.agentEntryFiles === "object" &&
    Object.values(candidate.agentEntryFiles).every((item) => typeof item === "string") &&
    typeof candidate.projectDocsRoot === "string" &&
    typeof candidate.changeRoot === "string" &&
    (candidate.profileId === undefined || typeof candidate.profileId === "string") &&
    (candidate.projectName === undefined || typeof candidate.projectName === "string") &&
    (candidate.bootstrapAgent === undefined ||
      candidate.bootstrapAgent === "codex" ||
      candidate.bootstrapAgent === "claude-code" ||
      candidate.bootstrapAgent === "none") &&
    (candidate.authoringPackRoot === undefined ||
      typeof candidate.authoringPackRoot === "string") &&
    (candidate.agentWrapperFiles === undefined ||
      isStringArrayRecord(candidate.agentWrapperFiles))
  );
}

function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value).every(
    (item) => Array.isArray(item) && item.every((entry) => typeof entry === "string")
  );
}

function printAgentWrappers(
  wrappers: Record<string, string[]> | undefined
): void {
  if (!wrappers || Object.keys(wrappers).length === 0) {
    return;
  }

  console.log("Agent wrappers:");
  for (const [target, files] of Object.entries(wrappers)) {
    for (const filePath of files) {
      console.log(`- ${target}: ${filePath}`);
    }
  }
}

function printPathList(label: string, items: string[]): void {
  console.log(`${label}:`);
  if (items.length === 0) {
    console.log("- (none)");
    return;
  }

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function printHelp(): void {
  console.log(`oslite <command>

Commands:
  oslite init [path] [--document-language en-US|zh-CN] [--profile <profile-id>] [--project-name <name>] [--bootstrap-agent codex|claude-code|none]
  oslite status [path]
  oslite refresh [path]
  oslite bug new <title> [path]
  oslite bug fix <bug-id> [path]
  oslite bug apply <bug-id> [path]
  oslite docs verify [path]
  oslite plugins list [path]
  oslite plugins install <plugin-name|plugin-path> [path] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
  oslite plugins install-defaults [path] [--force]
  oslite plugins create <plugin-name> [path] [--display-name <name>] [--description <text>] [--category <category>] [--with-skills] [--with-hooks] [--with-scripts] [--with-assets] [--with-mcp] [--with-apps] [--no-marketplace] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
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

  if (error instanceof ProfileInitAnswersRequiredError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (error instanceof DocVerificationError) {
    console.error("OSpec Lite docs verification failed");
    console.error(`Profile: ${error.profileId}`);
    console.error(`Checklist: ${error.checklistPath}`);
    for (const issue of error.issues) {
      console.error(`- ${issue.file}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof RefreshStateError) {
    console.error(`OSpec Lite refresh blocked: repository state is ${error.state}`);
    if (error.missingMarkers.length > 0) {
      console.error("Missing markers:");
      for (const marker of error.missingMarkers) {
        console.error(`- ${marker}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof ChangeValidationError) {
    console.error(`OSpec Lite change ${error.phase} blocked: ${path.resolve(error.changePath)}`);
    for (const issue of error.issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof BugValidationError) {
    console.error(`OSpec Lite bug ${error.phase} blocked: ${error.bugId}`);
    for (const issue of error.issues) {
      console.error(`- ${issue}`);
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

async function resolveProfileInitAnswers(
  targetDir: string,
  values: {
    profileId?: string;
    projectName?: string;
    bootstrapAgent?: BootstrapAgent;
  }
): Promise<{
  projectName?: string;
  bootstrapAgent?: BootstrapAgent;
}> {
  if (!values.profileId) {
    if (values.projectName || values.bootstrapAgent) {
      throw new OSpecLiteError(
        "--project-name and --bootstrap-agent are only supported with a profile that requires those init values."
      );
    }
    return {};
  }

  const profile = await profileLoader.loadProfile(values.profileId);
  const requiredFields = new Set(profile.requiredInitFields ?? []);

  if (requiredFields.size === 0) {
    if (values.projectName || values.bootstrapAgent) {
      throw new OSpecLiteError(
        "--project-name and --bootstrap-agent are only supported with a profile that requires those init values."
      );
    }
    return values;
  }

  if (values.projectName && !requiredFields.has("projectName")) {
    throw new OSpecLiteError(
      "--project-name and --bootstrap-agent are only supported with a profile that requires those init values."
    );
  }
  if (values.bootstrapAgent && !requiredFields.has("bootstrapAgent")) {
    throw new OSpecLiteError(
      "--project-name and --bootstrap-agent are only supported with a profile that requires those init values."
    );
  }

  const missingFields: string[] = [];
  if (requiredFields.has("projectName") && !values.projectName) {
    missingFields.push("projectName");
  }
  if (requiredFields.has("bootstrapAgent") && !values.bootstrapAgent) {
    missingFields.push("bootstrapAgent");
  }

  if (missingFields.length === 0) {
    return values;
  }

  if (!isInteractiveInitAllowed()) {
    throw new ProfileInitAnswersRequiredError(values.profileId, missingFields);
  }

  const defaults = {
    projectName: path.basename(targetDir),
    bootstrapAgent: "none" as BootstrapAgent
  };
  const prompter = await createInitPrompter();

  try {
    const projectName = requiredFields.has("projectName")
      ? values.projectName ??
        (await prompter.ask("Project name", defaults.projectName))
      : values.projectName;
    const bootstrapAnswer = requiredFields.has("bootstrapAgent")
      ? values.bootstrapAgent ??
        (await prompter.ask(
          "Bootstrap agent (codex/claude-code/none)",
          defaults.bootstrapAgent
        ).then((answer) => parseBootstrapAgent(answer)))
      : values.bootstrapAgent;

    return {
      projectName,
      bootstrapAgent: bootstrapAnswer
    };
  } finally {
    prompter.close();
  }
}

function isInteractiveInitAllowed(): boolean {
  return (
    process.env.OSLITE_FORCE_INTERACTIVE === "1" ||
    (process.stdin.isTTY === true && process.stdout.isTTY === true)
  );
}

function detectHostAgent(): HostAgent {
  const value = process.env.OSLITE_HOST_AGENT;
  if (value === "codex" || value === "claude-code") {
    return value;
  }
  return "unknown";
}

interface InitPrompter {
  ask(label: string, defaultValue: string): Promise<string>;
  close(): void;
}

async function createInitPrompter(): Promise<InitPrompter> {
  if (process.stdin.isTTY === true && process.stdout.isTTY === true) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return {
      ask: async (label: string, defaultValue: string) => {
        const answer = (await rl.question(`${label} [${defaultValue}]: `)).trim();
        return answer.length > 0 ? answer : defaultValue;
      },
      close: () => rl.close()
    };
  }

  const answers = await readPromptAnswersFromStdin();
  let cursor = 0;

  return {
    ask: async (label: string, defaultValue: string) => {
      process.stdout.write(`${label} [${defaultValue}]: `);
      const answer = (answers[cursor] ?? "").trim();
      cursor += 1;
      return answer.length > 0 ? answer : defaultValue;
    },
    close: () => undefined
  };
}

async function readPromptAnswersFromStdin(): Promise<string[]> {
  process.stdin.setEncoding("utf8");
  let content = "";

  for await (const chunk of process.stdin) {
    content += chunk;
  }

  return content
    .split(/\r?\n/)
    .filter((line, index, items) => !(index === items.length - 1 && line.length === 0));
}
