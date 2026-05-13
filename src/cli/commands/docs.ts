import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";
import { printJson, takeJsonFlag } from "../cli-shared";

export async function handleDocs(args: string[], services: CliServices): Promise<void> {
  const parsed = takeJsonFlag(args);
  const [action, ...rest] = parsed.args;
  switch (action) {
    case "verify": {
      const targetDir = path.resolve(rest[0] ?? ".");
      const report = await services.docVerifier.verify(targetDir);
      if (parsed.json) {
        printJson({ ok: true, report });
        return;
      }
      console.log("OSpec Lite docs verification passed");
      console.log(`Profile: ${report.profileId}`);
      console.log(`Checklist: ${report.checklistPath}`);
      console.log("Checked files:");
      for (const filePath of report.checkedFiles) {
        console.log(`- ${filePath}`);
      }
      if (report.repoChecks && report.repoChecks.length > 0) {
        console.log("Repository checks:");
        for (const check of report.repoChecks) {
          console.log(`- ${check.status}: ${check.id} - ${check.message}`);
        }
      }
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported docs action: ${action ?? "(missing)"}`);
  }
}
