import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";

export async function handleBug(args: string[], services: CliServices): Promise<void> {
  const [action, ...rest] = args;
  switch (action) {
    case "new": {
      const title = rest[0];
      if (!title) {
        throw new OSpecLiteError("Missing bug title.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      const bugId = await services.bugService.newBug(targetDir, title);
      console.log(`Created bug: ${bugId}`);
      console.log("Active bugs: .oslite/bugs/active-bugs.md");
      return;
    }
    case "fix": {
      const bugId = rest[0];
      if (!bugId) {
        throw new OSpecLiteError("Missing bug id.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      await services.bugService.markFixed(targetDir, bugId);
      console.log(`Marked fixed: ${bugId}`);
      return;
    }
    case "apply": {
      const bugId = rest[0];
      if (!bugId) {
        throw new OSpecLiteError("Missing bug id.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      await services.bugService.apply(targetDir, bugId);
      console.log(`Applied bug: ${bugId}`);
      console.log("Updated bug memory: .oslite/docs/project/bug-memory.md");
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported bug action: ${action ?? "(missing)"}`);
  }
}
