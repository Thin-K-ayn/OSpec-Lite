import * as path from "node:path";
import {
  OSpecLiteWorkReport,
  ReportArtifact,
  ReportAutomationRunResult,
  ReportAutomationScheduleResult,
  ReportCadence
} from "../../core/ospec-lite-types";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";
import { printPathList, readFlagValue } from "../cli-shared";

export async function handleReport(args: string[], services: CliServices): Promise<void> {
  const [action, ...rest] = args;

  switch (action) {
    case "write": {
      const { pathArg, cadence } = parseReportArgs(rest);
      const targetDir = path.resolve(pathArg);
      const artifact = await services.reportService.emitReportArtifact(targetDir, cadence);
      printReportArtifact(artifact);
      return;
    }
    case "schedule": {
      const { pathArg, cadence } = parseReportArgs(rest);
      const targetDir = path.resolve(pathArg);
      const result = await services.reportService.scheduleAutomation(targetDir, cadence);
      printAutomationSchedule(result);
      return;
    }
    case "run": {
      const { pathArg, force } = parseReportRunArgs(rest);
      const targetDir = path.resolve(pathArg);
      const result = await services.reportService.runAutomation(targetDir, { force });
      printAutomationRun(result);
      return;
    }
    default:
      break;
  }

  const { pathArg, cadence } = parseReportArgs(args);
  const targetDir = path.resolve(pathArg);
  const report = await services.reportService.report(targetDir, cadence);

  printWorkReport(report);
}

export function parseReportArgs(args: string[]): {
  pathArg: string;
  cadence: ReportCadence;
} {
  let pathArg: string | undefined;
  let cadence: ReportCadence = "weekly";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--cadence") {
      const next = readFlagValue(args, index, "--cadence");
      cadence = parseReportCadence(next.value);
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--cadence=")) {
      cadence = parseReportCadence(arg.slice("--cadence=".length));
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
    cadence
  };
}

function parseReportRunArgs(args: string[]): {
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

function parseReportCadence(value: string): ReportCadence {
  if (value === "daily" || value === "weekly") {
    return value;
  }
  throw new OSpecLiteError(`Unsupported report cadence: ${value}`);
}

function printReportArtifact(artifact: ReportArtifact): void {
  console.log("OSpec Lite report artifact written");
  console.log(`Path: ${artifact.rootDir}`);
  console.log(`Cadence: ${artifact.cadence}`);
  console.log(`Period: ${artifact.period}`);
  console.log(`Markdown: ${artifact.artifactPath}`);
  console.log(`JSON: ${artifact.dataPath}`);
  console.log(`Generated at: ${artifact.generatedAt}`);
}

function printAutomationSchedule(result: ReportAutomationScheduleResult): void {
  console.log("OSpec Lite report automation scheduled");
  console.log(`Path: ${result.rootDir}`);
  console.log(`Cadence: ${result.schedule.cadence}`);
  console.log(`Schedule: ${result.schedulePath}`);
  console.log(`Artifact root: ${result.schedule.artifactRoot}`);
  console.log(`Next run at: ${result.schedule.nextRunAt}`);
  console.log("Runner: oslite report run [path]");
}

function printAutomationRun(result: ReportAutomationRunResult): void {
  console.log("OSpec Lite report automation run");
  console.log(`Path: ${result.rootDir}`);
  console.log(`Schedule: ${result.schedulePath}`);
  console.log(`Generated: ${result.generated ? "yes" : "no"}`);
  if (result.reason) {
    console.log(`Reason: ${result.reason}`);
  }
  if (result.artifact) {
    console.log(`Cadence: ${result.artifact.cadence}`);
    console.log(`Period: ${result.artifact.period}`);
    console.log(`Markdown: ${result.artifact.artifactPath}`);
    console.log(`JSON: ${result.artifact.dataPath}`);
    console.log(`Generated at: ${result.artifact.generatedAt}`);
  }
  console.log(`Next run at: ${result.schedule.nextRunAt}`);
}

function printWorkReport(report: OSpecLiteWorkReport): void {
  console.log("OSpec Lite Work Report");
  console.log(`Path: ${report.rootDir}`);
  console.log(`State: ${report.state}`);
  if (report.projectName) {
    console.log(`Project: ${report.projectName}`);
  }
  if (report.profileId) {
    console.log(`Profile: ${report.profileId}`);
  }
  if (report.bootstrapAgent) {
    console.log(`Bootstrap agent: ${report.bootstrapAgent}`);
  }
  console.log(`Cadence: ${report.reportWindow.cadence}`);
  console.log(`Window: last ${report.reportWindow.lookbackDays} day(s)`);
  console.log(`Generated at: ${report.generatedAt}`);

  printChangeSummary("Completed changes this period", report.recentArchivedChanges);
  printChangeSummary("Open changes now", report.activeChanges);
  printBugSummary("Resolved bugs this period", report.recentAppliedBugs);
  printBugSummary("Open bugs now", report.activeBugs);
  printPathList("Docs needing review now", report.reviewNeededDocs);
  printPathList("Initialized doc suggestion baselines", report.baselineInitializedDocs);
}

function printChangeSummary(label: string, items: OSpecLiteWorkReport["activeChanges"]): void {
  console.log(`${label}: ${items.length}`);
  if (items.length === 0) {
    console.log("- (none)");
    return;
  }

  for (const item of items) {
    const affects = item.affects.length > 0 ? item.affects.join(", ") : "(not recorded)";
    console.log(`- ${item.slug} [${item.status}; ${item.updatedAt}; ${item.path}]`);
    console.log(`  affects: ${affects}`);
  }
}

function printBugSummary(label: string, items: OSpecLiteWorkReport["activeBugs"]): void {
  console.log(`${label}: ${items.length}`);
  if (items.length === 0) {
    console.log("- (none)");
    return;
  }

  for (const item of items) {
    const affects = item.affects.length > 0 ? item.affects.join(", ") : "(not recorded)";
    console.log(`- ${item.id}: ${item.title} [${item.status}; ${item.updatedAt}]`);
    console.log(`  affects: ${affects}`);
  }
}
