import * as path from "node:path";
import {
  InvalidPluginNameError,
  InvalidPluginSourceError,
  PluginAlreadyExistsError,
  UnknownBundledPluginError
} from "../core/ospec-lite-errors";
import { FileRepo } from "../fs/file-repo";
import { BUNDLED_PLUGIN_DEFINITIONS } from "./ospec-lite-plugin-catalog";
import {
  BundledPluginDefinition,
  PluginAuthenticationPolicy,
  PluginCreateResult,
  PluginInstallResult,
  PluginInstallationPolicy,
  PluginListReport,
  PluginManifest,
  PluginMarketplace,
  PluginMarketplaceEntry,
  PluginScaffoldOptions
} from "./ospec-lite-plugin-types";

const MAX_PLUGIN_NAME_LENGTH = 64;

export class PluginService {
  constructor(
    private readonly repo: FileRepo,
    private readonly bundledPlugins = BUNDLED_PLUGIN_DEFINITIONS
  ) {}

  async list(rootDir: string): Promise<PluginListReport> {
    const marketplacePath = this.getMarketplacePath(rootDir);
    const marketplace = await this.readMarketplace(rootDir);

    return {
      marketplacePath,
      marketplaceExists: marketplace !== null,
      bundledPlugins: [...this.bundledPlugins],
      installedPlugins: marketplace?.plugins ?? []
    };
  }

  async installBundled(
    rootDir: string,
    pluginName: string,
    options: {
      installation?: PluginInstallationPolicy;
      authentication?: PluginAuthenticationPolicy;
      force?: boolean;
    } = {}
  ): Promise<PluginInstallResult> {
    const normalizedName = this.normalizePluginName(pluginName);
    const bundled = this.bundledPlugins.find((item) => item.name === normalizedName);
    if (!bundled || !(await this.repo.exists(bundled.sourceDir))) {
      throw new UnknownBundledPluginError(pluginName);
    }

    return this.installFromDirectory(rootDir, bundled.sourceDir, {
      installation: options.installation ?? bundled.installation,
      authentication: options.authentication ?? bundled.authentication,
      force: options.force
    });
  }

  async installBundledDefaults(
    rootDir: string,
    options: {
      force?: boolean;
    } = {}
  ): Promise<PluginInstallResult[]> {
    const defaults = this.bundledPlugins.filter(
      (item) => item.installation === "INSTALLED_BY_DEFAULT"
    );
    const results: PluginInstallResult[] = [];

    for (const bundled of defaults) {
      results.push(
        await this.installBundled(rootDir, bundled.name, {
          installation: bundled.installation,
          authentication: bundled.authentication,
          force: options.force
        })
      );
    }

    return results;
  }

  async installFromPath(
    rootDir: string,
    sourcePath: string,
    options: {
      installation?: PluginInstallationPolicy;
      authentication?: PluginAuthenticationPolicy;
      force?: boolean;
    } = {}
  ): Promise<PluginInstallResult> {
    return this.installFromDirectory(rootDir, path.resolve(sourcePath), {
      installation: options.installation ?? "AVAILABLE",
      authentication: options.authentication ?? "ON_INSTALL",
      force: options.force
    });
  }

  async createPlugin(
    rootDir: string,
    requestedName: string,
    options: PluginScaffoldOptions = {}
  ): Promise<PluginCreateResult> {
    const pluginName = this.normalizePluginName(requestedName);
    const pluginDir = path.join(rootDir, "plugins", pluginName);
    const manifestPath = path.join(pluginDir, ".codex-plugin", "plugin.json");
    const createdPaths: string[] = [];

    if ((await this.repo.exists(pluginDir)) && !options.force) {
      throw new PluginAlreadyExistsError(pluginName, pluginDir);
    }

    if (options.force) {
      await this.repo.remove(pluginDir);
    }

    const displayName = options.displayName?.trim() || humanizePluginName(pluginName);
    const description =
      options.description?.trim() || `[TODO: describe what ${displayName} does]`;
    const category = options.category?.trim() || "Productivity";
    const manifest = this.buildPlaceholderManifest(pluginName, {
      displayName,
      description,
      category,
      withSkills: options.withSkills,
      withHooks: options.withHooks,
      withScripts: options.withScripts,
      withAssets: options.withAssets
    });

    await this.repo.ensureDir(path.join(pluginDir, ".codex-plugin"));
    createdPaths.push(pluginDir, path.join(pluginDir, ".codex-plugin"));
    await this.repo.writeJson(manifestPath, manifest);
    createdPaths.push(manifestPath);

    const readmePath = path.join(pluginDir, "README.md");
    await this.repo.writeText(readmePath, this.buildPluginReadme(pluginName, displayName));
    createdPaths.push(readmePath);

    if (options.withSkills) {
      const skillDir = path.join(pluginDir, "skills", pluginName);
      await this.repo.ensureDir(skillDir);
      const skillPath = path.join(skillDir, "SKILL.md");
      await this.repo.writeText(skillPath, this.buildSkillPlaceholder(pluginName, displayName));
      createdPaths.push(skillDir, skillPath);
    }

    await this.createOptionalDirWithGitkeep(pluginDir, "hooks", options.withHooks, createdPaths);
    await this.createOptionalDirWithGitkeep(
      pluginDir,
      "scripts",
      options.withScripts,
      createdPaths
    );
    await this.createOptionalDirWithGitkeep(
      pluginDir,
      "assets",
      options.withAssets,
      createdPaths
    );

    if (options.withMcp) {
      const mcpPath = path.join(pluginDir, ".mcp.json");
      await this.repo.writeJson(mcpPath, {});
      createdPaths.push(mcpPath);
    }

    if (options.withApps) {
      const appPath = path.join(pluginDir, ".app.json");
      await this.repo.writeJson(appPath, {});
      createdPaths.push(appPath);
    }

    let marketplacePath: string | undefined;
    if (options.withMarketplace !== false) {
      const entry = this.createMarketplaceEntry(
        pluginName,
        category,
        options.installation ?? "AVAILABLE",
        options.authentication ?? "ON_INSTALL"
      );
      const marketplaceAlreadyExists = await this.repo.exists(this.getMarketplacePath(rootDir));
      marketplacePath = await this.upsertMarketplace(rootDir, entry);
      if (!marketplaceAlreadyExists) {
        createdPaths.push(marketplacePath);
      }
    }

    return {
      pluginName,
      pluginDir,
      manifestPath,
      marketplacePath,
      createdPaths
    };
  }

  private async installFromDirectory(
    rootDir: string,
    sourceDir: string,
    options: {
      installation: PluginInstallationPolicy;
      authentication: PluginAuthenticationPolicy;
      force?: boolean;
    }
  ): Promise<PluginInstallResult> {
    const manifest = await this.readManifest(sourceDir);
    const pluginName = this.normalizePluginName(manifest.name);
    const pluginDir = path.join(rootDir, "plugins", pluginName);
    const sourceDirResolved = path.resolve(sourceDir);
    const pluginDirResolved = path.resolve(pluginDir);

    if (sourceDirResolved !== pluginDirResolved) {
      if ((await this.repo.exists(pluginDir)) && !options.force) {
        throw new PluginAlreadyExistsError(pluginName, pluginDir);
      }

      if (options.force) {
        await this.repo.remove(pluginDir);
      }

      await this.repo.copyDir(sourceDirResolved, pluginDirResolved);
    } else if (!(await this.repo.exists(pluginDirResolved))) {
      throw new InvalidPluginSourceError(sourceDirResolved);
    }

    const entry = this.createMarketplaceEntry(
      pluginName,
      manifest.interface?.category || "Productivity",
      options.installation,
      options.authentication
    );
    const marketplacePath = await this.upsertMarketplace(rootDir, entry);

    return {
      pluginName,
      pluginDir,
      marketplacePath,
      sourcePath: sourceDirResolved,
      installation: entry.policy.installation,
      authentication: entry.policy.authentication
    };
  }

  private async createOptionalDirWithGitkeep(
    pluginDir: string,
    dirName: string,
    enabled: boolean | undefined,
    createdPaths: string[]
  ): Promise<void> {
    if (!enabled) {
      return;
    }

    const dirPath = path.join(pluginDir, dirName);
    const keepPath = path.join(dirPath, ".gitkeep");
    await this.repo.ensureDir(dirPath);
    await this.repo.writeText(keepPath, "");
    createdPaths.push(dirPath, keepPath);
  }

  private buildPlaceholderManifest(
    pluginName: string,
    options: {
      displayName: string;
      description: string;
      category: string;
      withSkills?: boolean;
      withHooks?: boolean;
      withScripts?: boolean;
      withAssets?: boolean;
    }
  ): PluginManifest {
    return {
      name: pluginName,
      version: "1.0.0",
      description: options.description,
      author: {
        name: "[TODO: author-name]"
      },
      homepage: "[TODO: homepage-url]",
      repository: "[TODO: repository-url]",
      license: "MIT",
      keywords: [pluginName, "codex", "workflow"],
      skills: options.withSkills ? "./skills/" : undefined,
      hooks: options.withHooks ? "./hooks/" : undefined,
      scripts: options.withScripts ? "./scripts/" : undefined,
      assets: options.withAssets ? "./assets/" : undefined,
      interface: {
        displayName: options.displayName,
        shortDescription: options.description,
        longDescription:
          "[TODO: explain when to use this plugin, what it can access, and what it should avoid.]",
        developerName: "[TODO: developer-name]",
        category: options.category,
        capabilities: ["Interactive", "Read"],
        websiteURL: "[TODO: website-url]",
        defaultPrompt: ["[TODO: add a starter prompt that demonstrates this plugin.]"],
        brandColor: "#157A6E"
      }
    };
  }

  private buildPluginReadme(pluginName: string, displayName: string): string {
    return [
      `# ${displayName}`,
      "",
      `\`${pluginName}\` is a repo-local Codex plugin scaffold created by \`oslite plugins create\`.`,
      "",
      "## Fill These Next",
      "",
      "- Replace the placeholder fields in `.codex-plugin/plugin.json`.",
      "- Add skills, hooks, scripts, assets, or MCP/app metadata as needed.",
      "- Keep `.agents/plugins/marketplace.json` in sync if you rename the plugin.",
      ""
    ].join("\n");
  }

  private buildSkillPlaceholder(pluginName: string, displayName: string): string {
    return [
      "---",
      `name: ${pluginName}`,
      `description: [TODO: explain when ${displayName} should be used]`,
      "---",
      "",
      `# ${displayName}`,
      "",
      "## Intent",
      "",
      "[TODO: describe the workflow, guardrails, and preferred tool choices.]",
      "",
      "## Steps",
      "",
      "1. [TODO: add the first step.]",
      "2. [TODO: add the second step.]",
      ""
    ].join("\n");
  }

  private async readManifest(pluginDir: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginDir, ".codex-plugin", "plugin.json");
    if (!(await this.repo.exists(manifestPath))) {
      throw new InvalidPluginSourceError(pluginDir);
    }

    const manifest = await this.repo.readJson<Partial<PluginManifest>>(manifestPath);
    if (!manifest || typeof manifest.name !== "string" || manifest.name.length === 0) {
      throw new InvalidPluginSourceError(pluginDir);
    }

    return manifest as PluginManifest;
  }

  private createMarketplaceEntry(
    pluginName: string,
    category: string,
    installation: PluginInstallationPolicy,
    authentication: PluginAuthenticationPolicy
  ): PluginMarketplaceEntry {
    return {
      name: pluginName,
      source: {
        source: "local",
        path: `./plugins/${pluginName}`
      },
      policy: {
        installation,
        authentication
      },
      category
    };
  }

  private async upsertMarketplace(
    rootDir: string,
    entry: PluginMarketplaceEntry
  ): Promise<string> {
    const marketplacePath = this.getMarketplacePath(rootDir);
    const fallbackName = normalizeMarketplaceName(path.basename(rootDir));
    const existing =
      (await this.readMarketplace(rootDir)) ?? {
        name: `${fallbackName}-repo`,
        interface: {
          displayName: `${path.basename(rootDir)} Plugins`
        },
        plugins: []
      };

    const plugins = [...existing.plugins];
    const existingIndex = plugins.findIndex((item) => item.name === entry.name);
    if (existingIndex >= 0) {
      plugins.splice(existingIndex, 1, entry);
    } else {
      plugins.push(entry);
    }

    await this.repo.writeJson(marketplacePath, {
      name: existing.name,
      interface: {
        displayName: existing.interface?.displayName || `${path.basename(rootDir)} Plugins`
      },
      plugins
    } satisfies PluginMarketplace);
    return marketplacePath;
  }

  private async readMarketplace(rootDir: string): Promise<PluginMarketplace | null> {
    const marketplacePath = this.getMarketplacePath(rootDir);
    if (!(await this.repo.exists(marketplacePath))) {
      return null;
    }
    return this.repo.readJson<PluginMarketplace>(marketplacePath);
  }

  private getMarketplacePath(rootDir: string): string {
    return path.join(rootDir, ".agents", "plugins", "marketplace.json");
  }

  private normalizePluginName(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!normalized || normalized.length > MAX_PLUGIN_NAME_LENGTH) {
      throw new InvalidPluginNameError(value);
    }

    return normalized;
  }
}

function humanizePluginName(pluginName: string): string {
  return pluginName
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeMarketplaceName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "repo";
}

export function findBundledPlugin(
  pluginName: string
): BundledPluginDefinition | undefined {
  return BUNDLED_PLUGIN_DEFINITIONS.find((item) => item.name === pluginName);
}
