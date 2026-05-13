#!/usr/bin/env node

import { createCliServices } from "./cli-services";
import { reportCliError } from "./cli-error-handler";
import { handleInit } from "./commands/init";
import { handleStatus } from "./commands/status";
import { handleRefresh } from "./commands/refresh";
import { handleReport } from "./commands/report";
import { handleChange } from "./commands/change";
import { handleBug } from "./commands/bug";
import { handleDocs } from "./commands/docs";
import { handlePlugins } from "./commands/plugins";
import { handleUpdate } from "./commands/update";
import { handleProfiles } from "./commands/profiles";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;
  const services = createCliServices();

  switch (command) {
    case "init":
      await handleInit(rest, services);
      return;
    case "status":
      await handleStatus(rest, services);
      return;
    case "refresh":
      await handleRefresh(rest, services);
      return;
    case "update":
      await handleUpdate(rest, services);
      return;
    case "report":
      await handleReport(rest, services);
      return;
    case "change":
      await handleChange(rest, services);
      return;
    case "bug":
      await handleBug(rest, services);
      return;
    case "docs":
      await handleDocs(rest, services);
      return;
    case "profiles":
      await handleProfiles(rest, services);
      return;
    case "plugins":
      await handlePlugins(rest, services);
      return;
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`oslite <command>

Commands:
  oslite init [path] [--document-language en-US|zh-CN] [--profile <profile-id>] [--project-name <name>] [--bootstrap-agent codex|claude-code|none]
  oslite status [path]
  oslite refresh [path]
  oslite update [path] [--dry-run] [--json]
  oslite report [path] [--cadence daily|weekly]
  oslite report write [path] [--cadence daily|weekly]
  oslite report schedule [path] [--cadence daily|weekly]
  oslite report run [path] [--force]
  oslite bug new <title> [path]
  oslite bug fix <bug-id> [path]
  oslite bug apply <bug-id> [path]
  oslite bug reopen <bug-id> [path]
  oslite docs verify [path]
  oslite profiles list [--json]
  oslite profiles info <profile-id> [--json]
  oslite profiles validate <profile-id|all> [--json]
  oslite plugins list [path]
  oslite plugins info <plugin-name> [path] [--json]
  oslite plugins doctor [plugin-name] [path] [--json]
  oslite plugins install <plugin-name|plugin-path> [path] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
  oslite plugins install-defaults [path] [--force]
  oslite plugins create <plugin-name> [path] [--display-name <name>] [--description <text>] [--category <category>] [--with-skills] [--with-hooks] [--with-scripts] [--with-assets] [--with-mcp] [--with-apps] [--no-marketplace] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
  oslite change new <slug> [path]
  oslite change apply <change-path>
  oslite change verify <change-path>
  oslite change archive <change-path>`);
}

main().catch((error) => {
  reportCliError(error, { json: process.argv.slice(2).includes("--json") });
});
