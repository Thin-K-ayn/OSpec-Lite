export type PluginInstallationPolicy =
  | "NOT_AVAILABLE"
  | "AVAILABLE"
  | "INSTALLED_BY_DEFAULT";

export type PluginAuthenticationPolicy = "ON_INSTALL" | "ON_USE";

export interface PluginManifestAuthor {
  name: string;
  url?: string;
}

export interface PluginManifestInterface {
  displayName: string;
  shortDescription: string;
  longDescription: string;
  developerName: string;
  category: string;
  capabilities: string[];
  websiteURL?: string;
  defaultPrompt?: string[];
  brandColor?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: PluginManifestAuthor;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  skills?: string;
  hooks?: string;
  scripts?: string;
  assets?: string;
  interface: PluginManifestInterface;
}

export interface PluginMarketplaceEntry {
  name: string;
  source: {
    source: "local";
    path: string;
  };
  policy: {
    installation: PluginInstallationPolicy;
    authentication: PluginAuthenticationPolicy;
  };
  category: string;
}

export interface PluginMarketplace {
  name: string;
  interface: {
    displayName: string;
  };
  plugins: PluginMarketplaceEntry[];
}

export interface BundledPluginDefinition {
  name: string;
  sourceDir: string;
  category: string;
  installation: PluginInstallationPolicy;
  authentication: PluginAuthenticationPolicy;
  summary: string;
}

export interface PluginScaffoldOptions {
  displayName?: string;
  description?: string;
  category?: string;
  installation?: PluginInstallationPolicy;
  authentication?: PluginAuthenticationPolicy;
  withMarketplace?: boolean;
  withSkills?: boolean;
  withHooks?: boolean;
  withScripts?: boolean;
  withAssets?: boolean;
  withMcp?: boolean;
  withApps?: boolean;
  force?: boolean;
}

export interface PluginCreateResult {
  pluginName: string;
  pluginDir: string;
  manifestPath: string;
  marketplacePath?: string;
  createdPaths: string[];
}

export interface PluginInstallResult {
  pluginName: string;
  pluginDir: string;
  marketplacePath: string;
  sourcePath: string;
  installation: PluginInstallationPolicy;
  authentication: PluginAuthenticationPolicy;
}

export interface PluginListReport {
  marketplacePath: string;
  marketplaceExists: boolean;
  bundledPlugins: BundledPluginDefinition[];
  installedPlugins: PluginMarketplaceEntry[];
}
