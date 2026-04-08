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
const {
  AGENTS_MANAGED_END,
  AGENTS_MANAGED_START,
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
  const result = await initService.init(rootDir, "zh-CN");

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
  const overview = await repo.readText(path.join(rootDir, "docs", "project", "overview.md"));

  assert.match(overview, /Project Overview/);
  assert.ok(agents.includes(AGENTS_MANAGED_START));
  assert.ok(claude.includes(CLAUDE_MANAGED_START));
  assert.ok(claude.includes("@AGENTS.md"));

  const status = await statusService.getStatus(rootDir);
  assert.equal(status.state, "initialized");
  assert.equal(status.activeChanges.length, 0);
  assert.equal(status.archivedChanges.length, 0);
});

test("cli init is one-shot and preserves human edits on rerun", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-rerun-");
  await seedRepo(rootDir);

  const first = runCli(["init", rootDir]);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /repository initialized/i);

  const overviewPath = path.join(rootDir, "docs", "project", "overview.md");
  const customOverview = "# Custom Overview\n\nThis file was edited by a human.\n";
  await fs.writeFile(overviewPath, customOverview, "utf8");

  const second = runCli(["init", rootDir]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already initialized/i);

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

test("change workflow advances from draft through archive", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-change-");
  await seedRepo(rootDir);

  const { repo, initService, statusService, changeService } = createServices();
  await initService.init(rootDir, "en-US");

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
  await initService.init(rootDir, "en-US");

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
    docsRoot: "docs/project",
    agentDocsRoot: "docs/agents",
    rules: ["Use the managed AGENTS block."],
    importantFiles: ["AGENTS.md", "docs/project/overview.md"]
  });
  const claudeSection = claudeAdapter.buildSection({
    projectName: "Managed Update Repo",
    summary: "Updated summary for CLAUDE.",
    docsRoot: "docs/project",
    agentDocsRoot: "docs/agents",
    rules: ["Use the managed CLAUDE block."],
    importantFiles: ["CLAUDE.md", "docs/project/overview.md"]
  });

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
  await initService.init(rootDir, "en-US");

  await assert.rejects(
    () => changeService.newChange(rootDir, "Invalid_Slug"),
    (error) => {
      assert.ok(error instanceof InvalidChangeSlugError);
      assert.match(error.message, /invalid change slug/i);
      return true;
    }
  );
});

test("newChange rejects duplicate slugs", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-duplicate-slug-");
  await seedRepo(rootDir);

  const { initService, changeService } = createServices();
  await initService.init(rootDir, "en-US");

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
  await initService.init(rootDir, "en-US");

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
  await initService.init(rootDir, "en-US");

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

function createServices() {
  const repo = new FileRepo();
  const scanService = new ScanService(repo);
  const renderer = new MarkdownRenderer();
  const agentEntries = new AgentEntryService(repo);
  const indexService = new IndexService();
  const initService = new InitService(
    repo,
    scanService,
    renderer,
    agentEntries,
    indexService
  );
  const statusService = new StatusService(repo);
  const changeService = new ChangeService(repo, statusService);

  return {
    repo,
    initService,
    statusService,
    changeService
  };
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

function countOccurrences(content, token) {
  return content.split(token).length - 1;
}
