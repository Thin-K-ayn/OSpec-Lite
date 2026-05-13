import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { ProfileValidationReport } from "../../core/ospec-lite-types";
import { CliServices } from "../cli-services";
import { printJson, takeJsonFlag } from "../cli-shared";

export async function handleProfiles(args: string[], services: CliServices): Promise<void> {
  const parsed = takeJsonFlag(args);
  const [action, ...rest] = parsed.args;

  switch (action) {
    case "list": {
      const profiles = await services.profileService.listProfiles();
      if (parsed.json) {
        printJson({ ok: true, profiles });
        return;
      }
      console.log("OSpec Lite Profiles");
      for (const profile of profiles) {
        console.log(`- ${profile.id} [${profile.documentLanguage}] - ${profile.description}`);
      }
      return;
    }
    case "info": {
      const profileId = rest[0];
      if (!profileId) {
        throw new OSpecLiteError("Missing profile id.");
      }
      const profile = await services.profileService.getProfile(profileId);
      if (parsed.json) {
        printJson({ ok: true, profile });
        return;
      }
      console.log(`Profile: ${profile.id}`);
      console.log(`Name: ${profile.displayName}`);
      console.log(`Description: ${profile.description}`);
      console.log(`Language: ${profile.documentLanguage}`);
      console.log(`Profile JSON: ${profile.profileJsonPath}`);
      console.log("Required repo paths:");
      for (const repoPath of profile.requiredRepoPaths ?? []) {
        console.log(`- ${repoPath}`);
      }
      console.log("Outputs:");
      for (const output of profile.outputs) {
        console.log(`- ${output}`);
      }
      return;
    }
    case "validate": {
      const profileId = rest[0];
      if (!profileId) {
        throw new OSpecLiteError("Missing profile id or `all`.");
      }
      const reports =
        profileId === "all"
          ? await services.profileService.validateAllProfiles()
          : [await services.profileService.validateProfile(profileId)];
      if (parsed.json) {
        printJson({ ok: reports.every((report) => report.valid), reports });
        return;
      }
      printValidationReports(reports);
      if (reports.some((report) => !report.valid)) {
        process.exitCode = 1;
      }
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported profiles action: ${action ?? "(missing)"}`);
  }
}

function printValidationReports(reports: ProfileValidationReport[]): void {
  console.log("OSpec Lite profile validation");
  for (const report of reports) {
    console.log(`- ${report.profileId}: ${report.valid ? "valid" : "invalid"}`);
    if (report.issues.length > 0) {
      for (const issue of report.issues) {
        console.log(`  - ${issue.file}: ${issue.message}`);
      }
    }
  }
}
