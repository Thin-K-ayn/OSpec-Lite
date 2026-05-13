import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { UpdateResult } from "../../core/ospec-lite-types";
import { CliServices } from "../cli-services";
import { printJson, printPathList, takeJsonFlag } from "../cli-shared";

export async function handleUpdate(args: string[], services: CliServices): Promise<void> {
  const parsed = takeJsonFlag(args);
  const { pathArg, dryRun } = parseUpdateArgs(parsed.args);
  const targetDir = path.resolve(pathArg);
  const result = await services.updateService.update(targetDir, { dryRun });

  if (parsed.json) {
    printJson({ ok: true, result });
    return;
  }

  printUpdateResult(result);
}

function parseUpdateArgs(args: string[]): {
  pathArg: string;
  dryRun: boolean;
} {
  let pathArg: string | undefined;
  let dryRun = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
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
    dryRun
  };
}

function printUpdateResult(result: UpdateResult): void {
  console.log(result.dryRun ? "OSpec Lite update dry run" : "OSpec Lite updated");
  console.log(`Path: ${result.rootDir}`);
  console.log(`State before: ${result.stateBefore}`);
  console.log(`State after: ${result.stateAfter}`);

  console.log("Actions:");
  if (result.actions.length === 0) {
    console.log("- (none)");
  } else {
    for (const action of result.actions) {
      console.log(`- ${action.status}: ${action.kind} ${action.path}`);
      console.log(`  reason: ${action.reason}`);
    }
  }

  printPathList("Human-owned docs needing review", result.reviewNeededDocs);
  printPathList("Initialized doc suggestion baselines", result.baselineInitializedDocs);

  if (result.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }
}
