import * as path from "node:path";
import { BundledPluginDefinition } from "./ospec-lite-plugin-types";

function bundledPluginDir(pluginName: string): string {
  return path.resolve(__dirname, "..", "..", "plugins", pluginName);
}

export const BUNDLED_PLUGIN_DEFINITIONS: BundledPluginDefinition[] = [
  {
    name: "ospec-lite-codex",
    sourceDir: bundledPluginDir("ospec-lite-codex"),
    category: "Productivity",
    installation: "INSTALLED_BY_DEFAULT",
    authentication: "ON_INSTALL",
    summary: "Codex companion workflow for repositories that use OSpec Lite."
  }
];
