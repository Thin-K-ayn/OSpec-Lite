const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { FileRepo } = require("../dist/fs/file-repo.js");
const { ScanService } = require("../dist/init/ospec-lite-scan-service.js");
const { MarkdownRenderer } = require("../dist/render/ospec-lite-markdown-renderer.js");
const { AgentEntryService } = require("../dist/agents/ospec-lite-agent-entry-service.js");
const { CodexAdapter } = require("../dist/agents/ospec-lite-codex-adapter.js");
const { ClaudeCodeAdapter } = require("../dist/agents/ospec-lite-claude-code-adapter.js");
const { IndexService } = require("../dist/init/ospec-lite-index-service.js");
const { InitService } = require("../dist/init/ospec-lite-init-service.js");
const { StatusService } = require("../dist/status/ospec-lite-status-service.js");
const { ChangeService } = require("../dist/change/ospec-lite-change-service.js");
const { BugService } = require("../dist/bug/ospec-lite-bug-service.js");
const { ProfileLoader } = require("../dist/profile/ospec-lite-profile-loader.js");
const {
  BUG_INDEX_PATH,
  BUG_ACTIVE_BUGS_PATH,
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
  BUG_MEMORY_PATH,
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START,
  INIT_MARKERS
} = require("../dist/core/ospec-lite-schema.js");
const {
  InvalidChangeSlugError,
  OSpecLiteError
} = require("../dist/core/ospec-lite-errors.js");

const CLI_PATH = path.resolve(__dirname, "../dist/cli/index.js");

test("init bootstraps the repository knowledge layer", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-init-");
  await seedRepo(rootDir);

  const { repo, initService, statusService } = createServices();
  const result = await initService.init(rootDir, { documentLanguage: "zh-CN" });

  assert.equal(result.state, "initialized");

  for (const marker of INIT_MARKERS) {
    const markerPath = path.join(rootDir, marker);
    assert.equal(await repo.exists(markerPath), true, `missing init marker: ${marker}`);
  }

  const config = await repo.readJson(path.join(rootDir, ".oslite", "config.json"));
  assert.equal(config.documentLanguage, "zh-CN");
  assert.deepEqual(config.agentTargets, ["codex", "claude-code"]);

  const agents = await repo.readText(path.join(rootDir, "AGENTS.md"));
  const claude = await repo.readText(path.join(rootDir, "CLAUDE.md"));
  const overview = await repo.readText(path.join(rootDir, ".oslite", "docs", "project", "overview.md"));
  const quickstart = await repo.readText(
    path.join(rootDir, ".oslite", "docs", "agents", "quickstart.md")
  );

  assert.match(overview, /Project Overview/);
  assert.match(quickstart, /How To Report Work/);
  assert.match(quickstart, /oslite report write \. --cadence daily\|weekly/);
  assert.match(quickstart, /oslite report run \./);
  assert.ok(agents.includes(AGENTS_MANAGED_START));
  assert.ok(claude.includes(CLAUDE_MANAGED_START));
  assert.ok(claude.includes("@AGENTS.md"));
  assert.equal(
    await repo.exists(path.join(rootDir, ".oslite", "docs", "agents", "bug-playbook.md")),
    true
  );
  assert.equal(await repo.exists(path.join(rootDir, BUG_MEMORY_PATH)), true);
  assert.equal(await repo.exists(path.join(rootDir, BUG_ACTIVE_BUGS_PATH)), true);

  const status = await statusService.getStatus(rootDir);
  assert.equal(status.state, "initialized");
  assert.equal(status.activeChanges.length, 0);
  assert.equal(status.archivedChanges.length, 0);
  assert.equal(status.activeBugs.length, 0);
  assert.equal(status.appliedBugs.length, 0);
});

test("cli init is one-shot and preserves human edits on rerun", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-rerun-");
  await seedRepo(rootDir);

  const first = runCli(["init", rootDir]);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /repository initialized/i);

  const overviewPath = path.join(rootDir, ".oslite", "docs", "project", "overview.md");
  const customOverview = "# Custom Overview\n\nThis file was edited by a human.\n";
  await fs.writeFile(overviewPath, customOverview, "utf8");

  const second = runCli(["init", rootDir]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already initialized/i);
  assert.match(second.stdout, /Agent targets: codex, claude-code/);
  assert.match(second.stdout, /Agent entry files:/);
  assert.match(second.stdout, /- codex: AGENTS\.md/);
  assert.match(second.stdout, /- claude-code: CLAUDE\.md/);
  assert.match(second.stdout, /Project docs: \.oslite\/docs\/project/);
  assert.match(second.stdout, /Changes root: \.oslite\/changes/);

  const after = await fs.readFile(overviewPath, "utf8");
  assert.equal(after, customOverview);
});

test("cli init fails clearly when initialization is incomplete", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-incomplete-");
  await fs.mkdir(path.join(rootDir, ".oslite"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, ".oslite", "config.json"),
    "{}\n",
    "utf8"
  );

  const result = runCli(["init", rootDir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /initialization incomplete/i);
  assert.match(result.stderr, /\.oslite\/index\.json/i);
});

test("cli prints help when no command is provided", () => {
  const result = runCli([]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^oslite <command>/m);
  assert.match(result.stdout, /oslite status \[path]/);
  assert.match(result.stdout, /oslite refresh \[path]/);
  assert.match(result.stdout, /oslite report \[path] \[--cadence daily\|weekly]/);
  assert.match(result.stdout, /oslite report write \[path] \[--cadence daily\|weekly]/);
  assert.match(result.stdout, /oslite report schedule \[path] \[--cadence daily\|weekly]/);
  assert.match(result.stdout, /oslite report run \[path] \[--force]/);
  assert.match(result.stdout, /oslite bug new <title> \[path]/);
  assert.match(result.stdout, /oslite bug fix <bug-id> \[path]/);
  assert.match(result.stdout, /oslite bug apply <bug-id> \[path]/);
  assert.match(result.stdout, /oslite docs verify \[path]/);
  assert.match(result.stdout, /--profile <profile-id>/);
  assert.equal(result.stderr, "");
});

test("cli init accepts document language flags before the path", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-flag-order-");
  await seedRepo(rootDir);

  const result = runCli(["init", "--document-language", "zh-CN", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /repository initialized/i);

  const config = await fs.readFile(
    path.join(rootDir, ".oslite", "config.json"),
    "utf8"
  );
  assert.match(config, /"documentLanguage": "zh-CN"/);
});

test("cli init rejects unsupported document language values", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-invalid-language-");
  await seedRepo(rootDir);

  const result = runCli(["init", "--document-language", "fr-FR", rootDir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported document language: fr-FR/i);
});

test("cli change rejects unsupported actions", () => {
  const result = runCli(["change", "explode"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported change action: explode/i);
});

test("cli bug rejects unsupported actions", () => {
  const result = runCli(["bug", "explode"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported bug action: explode/i);
});

test("cli status reports uninitialized repositories", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-status-uninitialized-");
  await seedRepo(rootDir);

  const result = runCli(["status", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OSpec Lite Status/);
  assert.match(result.stdout, /Initialized: no/);
  assert.match(result.stdout, /State: uninitialized/);
  assert.match(result.stdout, /Active changes: 0/);
  assert.match(result.stdout, /Archived changes: 0/);
  assert.match(result.stdout, /Active bugs: 0/);
  assert.match(result.stdout, /Applied bugs: 0/);
  assert.doesNotMatch(result.stdout, /Agent targets:/);
});

test("cli status reports incomplete repositories without crashing", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-status-incomplete-");
  await fs.mkdir(path.join(rootDir, ".oslite"), { recursive: true });
  await fs.writeFile(path.join(rootDir, ".oslite", "config.json"), "{}\n", "utf8");

  const result = runCli(["status", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Initialized: no/);
  assert.match(result.stdout, /State: incomplete/);
  assert.match(result.stdout, /Config: incomplete or invalid/);
  assert.match(result.stdout, /Active bugs: 0/);
  assert.match(result.stdout, /Applied bugs: 0/);
  assert.match(result.stdout, /Missing markers:/);
  assert.match(result.stdout, /\.oslite\/index\.json/);
});

test("cli status reports initialized repositories with config details", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-status-initialized-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });
  await changeService.newChange(rootDir, "status-check");

  const result = runCli(["status", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Initialized: yes/);
  assert.match(result.stdout, /State: initialized/);
  assert.match(result.stdout, /Agent targets: codex, claude-code/);
  assert.match(result.stdout, /Project docs: \.oslite\/docs\/project/);
  assert.match(result.stdout, /Changes root: \.oslite\/changes/);
  assert.match(result.stdout, /Active changes: 1/);
  assert.match(result.stdout, /Archived changes: 0/);
  assert.match(result.stdout, /Active bugs: 0/);
  assert.match(result.stdout, /Applied bugs: 0/);
});

test("cli refresh rejects uninitialized repositories", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-refresh-uninitialized-");
  await seedRepo(rootDir);

  const result = runCli(["refresh", rootDir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /refresh blocked: repository state is uninitialized/i);
});

test("cli report rejects uninitialized repositories", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-report-uninitialized-");
  await seedRepo(rootDir);

  const result = runCli(["report", rootDir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /report blocked: repository state is uninitialized/i);
});

test("cli refresh rejects incomplete repositories", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-refresh-incomplete-");
  await seedRepo(rootDir);
  const { initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });
  await fs.rm(path.join(rootDir, ".oslite", "docs", "project", "overview.md"));

  const result = runCli(["refresh", rootDir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /refresh blocked: repository state is incomplete/i);
  assert.match(result.stderr, /\.oslite\/docs\/project\/overview\.md/);
});

test("cli plugins create scaffolds a repo-local plugin and marketplace entry", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-plugin-create-");
  await seedRepo(rootDir);

  const result = runCli([
    "plugins",
    "create",
    "My Plugin",
    rootDir,
    "--display-name",
    "My Plugin",
    "--with-skills",
    "--with-hooks",
    "--with-mcp"
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created plugin: my-plugin/);

  const manifest = JSON.parse(
    await fs.readFile(
      path.join(rootDir, "plugins", "my-plugin", ".codex-plugin", "plugin.json"),
      "utf8"
    )
  );
  const skillPath = path.join(
    rootDir,
    "plugins",
    "my-plugin",
    "skills",
    "my-plugin",
    "SKILL.md"
  );
  const hooksKeepPath = path.join(rootDir, "plugins", "my-plugin", "hooks", ".gitkeep");
  const mcpPath = path.join(rootDir, "plugins", "my-plugin", ".mcp.json");
  const marketplace = JSON.parse(
    await fs.readFile(path.join(rootDir, ".agents", "plugins", "marketplace.json"), "utf8")
  );

  assert.equal(manifest.name, "my-plugin");
  assert.equal(manifest.skills, "./skills/");
  assert.match(manifest.description, /\[TODO: describe what My Plugin does\]/);
  assert.equal(await fileExists(skillPath), true);
  assert.equal(await fileExists(hooksKeepPath), true);
  assert.equal(await fileExists(mcpPath), true);
  assert.equal(marketplace.plugins[0].name, "my-plugin");
  assert.equal(marketplace.plugins[0].policy.installation, "AVAILABLE");
});

test("cli plugins install-defaults copies bundled starter plugins", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-plugin-defaults-");
  await seedRepo(rootDir);

  const result = runCli(["plugins", "install-defaults", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed default plugins:/);
  assert.match(result.stdout, /ospec-lite-codex/);

  const marketplace = JSON.parse(
    await fs.readFile(path.join(rootDir, ".agents", "plugins", "marketplace.json"), "utf8")
  );
  assert.equal(await fileExists(path.join(rootDir, "plugins", "ospec-lite-codex")), true);
  assert.deepEqual(marketplace.plugins.map((plugin) => plugin.name), ["ospec-lite-codex"]);
  assert.ok(
    marketplace.plugins.every(
      (plugin) => plugin.policy.installation === "INSTALLED_BY_DEFAULT"
    )
  );
});

test("cli plugins install accepts an existing local plugin path", async (t) => {
  const sourceRoot = await createTempRepo(t, "ospec-lite-plugin-source-");
  const targetRoot = await createTempRepo(t, "ospec-lite-plugin-target-");
  await seedRepo(sourceRoot);
  await seedRepo(targetRoot);

  const scaffold = runCli([
    "plugins",
    "create",
    "Local Source Plugin",
    sourceRoot,
    "--with-skills",
    "--no-marketplace"
  ]);
  assert.equal(scaffold.status, 0, scaffold.stderr);

  const pluginPath = path.join(sourceRoot, "plugins", "local-source-plugin");
  const result = runCli(["plugins", "install", pluginPath, targetRoot]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed plugin: local-source-plugin/);

  const manifestPath = path.join(
    targetRoot,
    "plugins",
    "local-source-plugin",
    ".codex-plugin",
    "plugin.json"
  );
  const marketplace = JSON.parse(
    await fs.readFile(path.join(targetRoot, ".agents", "plugins", "marketplace.json"), "utf8")
  );

  assert.equal(await fileExists(manifestPath), true);
  assert.equal(marketplace.plugins[0].name, "local-source-plugin");
  assert.equal(marketplace.plugins[0].policy.installation, "AVAILABLE");
});

test("change workflow advances from draft through archive", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-change-");
  await seedRepo(rootDir);

  const { repo, initService, statusService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const changeDir = await changeService.newChange(rootDir, "add-tests");
  const request = await repo.readText(path.join(changeDir, "request.md"));
  const plan = await repo.readText(path.join(changeDir, "plan.md"));
  const apply = await repo.readText(path.join(changeDir, "apply.md"));
  const verify = await repo.readText(path.join(changeDir, "verify.md"));
  let record = await repo.readJson(path.join(changeDir, "change.json"));

  assert.match(request, /^# Request/m);
  assert.match(plan, /^# Plan/m);
  assert.match(apply, /^# Apply/m);
  assert.match(verify, /^# Verify/m);
  assert.match(request, /Change: `add-tests`/);
  assert.match(plan, /Change: `add-tests`/);
  assert.match(apply, /Change: `add-tests`/);
  assert.match(verify, /Change: `add-tests`/);
  assert.equal(record.status, "draft");

  await populateChangeForApply(changeDir, {
    affects: ["test/ospec-lite.test.js"],
    summary: "Expanded automated test coverage.",
    files: ["test/ospec-lite.test.js - added lifecycle assertions"]
  });
  await populateChangeForVerify(changeDir, {
    commands: ["npm test"],
    results: ["`npm test` passed for the updated suite."],
    validation: "Automated coverage was sufficient for this change.",
    risk: "none"
  });

  await changeService.markApplied(changeDir);
  record = await repo.readJson(path.join(changeDir, "change.json"));
  assert.equal(record.status, "applied");

  await changeService.markVerified(changeDir);
  record = await repo.readJson(path.join(changeDir, "change.json"));
  assert.equal(record.status, "verified");

  const archivePath = await changeService.archive(changeDir);
  assert.equal(await repo.exists(changeDir), false);
  assert.equal(await repo.exists(archivePath), true);

  const archivedRecord = await repo.readJson(path.join(archivePath, "change.json"));
  assert.equal(archivedRecord.status, "archived");

  const status = await statusService.getStatus(rootDir);
  assert.equal(status.activeChanges.length, 0);
  assert.deepEqual(status.archivedChanges, ["add-tests"]);
});

test("change apply rejects empty affects even when notes are filled", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-change-apply-affects-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const changeDir = await changeService.newChange(rootDir, "apply-affects");
  await populateChangeForApply(changeDir, {
    affects: [],
    summary: "Prepared the implementation notes.",
    files: ["src/main.ts - planned runtime change"]
  });

  await assert.rejects(
    () => changeService.markApplied(changeDir),
    (error) => {
      assert.match(error.message, /change\.json must list at least one affected area/i);
      return true;
    }
  );
});

test("change apply rejects placeholder-filled change files", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-change-apply-placeholders-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const changeDir = await changeService.newChange(rootDir, "apply-placeholders");
  const changeJsonPath = path.join(changeDir, "change.json");
  const record = JSON.parse(await fs.readFile(changeJsonPath, "utf8"));
  record.affects = ["src/main.ts"];
  await fs.writeFile(changeJsonPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  await assert.rejects(
    () => changeService.markApplied(changeDir),
    (error) => {
      assert.match(error.message, /template placeholders/i);
      return true;
    }
  );
});

test("change verify rejects missing command and result evidence", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-change-verify-evidence-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const changeDir = await changeService.newChange(rootDir, "verify-evidence");
  await populateChangeForApply(changeDir, {
    affects: ["src/main.ts"],
    summary: "Updated the main bootstrap path.",
    files: ["src/main.ts - adjusted startup flow"]
  });
  await populateChangeForVerify(changeDir, {
    commands: ["N/A"],
    results: ["none"],
    validation: "Manual validation was deferred while the test command was being prepared.",
    risk: "Needs a real verification command before handoff."
  });

  await changeService.markApplied(changeDir);
  await assert.rejects(
    () => changeService.markVerified(changeDir),
    (error) => {
      assert.match(error.message, /real `Command` entry/i);
      return true;
    }
  );
});

test("change apply rejects none and N/A placeholder evidence", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-change-apply-bare-placeholders-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const changeDir = await changeService.newChange(rootDir, "apply-bare-placeholders");
  await populateChangeForApply(changeDir, {
    affects: ["src/main.ts"],
    summary: "none",
    files: ["N/A"]
  });

  await assert.rejects(
    () => changeService.markApplied(changeDir),
    (error) => {
      assert.match(error.message, /real `Summary` entry/i);
      return true;
    }
  );
});

test("bug workflow advances from reported through apply and remembers lessons", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-bug-");
  await seedRepo(rootDir);

  const { repo, initService, statusService, bugService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const bugId = await bugService.newBug(rootDir, "Startup ordering blocks cold boot");
  let queue = await repo.readText(path.join(rootDir, BUG_ACTIVE_BUGS_PATH));
  let index = await repo.readJson(path.join(rootDir, BUG_INDEX_PATH));

  assert.match(queue, new RegExp(`## ${escapeRegex(bugId)}: Startup ordering blocks cold boot`));
  assert.equal(index.items[0].status, "reported");

  await populateBugQueueEntry(rootDir, bugId, {
    affects: ["src/bootstrap.ts"],
    summary: "Startup can fire before configuration hydration is complete.",
    actual: "Cold boot can start the app before the real readiness gate is satisfied.",
    expected: "Startup should wait until configuration hydration finishes.",
    repro: "Run the cold-boot flow once after clearing local state.",
    investigation: "Tracing showed the readiness signal flips after startup can already run.",
    cause: "The startup path assumed configuration hydration had already finished.",
    fixSummary: "Guarded startup ordering when bootstrap state is incomplete.",
    files: ["src/bootstrap.ts - deferred the startup call until config is ready"],
    reason: "Startup now waits for the real readiness condition instead of assuming state order."
  });
  await populateBugQueueEntry(rootDir, bugId, {
    command: "npm test",
    result: "`npm test` passed after the startup ordering fix.",
    validation: "Manually confirmed startup waits for config readiness.",
    risk: "none",
    gap: "Assumed startup only ran after config hydration completed.",
    reality: "The bootstrap path can trigger startup before config hydration finishes.",
    checkFirst: "src/bootstrap.ts",
    remember:
      "Read startup ordering in `src/bootstrap.ts` before changing initialization bugs."
  });

  await bugService.markFixed(rootDir, bugId);
  queue = await repo.readText(path.join(rootDir, BUG_ACTIVE_BUGS_PATH));
  index = await repo.readJson(path.join(rootDir, BUG_INDEX_PATH));
  assert.match(queue, new RegExp(`## ${escapeRegex(bugId)}:[\\s\\S]*- Status: fixed`));
  assert.equal(index.items[0].status, "fixed");

  const memoryFilePath = await bugService.apply(rootDir, bugId);
  queue = await repo.readText(path.join(rootDir, BUG_ACTIVE_BUGS_PATH));
  index = await repo.readJson(path.join(rootDir, BUG_INDEX_PATH));
  const memoryIndex = await repo.readText(path.join(rootDir, BUG_MEMORY_PATH));
  const memoryFile = await repo.readText(memoryFilePath);

  assert.doesNotMatch(queue, new RegExp(`## ${escapeRegex(bugId)}:`));
  assert.equal(index.items[0].status, "applied");
  assert.match(memoryIndex, /memory-0001\.md/);
  assert.match(memoryFile, new RegExp(`${escapeRegex(bugId)}: Startup ordering blocks cold boot`));
  assert.match(memoryFile, /Assumed startup only ran after config hydration completed\./);
  assert.match(memoryFile, /The bootstrap path can trigger startup before config hydration finishes\./);
  assert.match(memoryFile, /Read startup ordering in `src\/bootstrap\.ts` before changing initialization bugs\./);

  const status = await statusService.getStatus(rootDir);
  assert.equal(status.activeBugs.length, 0);
  assert.deepEqual(status.appliedBugs, [bugId]);
});

test("bug apply rejects missing learned guardrails", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-bug-learned-");
  await seedRepo(rootDir);

  const { initService, bugService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const bugId = await bugService.newBug(rootDir, "Learned gap should be rejected");
  await populateBugQueueEntry(rootDir, bugId, {
    affects: ["src/main.ts"],
    summary: "The main guard fires too early during startup.",
    actual: "The main guard runs before the intended initialization edge.",
    expected: "The guard should only run after the real startup edge.",
    repro: "Run startup once and inspect the guard ordering.",
    investigation: "The early run is visible in the startup log.",
    cause: "The guard assumption was tied to the wrong lifecycle edge.",
    fixSummary: "Applied the direct bug fix.",
    files: ["src/main.ts - patched the broken guard"],
    reason: "The guard now matches the actual runtime condition."
  });
  await populateBugQueueEntry(rootDir, bugId, {
    command: "npm test",
    result: "`npm test` passed.",
    validation: "Manual smoke test passed.",
    risk: "none",
    gap: "Assumed the main guard only ran once.",
    reality: "The main guard can run multiple times during startup.",
    checkFirst: "src/main.ts",
    remember: "none"
  });

  await bugService.markFixed(rootDir, bugId);
  await assert.rejects(
    () => bugService.apply(rootDir, bugId),
    (error) => {
      assert.match(error.message, /real `Remember` entry/i);
      return true;
    }
  );
});

test("bug memory compaction drops stale lessons and rotates the write file", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-bug-compact-");
  await seedRepo(rootDir);
  await fs.writeFile(path.join(rootDir, "src", "stable.ts"), "export const stableAnchor = true;\n", "utf8");
  await fs.writeFile(path.join(rootDir, "src", "stale.ts"), "export const staleAnchor = true;\n", "utf8");

  const { repo, initService, statusService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const bugService = new BugService(repo, statusService, undefined, {
    knowledgeFileMaxBytes: 900,
    knowledgeFileMinBytes: 260
  });

  const staleId = await bugService.newBug(rootDir, "Stale startup lesson");
  await populateBugQueueEntry(rootDir, staleId, {
    affects: ["src/stale.ts"],
    summary: "A stale startup guard still drives the old path.",
    actual: "The old guard can still gate startup.",
    expected: "The old guard should no longer matter.",
    repro: "Run the old startup flow and inspect the stale path.",
    investigation: "Tracing showed the stale guard still participates in the old flow.",
    cause: "The fix had been anchored to the wrong legacy guard.",
    fixSummary: "Removed the stale startup coupling.",
    files: ["src/stale.ts - removed the stale coupling"],
    reason: "The old guard no longer drives startup.",
    command: "npm test",
    result: "`npm test` passed after removing the stale guard.",
    validation: "The stale path no longer runs during startup.",
    gap: "Assumed the legacy path was still the source of truth.",
    reality: "The old flow depended on `staleAnchor` in a legacy branch.",
    checkFirst: "src/stale.ts",
    remember: "Inspect `staleAnchor` in `src/stale.ts` before editing legacy startup flow."
  });
  await bugService.markFixed(rootDir, staleId);
  await bugService.apply(rootDir, staleId);

  await fs.rm(path.join(rootDir, "src", "stale.ts"));

  const longLesson = "Check the stable startup guard before editing this path. ".repeat(6);

  const secondId = await bugService.newBug(rootDir, "Stable startup lesson one");
  await populateBugQueueEntry(rootDir, secondId, {
    affects: ["src/stable.ts"],
    summary: "The stable startup path needs a durable reminder.",
    actual: "A future edit could skip the stable guard.",
    expected: "The stable guard should be reviewed first.",
    repro: "Inspect the stable startup path before editing it.",
    investigation: "The stable guard is the real choke point in the current code.",
    cause: "The earlier fix nearly skipped the actual stable guard.",
    fixSummary: "Pinned the fix to the stable guard.",
    files: ["src/stable.ts - documented the real startup guard"],
    reason: "The fix now follows the actual current startup logic.",
    command: "npm test",
    result: "`npm test` passed after the stable-guard fix.",
    validation: "Confirmed the stable guard remains the real check.",
    gap: `${longLesson}First stable gap.`,
    reality: "The current startup path still reads `stableAnchor` before continuing.",
    checkFirst: "src/stable.ts",
    remember: `Review \`stableAnchor\` in \`src/stable.ts\` first. ${longLesson}`
  });
  await bugService.markFixed(rootDir, secondId);
  await bugService.apply(rootDir, secondId);

  const thirdId = await bugService.newBug(rootDir, "Stable startup lesson two");
  await populateBugQueueEntry(rootDir, thirdId, {
    affects: ["src/stable.ts"],
    summary: "A second reminder should trigger memory compaction.",
    actual: "Another edit could still miss the stable guard.",
    expected: "Stable guard lessons should stay compact and current.",
    repro: "Revisit the stable startup path after multiple fixes.",
    investigation: "The stable guard remains the central decision point.",
    cause: "Repeated edits can still hallucinate a different startup gate.",
    fixSummary: "Captured the second stable startup lesson.",
    files: ["src/stable.ts - reinforced the stable startup guidance"],
    reason: "The second lesson keeps future edits anchored to current logic.",
    command: "npm test",
    result: "`npm test` passed after the second stable-guard fix.",
    validation: "Confirmed the stable guard remains accurate after the second fix.",
    gap: `${longLesson}Second stable gap.`,
    reality: "The real startup flow still checks `stableAnchor` in the current branch.",
    checkFirst: "src/stable.ts",
    remember: `Inspect \`stableAnchor\` in \`src/stable.ts\` before editing startup again. ${longLesson}`
  });
  await bugService.markFixed(rootDir, thirdId);
  await bugService.apply(rootDir, thirdId);

  const compactedIndex = await repo.readJson(path.join(rootDir, BUG_INDEX_PATH));
  const compactedContents = await Promise.all(
    compactedIndex.knowledgeFiles.map((file) =>
      repo.readText(path.join(rootDir, file.path))
    )
  );
  const combinedMemory = compactedContents.join("\n");

  assert.ok(compactedIndex.knowledgeFiles.length >= 2);
  assert.equal(compactedIndex.currentKnowledgeFile, compactedIndex.knowledgeFiles[compactedIndex.knowledgeFiles.length - 1].path);
  assert.doesNotMatch(combinedMemory, new RegExp(`${escapeRegex(staleId)}:`));
  assert.match(combinedMemory, new RegExp(`${escapeRegex(secondId)}:`));
  assert.match(combinedMemory, new RegExp(`${escapeRegex(thirdId)}:`));
});

test("init captures common repo signals from lowercase working directories", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-signals-");
  await seedRepo(rootDir);
  await fs.mkdir(path.join(rootDir, "test"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "scripts"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "assets"), { recursive: true });

  const { repo, initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const index = await repo.readJson(path.join(rootDir, ".oslite", "index.json"));
  assert.equal(index.signals.hasSrcDir, true);
  assert.equal(index.signals.hasTestsDir, true);
  assert.equal(index.signals.hasScriptDir, true);
  assert.equal(index.signals.hasAssetsDir, true);
});

test("init captures richer tooling and caution metadata in index", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-rich-index-");
  await seedRepo(rootDir);

  await fs.writeFile(
    path.join(rootDir, "package.json"),
    `${JSON.stringify(
      {
        name: "rich-index-fixture",
        scripts: {
          build: "tsc -p tsconfig.json",
          lint: "eslint .",
          test: "node --test ./test/*.test.js",
          typecheck: "tsc -p tsconfig.json --noEmit"
        },
        dependencies: {
          react: "^19.0.0"
        },
        devDependencies: {
          "@types/node": "^24.0.0",
          typescript: "^5.8.3",
          vitest: "^3.0.0"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "package-lock.json"), "{\n  \"lockfileVersion\": 3\n}\n", "utf8");
  await fs.mkdir(path.join(rootDir, "dist"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "dist", "main.js"),
    "require('./compiled');\nrequire('./compiled-two');\n",
    "utf8"
  );
  await fs.mkdir(path.join(rootDir, "src", "generated"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "src", "generated", "client.ts"),
    "export const generated = true;\n",
    "utf8"
  );
  await fs.mkdir(path.join(rootDir, ".github", "workflows"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, ".github", "workflows", "ci.yml"),
    "name: fixture\n",
    "utf8"
  );

  const { repo, initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const index = await repo.readJson(path.join(rootDir, ".oslite", "index.json"));

  assert.deepEqual(index.tooling.packageManager, {
    name: "npm",
    source: "lockfile",
    lockFile: "package-lock.json",
    installCommand: "npm ci",
    scriptCommandPrefix: "npm run"
  });
  assert.equal(index.tooling.scripts.build, "tsc -p tsconfig.json");
  assert.equal(index.tooling.scripts.test, "node --test ./test/*.test.js");
  assert.equal(index.tooling.commands.install, "npm ci");
  assert.equal(index.tooling.commands.build, "npm run build");
  assert.equal(index.tooling.commands.test, "npm test");
  assert.equal(index.tooling.commands.typecheck, "npm run typecheck");
  assert.equal(index.tooling.commands.lint, "npm run lint");
  assert.equal(index.tooling.commands.pack, "npm pack --dry-run");
  assert.deepEqual(
    index.tooling.majorDependencies.map((dependency) => dependency.name),
    ["react", "@types/node", "typescript", "vitest"]
  );

  assert.deepEqual(index.generatedDirectories, ["dist", "src/generated"]);

  const typeScript = index.primaryLanguages.find((language) => language.name === "TypeScript");
  assert.ok(typeScript);
  assert.equal(typeScript.fileCount, 2);
  assert.deepEqual(typeScript.extensions, [".ts"]);
  assert.equal(index.primaryLanguages[0].name, "TypeScript");

  assert.ok(index.riskyPaths.some((item) => item.path === "package.json"));
  assert.ok(index.riskyPaths.some((item) => item.path === "package-lock.json"));
  assert.ok(index.riskyPaths.some((item) => item.path === ".github/workflows"));
  assert.ok(index.riskyPaths.some((item) => item.path === "dist" && item.kind === "generated"));
  assert.ok(
    index.riskyPaths.some((item) => item.path === "src/generated" && item.kind === "generated")
  );
  assert.ok(index.riskyPaths.some((item) => item.path === "src/main.ts" && item.kind === "entrypoint"));

  assert.ok(index.askFirstAreas.some((item) => item.path === "package.json"));
  assert.ok(index.askFirstAreas.some((item) => item.path === "package-lock.json"));
  assert.ok(index.askFirstAreas.some((item) => item.path === ".github/workflows"));
  assert.ok(index.askFirstAreas.some((item) => item.path === "dist"));
  assert.ok(index.askFirstAreas.some((item) => item.path === "src/generated"));
  assert.ok(index.docSuggestionHashes[".oslite/docs/project/overview.md"]);
});

test("cli refresh updates managed artifacts without overwriting human docs", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-refresh-update-");
  await seedRepo(rootDir);

  const { initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const overviewPath = path.join(rootDir, ".oslite", "docs", "project", "overview.md");
  await fs.writeFile(
    overviewPath,
    "# Human Overview\n\nThis doc was edited by a person and should stay as-is.\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "AGENTS.md"),
    [
      "# Team Notes",
      "",
      "Keep this human intro.",
      "",
      AGENTS_MANAGED_START,
      "Old managed content",
      AGENTS_MANAGED_END,
      ""
    ].join("\n"),
    "utf8"
  );

  await fs.writeFile(
    path.join(rootDir, "package.json"),
    `${JSON.stringify(
      {
        name: "refresh-fixture",
        scripts: {
          build: "tsc -p tsconfig.json",
          test: "node --test ./test/*.test.js"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = runCli(["refresh", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OSpec Lite refreshed/);
  assert.match(result.stdout, /Updated machine-managed artifacts:/);
  assert.match(result.stdout, /\.oslite\/index\.json/);
  assert.match(result.stdout, /AGENTS\.md/);
  assert.match(result.stdout, /Human-owned docs needing review:/);
  assert.match(result.stdout, /\.oslite\/docs\/project\/overview\.md/);

  const overviewAfter = await fs.readFile(overviewPath, "utf8");
  const agentsAfter = await fs.readFile(path.join(rootDir, "AGENTS.md"), "utf8");
  const index = JSON.parse(
    await fs.readFile(path.join(rootDir, ".oslite", "index.json"), "utf8")
  );

  assert.equal(overviewAfter, "# Human Overview\n\nThis doc was edited by a person and should stay as-is.\n");
  assert.match(agentsAfter, /Keep this human intro\./);
  assert.match(agentsAfter, /### Preferred Commands/);
  assert.match(agentsAfter, /Build: `npm run build`/);
  assert.ok(index.docSuggestionHashes[".oslite/docs/project/overview.md"]);
});

test("cli report summarizes daily ospec-lite work without mutating the repo", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-report-daily-");
  await seedRepo(rootDir);

  const { initService, changeService, bugService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  await changeService.newChange(rootDir, "active-work");
  const completedChangeDir = await changeService.newChange(rootDir, "completed-work");
  await populateChangeForApply(completedChangeDir, {
    affects: ["src/main.ts"],
    summary: "Completed the scoped report fixture change.",
    files: ["src/main.ts - finalized the report fixture change"]
  });
  await populateChangeForVerify(completedChangeDir, {
    commands: ["npm test"],
    results: ["`npm test` passed for the completed report fixture change."],
    validation: "Automated coverage was enough for the report fixture.",
    risk: "none"
  });
  await changeService.markApplied(completedChangeDir);
  await changeService.markVerified(completedChangeDir);
  await changeService.archive(completedChangeDir);

  const activeBugId = await bugService.newBug(rootDir, "Ongoing startup bug");
  const resolvedBugId = await bugService.newBug(rootDir, "Resolved startup bug");
  await populateBugQueueEntry(rootDir, resolvedBugId, {
    affects: ["src/bootstrap.ts"],
    summary: "Startup still had one resolved fixture bug.",
    actual: "The resolved fixture bug could still interrupt startup.",
    expected: "The resolved fixture bug should stay fixed.",
    repro: "Run the startup fixture flow once.",
    investigation: "The fixture bug was isolated to the bootstrap gate.",
    cause: "The bootstrap gate used the wrong readiness assumption.",
    fixSummary: "Patched the resolved fixture bug.",
    files: ["src/bootstrap.ts - patched the fixture bug"],
    reason: "The readiness gate now matches the real startup behavior.",
    command: "npm test",
    result: "`npm test` passed after the resolved fixture bug was fixed.",
    validation: "Manually confirmed the startup fixture stays healthy.",
    risk: "none",
    gap: "Assumed the bootstrap gate was already safe.",
    reality: "The bootstrap gate still needed one explicit readiness check.",
    checkFirst: "src/bootstrap.ts",
    remember: "Review `src/bootstrap.ts` before editing the startup fixture again."
  });
  await bugService.markFixed(rootDir, resolvedBugId);
  await bugService.apply(rootDir, resolvedBugId);

  await fs.writeFile(
    path.join(rootDir, "package.json"),
    `${JSON.stringify(
      {
        name: "report-fixture",
        scripts: {
          build: "tsc -p tsconfig.json",
          test: "node --test ./test/*.test.js"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = runCli(["report", "--cadence", "daily", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OSpec Lite Work Report/);
  assert.match(result.stdout, /Cadence: daily/);
  assert.match(result.stdout, /Window: last 1 day\(s\)/);
  assert.match(result.stdout, /Completed changes this period: 1/);
  assert.match(result.stdout, /- completed-work \[archived;/);
  assert.match(result.stdout, /Open changes now: 1/);
  assert.match(result.stdout, /- active-work \[draft;/);
  assert.match(result.stdout, /Resolved bugs this period: 1/);
  assert.match(
    result.stdout,
    new RegExp(`- ${escapeRegex(resolvedBugId)}: Resolved startup bug \\[applied;`)
  );
  assert.match(result.stdout, /Open bugs now: 1/);
  assert.match(
    result.stdout,
    new RegExp(`- ${escapeRegex(activeBugId)}: Ongoing startup bug \\[reported;`)
  );
  assert.match(result.stdout, /Docs needing review now:/);
  assert.match(result.stdout, /\.oslite\/docs\/project\/overview\.md/);
});

test("cli report write emits markdown and json artifacts", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-report-write-");
  await seedRepo(rootDir);

  const { initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const result = runCli(["report", "write", "--cadence", "weekly", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OSpec Lite report artifact written/);
  assert.match(result.stdout, /Cadence: weekly/);
  assert.match(result.stdout, /Markdown: \.oslite\/reports\/weekly\/\d{4}-W\d{2}\.md/);
  assert.match(result.stdout, /JSON: \.oslite\/reports\/weekly\/\d{4}-W\d{2}\.json/);

  const markdownPath = result.stdout.match(/Markdown: (.+)/)[1].trim();
  const jsonPath = result.stdout.match(/JSON: (.+)/)[1].trim();
  const markdown = await fs.readFile(path.join(rootDir, markdownPath), "utf8");
  const json = JSON.parse(await fs.readFile(path.join(rootDir, jsonPath), "utf8"));

  assert.match(markdown, /^# OSpec Lite Work Report/m);
  assert.match(markdown, /## Open changes now \(0\)/);
  assert.equal(json.reportWindow.cadence, "weekly");
});

test("cli report automation schedules and runs due report artifacts once per period", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-report-automation-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });
  await changeService.newChange(rootDir, "scheduled-work");

  const scheduleResult = runCli(["report", "schedule", "--cadence", "daily", rootDir]);
  assert.equal(scheduleResult.status, 0, scheduleResult.stderr);
  assert.match(scheduleResult.stdout, /OSpec Lite report automation scheduled/);
  assert.match(scheduleResult.stdout, /Cadence: daily/);
  assert.match(scheduleResult.stdout, /Schedule: \.oslite\/reports\/schedule\.json/);
  assert.match(scheduleResult.stdout, /Runner: oslite report run \[path]/);

  const schedulePath = path.join(rootDir, ".oslite", "reports", "schedule.json");
  const scheduled = JSON.parse(await fs.readFile(schedulePath, "utf8"));
  assert.equal(scheduled.cadence, "daily");
  assert.equal(scheduled.artifactRoot, ".oslite/reports");
  assert.ok(scheduled.nextRunAt);
  assert.equal(scheduled.lastGeneratedPeriod, undefined);

  const runResult = runCli(["report", "run", rootDir]);
  assert.equal(runResult.status, 0, runResult.stderr);
  assert.match(runResult.stdout, /OSpec Lite report automation run/);
  assert.match(runResult.stdout, /Generated: yes/);
  assert.match(runResult.stdout, /Markdown: \.oslite\/reports\/daily\/\d{4}-\d{2}-\d{2}\.md/);
  assert.match(runResult.stdout, /JSON: \.oslite\/reports\/daily\/\d{4}-\d{2}-\d{2}\.json/);

  const afterRun = JSON.parse(await fs.readFile(schedulePath, "utf8"));
  assert.ok(afterRun.lastGeneratedAt);
  assert.match(afterRun.lastGeneratedPeriod, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(afterRun.lastArtifactPath, /^\.oslite\/reports\/daily\/\d{4}-\d{2}-\d{2}\.md$/);
  assert.match(afterRun.lastDataPath, /^\.oslite\/reports\/daily\/\d{4}-\d{2}-\d{2}\.json$/);
  assert.ok(await fileExists(path.join(rootDir, afterRun.lastArtifactPath)));
  assert.ok(await fileExists(path.join(rootDir, afterRun.lastDataPath)));

  const markdown = await fs.readFile(path.join(rootDir, afterRun.lastArtifactPath), "utf8");
  const json = JSON.parse(await fs.readFile(path.join(rootDir, afterRun.lastDataPath), "utf8"));
  assert.match(markdown, /Cadence: daily/);
  assert.match(markdown, /scheduled-work \[draft;/);
  assert.equal(json.reportWindow.cadence, "daily");
  assert.equal(json.activeChanges[0].slug, "scheduled-work");

  const secondRun = runCli(["report", "run", rootDir]);
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.match(secondRun.stdout, /Generated: no/);
  assert.match(secondRun.stdout, /Report already emitted/);

  const afterSecondRun = JSON.parse(await fs.readFile(schedulePath, "utf8"));
  assert.equal(afterSecondRun.lastGeneratedPeriod, afterRun.lastGeneratedPeriod);
  assert.equal(afterSecondRun.lastArtifactPath, afterRun.lastArtifactPath);
});

test("cli refresh initializes doc hashes for older indexes", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-refresh-baseline-");
  await seedRepo(rootDir);

  const { initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const indexPath = path.join(rootDir, ".oslite", "index.json");
  const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
  delete index.docSuggestionHashes;
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const result = runCli(["refresh", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Initialized doc suggestion baselines:/);
  assert.match(result.stdout, /\.oslite\/docs\/project\/overview\.md/);
  assert.match(
    result.stdout,
    /Future refresh runs will flag these docs when the generated suggestion changes\./
  );

  const refreshedIndex = JSON.parse(await fs.readFile(indexPath, "utf8"));
  assert.ok(refreshedIndex.docSuggestionHashes[".oslite/docs/project/overview.md"]);
});

test("cli refresh ignores .oslite when rescanning an initialized repo", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-refresh-ignore-oslite-");
  await seedRepo(rootDir);

  const { initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const agentsBefore = await fs.readFile(path.join(rootDir, "AGENTS.md"), "utf8");
  const claudeBefore = await fs.readFile(path.join(rootDir, "CLAUDE.md"), "utf8");

  const result = runCli(["refresh", rootDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OSpec Lite refreshed/);
  assert.match(result.stdout, /Human-owned docs needing review:\n- \(none\)/);
  assert.doesNotMatch(result.stdout, /AGENTS\.md/);
  assert.doesNotMatch(result.stdout, /CLAUDE\.md/);

  const agentsAfter = await fs.readFile(path.join(rootDir, "AGENTS.md"), "utf8");
  const claudeAfter = await fs.readFile(path.join(rootDir, "CLAUDE.md"), "utf8");
  const index = JSON.parse(
    await fs.readFile(path.join(rootDir, ".oslite", "index.json"), "utf8")
  );

  assert.equal(agentsAfter, agentsBefore);
  assert.equal(claudeAfter, claudeBefore);
  assert.ok(!index.generatedDirectories.includes(".oslite"));
  assert.ok(!index.directoryMap.some((item) => item.path === ".oslite"));
  assert.ok(!index.riskyPaths.some((item) => item.path === ".oslite"));
  assert.ok(!index.askFirstAreas.some((item) => item.path === ".oslite"));
});

test("scan harvests multilingual rules from rule sections and directive bullets", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-rules-");
  await seedRepo(rootDir);

  await fs.writeFile(
    path.join(rootDir, "AGENTS.md"),
    [
      "# Agent Guide",
      "",
      "## Hard Rules",
      "",
      "- 必须先阅读 Script/MJGame.lua",
      "- 不要修改自动生成文件",
      "",
      "## Notes",
      "",
      "- 先完成 evidence-map.md",
      "- 这是普通说明，不是规则",
      "- Avoid changing generated bindings without evidence.",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "CLAUDE.md"),
    [
      "# Claude Code Project Memory",
      "",
      "## 关键写作规则",
      "",
      "- 应该先核对入口文件",
      "- 必须先阅读 Script/MJGame.lua",
      "",
      "## Notes",
      "",
      "- This area describes the repo layout.",
      "- should update docs when conventions change",
      ""
    ].join("\n"),
    "utf8"
  );

  const scan = await new ScanService(new FileRepo()).scan(rootDir);
  const harvested = scan.rules
    .filter((rule) => rule.source === "harvested")
    .map((rule) => rule.text);

  assert.deepEqual(harvested, [
    "必须先阅读 Script/MJGame.lua",
    "不要修改自动生成文件",
    "应该先核对入口文件",
    "先完成 evidence-map.md",
    "Avoid changing generated bindings without evidence.",
    "should update docs when conventions change"
  ]);
  assert.doesNotMatch(harvested.join("\n"), /这是普通说明，不是规则/);
  assert.equal(
    harvested.filter((rule) => rule === "必须先阅读 Script/MJGame.lua").length,
    1
  );
});

test("init patches existing AGENTS.md and CLAUDE.md without removing human content", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-agent-patch-");
  await seedRepo(rootDir);

  const originalAgents = [
    "# Team Notes",
    "",
    "Keep this introduction.",
    "",
    "## Local Guidance",
    "",
    "- Human-authored AGENTS note.",
    ""
  ].join("\n");
  const originalClaude = [
    "# Claude Notes",
    "",
    "Keep this preface.",
    "",
    "## Local Memory",
    "",
    "- Human-authored CLAUDE note.",
    ""
  ].join("\n");

  await fs.writeFile(path.join(rootDir, "AGENTS.md"), originalAgents, "utf8");
  await fs.writeFile(path.join(rootDir, "CLAUDE.md"), originalClaude, "utf8");

  const { initService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const agents = await fs.readFile(path.join(rootDir, "AGENTS.md"), "utf8");
  const claude = await fs.readFile(path.join(rootDir, "CLAUDE.md"), "utf8");

  assert.match(agents, /Keep this introduction\./);
  assert.match(claude, /Keep this preface\./);
  assert.equal(countOccurrences(agents, AGENTS_MANAGED_START), 1);
  assert.equal(countOccurrences(claude, CLAUDE_MANAGED_START), 1);
  assert.match(agents, /## OSpec Lite/);
  assert.match(claude, /@AGENTS\.md/);
});

test("agent entry patching replaces managed sections instead of duplicating them", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-managed-update-");
  await seedRepo(rootDir);

  const repo = new FileRepo();
  const agentEntries = new AgentEntryService(repo);
  const codexAdapter = new CodexAdapter();
  const claudeAdapter = new ClaudeCodeAdapter();

  await fs.writeFile(
    path.join(rootDir, "AGENTS.md"),
    [
      "# Team Notes",
      "",
      "Intro stays.",
      "",
      AGENTS_MANAGED_START,
      "Old AGENTS managed content",
      AGENTS_MANAGED_END,
      "",
      "Tail stays.",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "CLAUDE.md"),
    [
      "# Claude Notes",
      "",
      "Prelude stays.",
      "",
      CLAUDE_MANAGED_START,
      "Old CLAUDE managed content",
      CLAUDE_MANAGED_END,
      "",
      "Footer stays.",
      ""
    ].join("\n"),
    "utf8"
  );

  const codexSection = codexAdapter.buildSection({
    projectName: "Managed Update Repo",
    summary: "Updated summary for AGENTS.",
    docsRoot: ".oslite/docs/project",
    agentDocsRoot: ".oslite/docs/agents",
    rules: ["Use the managed AGENTS block."],
    importantFiles: ["AGENTS.md", ".oslite/docs/project/overview.md"],
    preferredCommands: ["Build: `npm run build`"],
    verificationCommands: ["Test: `npm test`"],
    generatedFiles: ["dist"],
    askBeforeEditAreas: ["`package.json`: Coordinates package scripts."]
  });
  const claudeSection = claudeAdapter.buildSection({
    projectName: "Managed Update Repo",
    summary: "Updated summary for CLAUDE.",
    docsRoot: ".oslite/docs/project",
    agentDocsRoot: ".oslite/docs/agents",
    rules: ["Use the managed CLAUDE block."],
    importantFiles: ["CLAUDE.md", ".oslite/docs/project/overview.md"],
    preferredCommands: ["Build: `npm run build`"],
    verificationCommands: ["Test: `npm test`"],
    generatedFiles: ["dist"],
    askBeforeEditAreas: ["`package.json`: Coordinates package scripts."]
  });

  assert.match(codexSection.content, /^# Agent Guide/m);
  assert.match(codexSection.content, new RegExp(escapeRegex(AGENTS_MANAGED_START)));
  assert.match(codexSection.content, /Updated summary for AGENTS\./);
  assert.match(codexSection.content, /### High-Risk Areas/);
  assert.match(codexSection.content, /### Preferred Commands/);
  assert.match(codexSection.content, /### How To Verify/);
  assert.match(codexSection.content, /### Generated Files/);
  assert.match(codexSection.content, /### Ask-Before-Edit Areas/);
  assert.match(codexSection.content, /Use the managed AGENTS block\./);
  assert.match(codexSection.content, /Build: `npm run build`/);
  assert.match(codexSection.content, /Test: `npm test`/);
  assert.match(codexSection.content, /- `dist`/);
  assert.match(codexSection.content, /`package\.json`: Coordinates package scripts\./);
  assert.match(codexSection.content, /- `AGENTS\.md`/);
  assert.match(codexSection.content, /- `\.oslite\/docs\/project\/overview\.md`/);

  assert.match(claudeSection.content, /^# Claude Code Project Memory/m);
  assert.match(claudeSection.content, new RegExp(escapeRegex(CLAUDE_MANAGED_START)));
  assert.match(claudeSection.content, /## Shared Instructions Import/);
  assert.match(claudeSection.content, /@AGENTS\.md/);
  assert.match(claudeSection.content, /Updated summary for CLAUDE\./);
  assert.match(claudeSection.content, /Use @\.oslite\/docs\/agents\/quickstart\.md for quick orientation\./);

  await agentEntries.ensureManagedSection(
    rootDir,
    codexAdapter,
    codexSection.content,
    codexSection.managedStart,
    codexSection.managedEnd
  );
  await agentEntries.ensureManagedSection(
    rootDir,
    claudeAdapter,
    claudeSection.content,
    claudeSection.managedStart,
    claudeSection.managedEnd
  );

  const agents = await fs.readFile(path.join(rootDir, "AGENTS.md"), "utf8");
  const claude = await fs.readFile(path.join(rootDir, "CLAUDE.md"), "utf8");

  assert.equal(countOccurrences(agents, AGENTS_MANAGED_START), 1);
  assert.equal(countOccurrences(claude, CLAUDE_MANAGED_START), 1);
  assert.doesNotMatch(agents, /Old AGENTS managed content/);
  assert.doesNotMatch(claude, /Old CLAUDE managed content/);
  assert.match(agents, /Intro stays\./);
  assert.match(agents, /Tail stays\./);
  assert.match(claude, /Prelude stays\./);
  assert.match(claude, /Footer stays\./);
  assert.match(agents, /Updated summary for AGENTS\./);
  assert.match(claude, /Updated summary for CLAUDE\./);
});

test("newChange rejects invalid change slugs", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-invalid-slug-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  await assert.rejects(
    () => changeService.newChange(rootDir, "Invalid_Slug"),
    (error) => {
      assert.ok(error instanceof InvalidChangeSlugError);
      assert.match(error.message, /invalid change slug/i);
      return true;
    }
  );
});

test("newBug assigns sequential ids for free-form titles", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-bug-ids-");
  await seedRepo(rootDir);

  const { initService, bugService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  assert.equal(await bugService.newBug(rootDir, "Invalid Bug / still allowed"), "bug-0001");
  assert.equal(await bugService.newBug(rootDir, "Second free-form title"), "bug-0002");
});

test("newChange rejects duplicate slugs", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-duplicate-slug-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  await changeService.newChange(rootDir, "duplicate-change");

  await assert.rejects(
    () => changeService.newChange(rootDir, "duplicate-change"),
    (error) => {
      assert.ok(error instanceof OSpecLiteError);
      assert.match(error.message, /change already exists/i);
      return true;
    }
  );
});

test("markVerified rejects a draft change", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-invalid-verify-");
  await seedRepo(rootDir);

  const { repo, initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const changeDir = await changeService.newChange(rootDir, "invalid-verify");

  await assert.rejects(
    () => changeService.markVerified(changeDir),
    (error) => {
      assert.ok(error instanceof OSpecLiteError);
      assert.match(error.message, /cannot move change from draft to verified/i);
      return true;
    }
  );

  const record = await repo.readJson(path.join(changeDir, "change.json"));
  assert.equal(record.status, "draft");
});

test("archive rejects changes that are not verified", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-invalid-archive-");
  await seedRepo(rootDir);

  const { repo, initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const changeDir = await changeService.newChange(rootDir, "invalid-archive");

  await assert.rejects(
    () => changeService.archive(changeDir),
    (error) => {
      assert.ok(error instanceof OSpecLiteError);
      assert.match(error.message, /only verified changes can be archived/i);
      return true;
    }
  );

  const record = await repo.readJson(path.join(changeDir, "change.json"));
  assert.equal(record.status, "draft");
  assert.equal(await repo.exists(changeDir), true);
});

test("archive preserves verified status when move to archived path fails", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-archive-move-failure-");
  await seedRepo(rootDir);

  const { repo, initService, changeService } = createServices();
  await initService.init(rootDir, { documentLanguage: "en-US" });

  const slug = "archive-conflict";
  const changeDir = await changeService.newChange(rootDir, slug);
  await populateChangeForApply(changeDir, {
    affects: ["src/main.ts"],
    summary: "Prepared the archive conflict scenario.",
    files: ["src/main.ts - placeholder implementation detail"]
  });
  await populateChangeForVerify(changeDir, {
    commands: ["npm test"],
    results: ["`npm test` passed before archiving."],
    validation: "Archive conflict fixture only needs automated validation.",
    risk: "Archive destination already exists in this test."
  });
  await changeService.markApplied(changeDir);
  await changeService.markVerified(changeDir);

  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const day = now.toISOString().slice(0, 10);
  const archiveDir = path.join(
    rootDir,
    ".oslite",
    "changes",
    "archived",
    month,
    day,
    slug
  );
  await fs.mkdir(archiveDir, { recursive: true });
  await fs.writeFile(path.join(archiveDir, "occupied.txt"), "conflict\n", "utf8");

  await assert.rejects(() => changeService.archive(changeDir));

  const activeRecord = await repo.readJson(path.join(changeDir, "change.json"));
  assert.equal(activeRecord.status, "verified");
  assert.equal(await repo.exists(changeDir), true);
});

function createServices(options = {}) {
  const repo = new FileRepo();
  const scanService = new ScanService(repo);
  const renderer = new MarkdownRenderer();
  const agentEntries = new AgentEntryService(repo);
  const indexService = new IndexService();
  const profileLoader = new ProfileLoader(repo);
  const initService = new InitService(
    repo,
    scanService,
    renderer,
    agentEntries,
    indexService,
    profileLoader
  );
  const statusService = new StatusService(repo);
  const changeService = new ChangeService(repo, statusService);
  const bugService = new BugService(
    repo,
    statusService,
    undefined,
    options.bugServiceOptions ?? {}
  );

  return {
    repo,
    initService,
    statusService,
    changeService,
    bugService
  };
}

async function populateChangeForApply(changeDir, options = {}) {
  const changeJsonPath = path.join(changeDir, "change.json");
  const record = JSON.parse(await fs.readFile(changeJsonPath, "utf8"));
  record.affects = options.affects ?? ["src/main.ts"];
  await fs.writeFile(changeJsonPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  await fs.writeFile(
    path.join(changeDir, "request.md"),
    [
      "# Request",
      "",
      "## Request",
      "",
      `- Change: \`${record.slug}\``,
      `- Summary: ${options.requestSummary ?? "Implement the requested change."}`,
      "",
      "## Scope",
      "",
      `- In Scope: ${options.inScope ?? "Code, docs, and verification notes needed for the change."}`,
      `- Out Of Scope: ${options.outOfScope ?? "Unrelated cleanup."}`,
      "",
      "## Acceptance Notes",
      "",
      `- Acceptance: ${options.acceptance ?? "The requested behavior is implemented and recorded."}`,
      ""
    ].join("\n"),
    "utf8"
  );

  await fs.writeFile(
    path.join(changeDir, "plan.md"),
    [
      "# Plan",
      "",
      "## Implementation Plan",
      "",
      `- Change: \`${record.slug}\``,
      `- Summary: ${options.planSummary ?? "Make the scoped implementation update."}`,
      "",
      "## Files Or Modules Expected To Change",
      "",
      ...((options.targets ?? options.files ?? ["src/main.ts"])
        .map((target) => `- Target: ${target}`)),
      "",
      "## Risks",
      "",
      `- Risk: ${options.planRisk ?? "Low risk for this test fixture."}`,
      ""
    ].join("\n"),
    "utf8"
  );

  await fs.writeFile(
    path.join(changeDir, "apply.md"),
    [
      "# Apply",
      "",
      "## Applied Changes",
      "",
      `- Change: \`${record.slug}\``,
      `- Summary: ${options.summary ?? "Applied the requested repository update."}`,
      "",
      "## Files Touched",
      "",
      ...((options.files ?? ["src/main.ts - updated the main implementation path"])
        .map((entry) => `- File: ${entry}`)),
      "",
      "## Deviations From Plan",
      "",
      `- Deviation: ${options.deviation ?? "none"}`,
      ""
    ].join("\n"),
    "utf8"
  );
}

async function populateChangeForVerify(changeDir, options = {}) {
  const record = JSON.parse(
    await fs.readFile(path.join(changeDir, "change.json"), "utf8")
  );
  await fs.writeFile(
    path.join(changeDir, "verify.md"),
    [
      "# Verify",
      "",
      "## Automated Checks",
      "",
      `- Change: \`${record.slug}\``,
      ...((options.commands ?? ["npm test"]).map((command) => `- Command: ${command}`)),
      ...((options.results ?? ["`npm test` passed."]).map((result) => `- Result: ${result}`)),
      "",
      "## Manual Validation",
      "",
      `- Validation: ${options.validation ?? "Spot-checked the changed behavior."}`,
      "",
      "## Remaining Risks",
      "",
      `- Risk: ${options.risk ?? "none"}`,
      ""
    ].join("\n"),
    "utf8"
  );
}

async function populateBugQueueEntry(rootDir, bugId, options = {}) {
  const queuePath = path.join(rootDir, BUG_ACTIVE_BUGS_PATH);
  let queue = await fs.readFile(queuePath, "utf8");

  const replacements = {
    Affects: (options.affects ?? ["src/main.ts"]).join(", "),
    Summary: options.summary ?? "The current behavior breaks the expected flow.",
    Actual: options.actual ?? "The buggy path currently triggers the wrong behavior.",
    Expected: options.expected ?? "The expected behavior should remain stable.",
    Repro: options.repro ?? "Run the failing scenario once to reproduce the issue.",
    Investigation: options.investigation ?? "Investigation isolated the likely failing path.",
    Cause: options.cause ?? "A stale assumption in the runtime logic caused the bug.",
    "Fix Summary": options.fixSummary ?? options.summary ?? "Implemented the scoped bug fix.",
    File: (options.files ?? ["src/main.ts - adjusted the failing path"]).join(", "),
    Reason: options.reason ?? "The fix now matches the real runtime condition.",
    Command: options.command ?? "npm test",
    Result: options.result ?? "`npm test` passed.",
    Validation: options.validation ?? "Spot-checked the bug scenario manually.",
    Risk: options.risk ?? "none",
    Gap: options.gap ?? "The agent made the wrong assumption about the failing path.",
    Reality: options.reality ?? "The real logic path differs from the original assumption.",
    "Check First": options.checkFirst ?? "src/main.ts",
    Remember: options.remember ?? "Review the real logic before applying a similar fix again."
  };

  for (const [label, value] of Object.entries(replacements)) {
    queue = replaceBugQueueField(queue, bugId, label, value);
  }

  await fs.writeFile(queuePath, queue, "utf8");
}

function replaceBugQueueField(queue, bugId, label, value) {
  const sectionRegex = new RegExp(
    `## ${escapeRegex(bugId)}:[\\s\\S]*?(?=\\n## bug-\\d{4}:|$)`
  );
  const section = queue.match(sectionRegex)?.[0];
  if (!section) {
    throw new Error(`Missing active bug section: ${bugId}`);
  }

  const labelRegex = new RegExp(`(^- ${escapeRegex(label)}:\\s*).+$`, "m");
  const nextSection = section.replace(labelRegex, `$1${value}`);
  return queue.replace(sectionRegex, nextSection);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createTempRepo(t, prefix) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });
  return rootDir;
}

async function seedRepo(rootDir) {
  await fs.writeFile(
    path.join(rootDir, "README.md"),
    "# OSpec Lite Test Repo\n",
    "utf8"
  );
  await fs.mkdir(path.join(rootDir, "src"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "src", "main.ts"),
    [
      "import { start } from './bootstrap';",
      "",
      "start();",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "src", "bootstrap.ts"),
    [
      "export function start() {",
      "  return 'started';",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8"
  });
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function countOccurrences(content, token) {
  return content.split(token).length - 1;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
