import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";
import { printJson, takeJsonFlag } from "../cli-shared";

export async function handleChange(args: string[], services: CliServices): Promise<void> {
  const parsed = takeJsonFlag(args);
  const [action, ...rest] = parsed.args;
  switch (action) {
    case "new": {
      const slug = rest[0];
      if (!slug) {
        throw new OSpecLiteError("Missing change slug.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      const changeDir = await services.changeService.newChange(targetDir, slug);
      if (parsed.json) {
        printJson({ ok: true, action: "new", slug, rootDir: targetDir, changePath: changeDir });
        return;
      }
      console.log(`Created change: ${changeDir}`);
      return;
    }
    case "apply": {
      const changePath = path.resolve(rest[0] ?? ".");
      await services.changeService.markApplied(changePath);
      if (parsed.json) {
        printJson({ ok: true, action: "apply", changePath });
        return;
      }
      console.log(`Marked applied: ${changePath}`);
      return;
    }
    case "verify": {
      const changePath = path.resolve(rest[0] ?? ".");
      await services.changeService.markVerified(changePath);
      if (parsed.json) {
        printJson({ ok: true, action: "verify", changePath });
        return;
      }
      console.log(`Marked verified: ${changePath}`);
      return;
    }
    case "archive": {
      const changePath = path.resolve(rest[0] ?? ".");
      const archivePath = await services.changeService.archive(changePath);
      if (parsed.json) {
        printJson({ ok: true, action: "archive", changePath, archivePath });
        return;
      }
      console.log(`Archived change to: ${archivePath}`);
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported change action: ${action ?? "(missing)"}`);
  }
}
