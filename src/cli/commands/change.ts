import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";

export async function handleChange(args: string[], services: CliServices): Promise<void> {
  const [action, ...rest] = args;
  switch (action) {
    case "new": {
      const slug = rest[0];
      if (!slug) {
        throw new OSpecLiteError("Missing change slug.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      const changeDir = await services.changeService.newChange(targetDir, slug);
      console.log(`Created change: ${changeDir}`);
      return;
    }
    case "apply": {
      const changePath = path.resolve(rest[0] ?? ".");
      await services.changeService.markApplied(changePath);
      console.log(`Marked applied: ${changePath}`);
      return;
    }
    case "verify": {
      const changePath = path.resolve(rest[0] ?? ".");
      await services.changeService.markVerified(changePath);
      console.log(`Marked verified: ${changePath}`);
      return;
    }
    case "archive": {
      const changePath = path.resolve(rest[0] ?? ".");
      const archivePath = await services.changeService.archive(changePath);
      console.log(`Archived change to: ${archivePath}`);
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported change action: ${action ?? "(missing)"}`);
  }
}
