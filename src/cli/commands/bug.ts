import * as path from "node:path";
import { OSpecLiteError } from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";
import { printJson, takeJsonFlag } from "../cli-shared";

export async function handleBug(args: string[], services: CliServices): Promise<void> {
  const parsed = takeJsonFlag(args);
  const [action, ...rest] = parsed.args;
  switch (action) {
    case "new": {
      const title = rest[0];
      if (!title) {
        throw new OSpecLiteError("Missing bug title.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      const bugId = await services.bugService.newBug(targetDir, title);
      if (parsed.json) {
        printJson({
          ok: true,
          action: "new",
          bugId,
          title,
          rootDir: targetDir,
          activeBugsPath: ".oslite/bugs/active-bugs.md"
        });
        return;
      }
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
      if (parsed.json) {
        printJson({ ok: true, action: "fix", bugId, rootDir: targetDir });
        return;
      }
      console.log(`Marked fixed: ${bugId}`);
      return;
    }
    case "apply": {
      const bugId = rest[0];
      if (!bugId) {
        throw new OSpecLiteError("Missing bug id.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      const memoryPath = await services.bugService.apply(targetDir, bugId);
      if (parsed.json) {
        printJson({ ok: true, action: "apply", bugId, rootDir: targetDir, memoryPath });
        return;
      }
      console.log(`Applied bug: ${bugId}`);
      console.log("Updated bug memory: .oslite/docs/project/bug-memory.md");
      return;
    }
    case "reopen": {
      const bugId = rest[0];
      if (!bugId) {
        throw new OSpecLiteError("Missing bug id.");
      }
      const targetDir = path.resolve(rest[1] ?? ".");
      await services.bugService.reopenBug(targetDir, bugId);
      if (parsed.json) {
        printJson({ ok: true, action: "reopen", bugId, rootDir: targetDir });
        return;
      }
      console.log(`Reopened bug: ${bugId}`);
      console.log("Restored to active bugs: .oslite/bugs/active-bugs.md");
      return;
    }
    default:
      throw new OSpecLiteError(`Unsupported bug action: ${action ?? "(missing)"}`);
  }
}
