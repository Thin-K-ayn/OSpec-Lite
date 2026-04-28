import * as path from "node:path";
import { CliServices } from "../cli-services";
import { printPathList } from "../cli-shared";

export async function handleRefresh(args: string[], services: CliServices): Promise<void> {
  const targetDir = path.resolve(args[0] ?? ".");
  const report = await services.refreshService.refresh(targetDir);

  console.log("OSpec Lite refreshed");
  console.log(`Path: ${targetDir}`);
  printPathList("Updated machine-managed artifacts", report.updatedArtifacts);
  printPathList("Human-owned docs needing review", report.reviewNeededDocs);
  printPathList("Initialized doc suggestion baselines", report.baselineInitializedDocs);
  if (report.baselineInitializedDocs.length > 0) {
    console.log("Future refresh runs will flag these docs when the generated suggestion changes.");
  }
}
