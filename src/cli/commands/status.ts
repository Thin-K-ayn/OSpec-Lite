import * as path from "node:path";
import { CliServices } from "../cli-services";
import { isCompleteStatusConfig, printAgentWrappers } from "../cli-shared";

export async function handleStatus(args: string[], services: CliServices): Promise<void> {
  const targetDir = path.resolve(args[0] ?? ".");
  const status = await services.statusService.getStatus(targetDir);

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
