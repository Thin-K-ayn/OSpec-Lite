#!/usr/bin/env node

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const cliPath = path.join(rootDir, "dist", "cli", "index.js");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: "utf8",
    shell: false
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (result.error) {
    throw new Error(
      `Command failed to start: ${command} ${args.join(" ")}\n${result.error.message}`
    );
  }
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${output}`);
  }
  return result.stdout.trim();
}

function runNpm(args) {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", "npm", ...args]);
  }
  return run("npm", args);
}

function assertContains(output, expected, label) {
  if (!output.includes(expected)) {
    throw new Error(`Expected ${label} to include "${expected}"\nActual:\n${output}`);
  }
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Expected ${label} to be JSON\n${String(error)}\nActual:\n${output}`);
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oslite release smoke "));
  const projectDir = path.join(tempRoot, "project with spaces");

  try {
    await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
    await fs.writeFile(path.join(projectDir, "README.md"), "# Smoke Project\n", "utf8");
    await fs.writeFile(path.join(projectDir, "src", "main.ts"), "export const value = 1;\n", "utf8");

    let output = run(process.execPath, [cliPath]);
    assertContains(output, "oslite <command>", "root help");

    output = run(process.execPath, [cliPath, "init", projectDir]);
    assertContains(output, "repository initialized", "init output");

    const statusJson = parseJson(
      run(process.execPath, [cliPath, "status", projectDir, "--json"]),
      "status --json"
    );
    if (!statusJson.ok || statusJson.status.state !== "initialized") {
      throw new Error(`Unexpected status JSON:\n${JSON.stringify(statusJson, null, 2)}`);
    }

    const updateJson = parseJson(
      run(process.execPath, [cliPath, "update", projectDir, "--dry-run", "--json"]),
      "update --dry-run --json"
    );
    if (!updateJson.ok || updateJson.result.dryRun !== true) {
      throw new Error(`Unexpected update JSON:\n${JSON.stringify(updateJson, null, 2)}`);
    }

    const changeJson = parseJson(
      run(process.execPath, [cliPath, "change", "new", "release-smoke", projectDir, "--json"]),
      "change new --json"
    );
    const changeDir = changeJson.changePath;
    const changeRecordPath = path.join(changeDir, "change.json");
    const changeRecord = JSON.parse(await fs.readFile(changeRecordPath, "utf8"));
    changeRecord.affects = ["src/main.ts"];
    await writeJson(changeRecordPath, changeRecord);
    await fs.writeFile(
      path.join(changeDir, "request.md"),
      "# Request\n\n## Request\n\n- Change: `release-smoke`\n- Summary: Smoke-test change lifecycle.\n\n## Scope\n\n- In Scope: CLI lifecycle smoke.\n- Out Of Scope: Product behavior.\n\n## Acceptance Notes\n\n- Acceptance: Lifecycle commands pass.\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(changeDir, "plan.md"),
      "# Plan\n\n## Implementation Plan\n\n- Change: `release-smoke`\n- Summary: Exercise the CLI lifecycle.\n\n## Files Or Modules Expected To Change\n\n- Target: src/main.ts\n\n## Risks\n\n- Risk: none\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(changeDir, "apply.md"),
      "# Apply\n\n## Applied Changes\n\n- Change: `release-smoke`\n- Summary: Recorded the smoke lifecycle.\n\n## Files Touched\n\n- File: src/main.ts - smoke fixture path\n\n## Deviations From Plan\n\n- Deviation: none\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(changeDir, "verify.md"),
      "# Verify\n\n## Automated Checks\n\n- Change: `release-smoke`\n- Command: node --version\n- Result: `node --version` passed.\n\n## Manual Validation\n\n- Validation: Smoke script verified command output.\n\n## Remaining Risks\n\n- Risk: none\n",
      "utf8"
    );
    run(process.execPath, [cliPath, "change", "apply", changeDir, "--json"]);
    run(process.execPath, [cliPath, "change", "verify", changeDir, "--json"]);

    const bugJson = parseJson(
      run(process.execPath, [cliPath, "bug", "new", "release smoke bug", projectDir, "--json"]),
      "bug new --json"
    );
    if (!bugJson.bugId) {
      throw new Error("Bug JSON did not include bugId.");
    }

    const reportJson = parseJson(
      run(process.execPath, [cliPath, "report", projectDir, "--cadence", "daily", "--json"]),
      "report --json"
    );
    if (!reportJson.ok || reportJson.report.reportWindow.cadence !== "daily") {
      throw new Error(`Unexpected report JSON:\n${JSON.stringify(reportJson, null, 2)}`);
    }

    output = runNpm(["pack", "--dry-run", "--json", "--ignore-scripts"]);
    const pack = parseJson(output, "npm pack --dry-run --json");
    const packedFiles = new Set((pack[0]?.files ?? []).map((file) => file.path));
    if (!packedFiles.has("dist/cli/index.js")) {
      throw new Error("Package dry-run did not include dist/cli/index.js");
    }
    if (!packedFiles.has("docs/upgrade-roadmap.md")) {
      throw new Error("Package dry-run did not include docs/upgrade-roadmap.md");
    }

    console.log("[release:smoke] passed");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
