import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import {
  PluginAuthenticationPolicy,
  PluginInstallationPolicy
} from "../../plugins/ospec-lite-plugin-types";
import { CliServices } from "../cli-services";
import { readFlagValue } from "../cli-shared";

export async function handlePlugins(args: string[], services: CliServices): Promise<void> {
  const [action, ...rest] = args;

  switch (action) {
    case "list": {
      const targetDir = path.resolve(rest[0] ?? ".");
      const report = await services.pluginService.list(targetDir);
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
      const result = (await services.repo.exists(manifestPath))
        ? await services.pluginService.installFromPath(targetDir, sourcePath, {
            installation,
            authentication,
            force
          })
        : await services.pluginService.installBundled(targetDir, pluginRef, {
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
      const results = await services.pluginService.installBundledDefaults(targetDir, {
        force
      });
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
      const result = await services.pluginService.createPlugin(targetDir, parsed.pluginName, {
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

export function parsePluginInstallArgs(args: string[]): {
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
      const next = readFlagValue(args, index, "--installation");
      installation = parsePluginInstallationPolicy(next.value);
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--installation=")) {
      installation = parsePluginInstallationPolicy(arg.slice("--installation=".length));
      continue;
    }

    if (arg === "--authentication") {
      const next = readFlagValue(args, index, "--authentication");
      authentication = parsePluginAuthenticationPolicy(next.value);
      index = next.nextIndex;
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

export function parsePluginDefaultsArgs(args: string[]): {
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

export function parsePluginCreateArgs(args: string[]): {
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
      const next = readFlagValue(args, index, "--display-name");
      displayName = next.value;
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--display-name=")) {
      displayName = arg.slice("--display-name=".length);
      continue;
    }

    if (arg === "--description") {
      const next = readFlagValue(args, index, "--description");
      description = next.value;
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--description=")) {
      description = arg.slice("--description=".length);
      continue;
    }

    if (arg === "--category") {
      const next = readFlagValue(args, index, "--category");
      category = next.value;
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--category=")) {
      category = arg.slice("--category=".length);
      continue;
    }

    if (arg === "--installation") {
      const next = readFlagValue(args, index, "--installation");
      installation = parsePluginInstallationPolicy(next.value);
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--installation=")) {
      installation = parsePluginInstallationPolicy(arg.slice("--installation=".length));
      continue;
    }

    if (arg === "--authentication") {
      const next = readFlagValue(args, index, "--authentication");
      authentication = parsePluginAuthenticationPolicy(next.value);
      index = next.nextIndex;
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

const INSTALLATION_POLICIES: readonly PluginInstallationPolicy[] = [
  "NOT_AVAILABLE",
  "AVAILABLE",
  "INSTALLED_BY_DEFAULT"
];

const AUTHENTICATION_POLICIES: readonly PluginAuthenticationPolicy[] = [
  "ON_INSTALL",
  "ON_USE"
];

function parseEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string
): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new OSpecLiteError(`Unsupported ${label}: ${value}`);
}

function parsePluginInstallationPolicy(value: string): PluginInstallationPolicy {
  return parseEnumValue(value, INSTALLATION_POLICIES, "plugin installation policy");
}

function parsePluginAuthenticationPolicy(value: string): PluginAuthenticationPolicy {
  return parseEnumValue(value, AUTHENTICATION_POLICIES, "plugin authentication policy");
}
