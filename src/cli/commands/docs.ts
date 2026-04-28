import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";

export async function handleDocs(args: string[], services: CliServices): Promise<void> {
  const [action, ...rest] = args;
  switch (action) {
    case "verify": {
      const targetDir = path.resolve(rest[0] ?? ".");
      const report = await services.docVerifier.verify(targetDir);
      console.log("OSpec Lite docs verification passed");
      console.log(`Profile: ${report.profileId}`);
      console.log(`Checklist: ${report.checklistPath}`);
      console.log("Checked files:");
      for (const filePath of report.checkedFiles) {
        console.log(`- ${filePath}`);
      }
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported docs action: ${action ?? "(missing)"}`);
  }
}
