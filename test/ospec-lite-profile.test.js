const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../dist/cli/index.js");
const PROFILE_ROOT = path.resolve(__dirname, "..", "profiles", "unity-tolua-game");

test("profile init succeeds non-interactively when project name and bootstrap agent are provided", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-init-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runProfileInit(rootDir, {
    projectName: "Test Unity ToLua Repo",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.match(initResult.stdout, /repository initialized/i);
  assert.match(initResult.stdout, /Project: Test Unity ToLua Repo/);
  assert.match(initResult.stdout, /Profile: unity-tolua-game/);
  assert.match(initResult.stdout, /Bootstrap agent: none/);
  assert.match(initResult.stdout, /Next step:/);
  assert.match(initResult.stdout, /No bootstrap step configured\./);

  const config = JSON.parse(
    await fs.readFile(path.join(rootDir, ".oslite", "config.json"), "utf8")
  );
  assert.equal(config.documentLanguage, "zh-CN");
  assert.equal(config.profileId, "unity-tolua-game");
  assert.equal(config.projectName, "Test Unity ToLua Repo");
  assert.equal(config.bootstrapAgent, "none");
  assert.equal(config.authoringPackRoot, "docs/agents/authoring");
  assert.deepEqual(config.agentWrapperFiles, {
    codex: [".codex/skills/oslite-fill-project-docs/SKILL.md"],
    "claude-code": [".claude/commands/oslite-fill-project-docs.md"]
  });

  const brief = await fs.readFile(
    path.join(rootDir, "docs", "agents", "authoring", "project-brief.md"),
    "utf8"
  );
  assert.match(brief, /Test Unity ToLua Repo/);
  assert.match(brief, /`none`/);
  assert.doesNotMatch(brief, /\{\{projectName\}\}/);

  for (const relativePath of [
    "docs/agents/authoring/doc-contract.md",
    "docs/agents/authoring/project-brief.md",
    "docs/agents/authoring/repo-reading-checklist.md",
    "docs/agents/authoring/evidence-map.md",
    "docs/agents/authoring/fill-project-docs.md",
    "docs/agents/authoring/doc-task-checklist.json",
    ".codex/skills/oslite-fill-project-docs/SKILL.md",
    ".claude/commands/oslite-fill-project-docs.md"
  ]) {
    await assert.doesNotReject(() => fs.access(path.join(rootDir, relativePath)));
  }

  const statusResult = runCli(["status", rootDir]);
  assert.equal(statusResult.status, 0, statusResult.stderr);
  assert.match(statusResult.stdout, /Project: Test Unity ToLua Repo/);
  assert.match(statusResult.stdout, /Profile: unity-tolua-game/);
  assert.match(statusResult.stdout, /Bootstrap agent: none/);
  assert.match(statusResult.stdout, /Authoring pack: docs\/agents\/authoring/);
  assert.match(statusResult.stdout, /Agent wrappers:/);
  assert.match(
    statusResult.stdout,
    /- codex: \.codex\/skills\/oslite-fill-project-docs\/SKILL\.md/
  );
  assert.match(
    statusResult.stdout,
    /- claude-code: \.claude\/commands\/oslite-fill-project-docs\.md/
  );
});

test("profile init prompts for project name and bootstrap agent in interactive mode", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-interactive-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runCli(["init", "--profile", "unity-tolua-game", rootDir], {
    env: {
      OSLITE_FORCE_INTERACTIVE: "1"
    },
    input: "Interactive Game\ncodex\n"
  });
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.match(initResult.stdout, /Project name \[/);
  assert.match(initResult.stdout, /Bootstrap agent \(codex\/claude-code\/none\) \[/);

  const config = JSON.parse(
    await fs.readFile(path.join(rootDir, ".oslite", "config.json"), "utf8")
  );
  assert.equal(config.projectName, "Interactive Game");
  assert.equal(config.bootstrapAgent, "codex");
});

test("profile init skips the project name question when --project-name is provided", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-project-flag-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runCli(
    [
      "init",
      "--profile",
      "unity-tolua-game",
      "--project-name",
      "Preset Name",
      rootDir
    ],
    {
      env: { OSLITE_FORCE_INTERACTIVE: "1" },
      input: "claude-code\n"
    }
  );
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.doesNotMatch(initResult.stdout, /Project name \[/);
  assert.match(initResult.stdout, /Bootstrap agent: claude-code/);

  const config = JSON.parse(
    await fs.readFile(path.join(rootDir, ".oslite", "config.json"), "utf8")
  );
  assert.equal(config.projectName, "Preset Name");
  assert.equal(config.bootstrapAgent, "claude-code");
});

test("profile init skips the bootstrap question when --bootstrap-agent is provided", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-bootstrap-flag-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runCli(
    [
      "init",
      "--profile",
      "unity-tolua-game",
      "--bootstrap-agent",
      "codex",
      rootDir
    ],
    {
      env: { OSLITE_FORCE_INTERACTIVE: "1" },
      input: "Prompted Name\n"
    }
  );
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.match(initResult.stdout, /Project: Prompted Name/);
  assert.doesNotMatch(initResult.stdout, /Bootstrap agent \(codex\/claude-code\/none\) \[/);

  const config = JSON.parse(
    await fs.readFile(path.join(rootDir, ".oslite", "config.json"), "utf8")
  );
  assert.equal(config.projectName, "Prompted Name");
  assert.equal(config.bootstrapAgent, "codex");
});

test("profile init fails clearly in non-interactive mode when init answers are missing", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-non-interactive-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runCli(["init", "--profile", "unity-tolua-game", rootDir]);
  assert.equal(initResult.status, 1);
  assert.match(
    initResult.stderr,
    /Profile unity-tolua-game requires these init values in non-interactive mode/i
  );
  assert.match(initResult.stderr, /projectName/);
  assert.match(initResult.stderr, /bootstrapAgent/);
});

test("profile init fails clearly when the required MJGame entry is missing", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-precondition-");
  await seedUnityToLuaRepo(rootDir, { includeMainEntry: false });

  const initResult = runProfileInit(rootDir, {
    projectName: "Missing Entry Repo",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 1);
  assert.match(initResult.stderr, /Profile unity-tolua-game requires these repo paths/i);
  assert.match(initResult.stderr, /Script\/MJGame\.lua/);
});

test("profile init rejects project-specific flags outside the unity-tolua profile", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-flags-generic-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runCli(["init", "--project-name", "Generic", rootDir]);
  assert.equal(initResult.status, 1);
  assert.match(
    initResult.stderr,
    /--project-name and --bootstrap-agent are only supported with --profile unity-tolua-game/i
  );
});

test("profile status becomes incomplete when a wrapper file is missing", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-wrapper-marker-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runProfileInit(rootDir, {
    projectName: "Wrapper Marker Repo",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 0, initResult.stderr);

  await fs.rm(path.join(rootDir, ".claude", "commands", "oslite-fill-project-docs.md"));

  const statusResult = runCli(["status", rootDir]);
  assert.equal(statusResult.status, 0, statusResult.stderr);
  assert.match(statusResult.stdout, /State: incomplete/);
  assert.match(
    statusResult.stdout,
    /\.claude\/commands\/oslite-fill-project-docs\.md/
  );
});

test("profile assets preserve literal Chinese guidance", async () => {
  const agents = await fs.readFile(
    path.join(PROFILE_ROOT, "templates", "AGENTS.md"),
    "utf8"
  );
  const contract = await fs.readFile(
    path.join(PROFILE_ROOT, "authoring-pack", "doc-contract.md"),
    "utf8"
  );
  const checklist = await fs.readFile(
    path.join(PROFILE_ROOT, "authoring-pack", "repo-reading-checklist.md"),
    "utf8"
  );
  const brief = await fs.readFile(
    path.join(PROFILE_ROOT, "authoring-pack", "project-brief.md"),
    "utf8"
  );
  const codexWrapper = await fs.readFile(
    path.join(PROFILE_ROOT, "wrappers", "codex", "SKILL.md"),
    "utf8"
  );
  const claudeWrapper = await fs.readFile(
    path.join(PROFILE_ROOT, "wrappers", "claude", "oslite-fill-project-docs.md"),
    "utf8"
  );

  assert.match(agents, /先完成 `\{\{authoringPackRoot}}\/evidence-map\.md`/);
  assert.match(agents, /用 unity-tolua-game profile 初始化/);
  assert.match(contract, /文档编写合同/);
  assert.match(checklist, /Script\/MJGame\.lua/);
  assert.match(brief, /项目名称：`\{\{projectName\}\}`/);
  assert.match(brief, /Bootstrap Agent：`\{\{bootstrapAgent\}\}`/);
  assert.match(codexWrapper, /oslite init --profile unity-tolua-game/);
  assert.match(codexWrapper, /--bootstrap-agent codex/);
  assert.match(codexWrapper, /\{\{authoringPackRoot}}\/evidence-map\.md/);
  assert.match(codexWrapper, /oslite docs verify \./);
  assert.match(claudeWrapper, /oslite init --profile unity-tolua-game/);
  assert.match(claudeWrapper, /--bootstrap-agent claude-code/);
  assert.match(claudeWrapper, /\{\{authoringPackRoot}}\/evidence-map\.md/);
  assert.match(claudeWrapper, /\$ARGUMENTS/);
});

test("matching codex host prints bootstrapping output instead of a next step", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-host-codex-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runProfileInit(
    rootDir,
    {
      projectName: "Codex Bootstrap Repo",
      bootstrapAgent: "codex"
    },
    {
      env: { OSLITE_HOST_AGENT: "codex" }
    }
  );
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.match(initResult.stdout, /Bootstrapping now\.\.\./);
  assert.match(
    initResult.stdout,
    /Bootstrap wrapper: \.codex\/skills\/oslite-fill-project-docs\/SKILL\.md/
  );
  assert.match(
    initResult.stdout,
    /Bootstrap command: Use \$oslite-fill-project-docs to fill the project docs for this repo\./
  );
  assert.doesNotMatch(initResult.stdout, /Next step:/);
});

test("matching claude host prints bootstrapping output instead of a next step", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-host-claude-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runProfileInit(
    rootDir,
    {
      projectName: "Claude Bootstrap Repo",
      bootstrapAgent: "claude-code"
    },
    {
      env: { OSLITE_HOST_AGENT: "claude-code" }
    }
  );
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.match(initResult.stdout, /Bootstrapping now\.\.\./);
  assert.match(
    initResult.stdout,
    /Bootstrap wrapper: \.claude\/commands\/oslite-fill-project-docs\.md/
  );
  assert.match(initResult.stdout, /Bootstrap command: \/oslite-fill-project-docs/);
  assert.doesNotMatch(initResult.stdout, /Next step:/);
});

test("mismatched or unknown hosts print a single next step", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-host-next-step-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runProfileInit(
    rootDir,
    {
      projectName: "Next Step Repo",
      bootstrapAgent: "codex"
    },
    {
      env: { OSLITE_HOST_AGENT: "unknown" }
    }
  );
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.match(initResult.stdout, /Next step:/);
  assert.match(
    initResult.stdout,
    /Use \$oslite-fill-project-docs to fill the project docs for this repo\./
  );
  assert.match(
    initResult.stdout,
    /Wrapper: \.codex\/skills\/oslite-fill-project-docs\/SKILL\.md/
  );
  assert.doesNotMatch(initResult.stdout, /Bootstrapping now\.\.\./);
});

test("docs verify fails on generated profile docs until evidence and final docs are filled", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-placeholders-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runProfileInit(rootDir, {
    projectName: "Placeholder Repo",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 0, initResult.stderr);

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(verifyResult.stderr, /docs verification failed/i);
  assert.match(verifyResult.stderr, /Contains placeholder text that must be replaced/i);
});

test("docs verify fails when project brief is missing", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-brief-missing-");
  await seedUnityToLuaRepo(rootDir);

  runProfileInit(rootDir, { projectName: "Brief Missing Repo", bootstrapAgent: "none" });
  await makeProfileDocsCompliant(rootDir);
  await fs.rm(path.join(rootDir, "docs", "agents", "authoring", "project-brief.md"));

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(verifyResult.stderr, /Missing authoring pack file: docs\/agents\/authoring\/project-brief\.md/);
});

test("docs verify fails when evidence map is missing", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-evidence-missing-");
  await seedUnityToLuaRepo(rootDir);

  runProfileInit(rootDir, { projectName: "Evidence Missing Repo", bootstrapAgent: "none" });
  await makeProfileDocsCompliant(rootDir);
  await fs.rm(path.join(rootDir, "docs", "agents", "authoring", "evidence-map.md"));

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(verifyResult.stderr, /Missing authoring pack file: docs\/agents\/authoring\/evidence-map\.md/);
});

test("docs verify fails when evidence map sections are incomplete", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-evidence-sections-");
  await seedUnityToLuaRepo(rootDir);

  runProfileInit(rootDir, { projectName: "Evidence Sections Repo", bootstrapAgent: "none" });
  await makeProfileDocsCompliant(rootDir);
  await rewriteFile(rootDir, "docs/agents/authoring/evidence-map.md", (content) =>
    content.replace("## 网络入口", "## 网络")
  );

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(verifyResult.stderr, /Missing required heading: ## 网络入口/);
});

test("docs verify fails when final docs miss headings or evidence labels", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-final-docs-");
  await seedUnityToLuaRepo(rootDir);

  runProfileInit(rootDir, { projectName: "Final Docs Repo", bootstrapAgent: "none" });
  await makeProfileDocsCompliant(rootDir);
  await rewriteFile(rootDir, "docs/project/overview.md", (content) =>
    content.replace("## 主流程", "## 流程")
  );
  await rewriteFile(rootDir, "docs/project/entrypoints.md", (content) =>
    content.replace("证据文件：", "相关文件：")
  );

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(verifyResult.stderr, /Missing required heading: ## 主流程/);
  assert.match(verifyResult.stderr, /missing label 证据文件/i);
});

test("docs verify reports missing evidence paths clearly", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-missing-path-");
  await seedUnityToLuaRepo(rootDir);

  runProfileInit(rootDir, { projectName: "Missing Path Repo", bootstrapAgent: "none" });
  await makeProfileDocsCompliant(rootDir);
  await rewriteFile(rootDir, "docs/project/architecture.md", (content) =>
    content.replace(
      "证据文件：\n- `Script/MJGame.lua`",
      "证据文件：\n- `Script/DoesNotExist.lua`"
    )
  );

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(
    verifyResult.stderr,
    /references missing evidence path: Script\/DoesNotExist\.lua/
  );
});

test("docs verify blocks forbidden Editor scope expansion", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-editor-scope-");
  await seedUnityToLuaRepo(rootDir);

  runProfileInit(rootDir, { projectName: "Editor Scope Repo", bootstrapAgent: "none" });
  await makeProfileDocsCompliant(rootDir);
  await rewriteFile(rootDir, "docs/project/overview.md", (content) =>
    `${content}\n\n## Editor\n- 这里不应展开 Editor。\n`
  );

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(verifyResult.stderr, /Contains content forbidden by the active profile/);
});

test("docs verify fails when startup entry does not reference Script/MJGame.lua", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-mjgame-rule-");
  await seedUnityToLuaRepo(rootDir);

  runProfileInit(rootDir, { projectName: "MJGame Rule Repo", bootstrapAgent: "none" });
  await makeProfileDocsCompliant(rootDir);
  await rewriteFile(rootDir, "docs/project/entrypoints.md", (content) =>
    content.replaceAll("`Script/MJGame.lua`", "`Script/OtherEntry.lua`")
  );

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 1);
  assert.match(
    verifyResult.stderr,
    /Section 启动入口 is missing required snippet: Script\/MJGame\.lua/
  );
});

test("docs verify passes on a compliant unity-tolua fixture", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-profile-verify-pass-");
  await seedUnityToLuaRepo(rootDir);

  const initResult = runProfileInit(rootDir, {
    projectName: "Verify Pass Repo",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 0, initResult.stderr);
  await makeProfileDocsCompliant(rootDir);

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 0, verifyResult.stderr);
  assert.match(verifyResult.stdout, /docs verification passed/i);
  assert.match(verifyResult.stdout, /Profile: unity-tolua-game/);
  assert.match(verifyResult.stdout, /docs\/project\/entrypoints\.md/);
});

async function createTempRepo(t, prefix) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });
  return rootDir;
}

async function seedUnityToLuaRepo(rootDir, options = {}) {
  const includeMainEntry = options.includeMainEntry !== false;
  const files = {
    "README.md": "# Unity ToLua Repo\n"
  };

  if (includeMainEntry) {
    files["Script/MJGame.lua"] = "return {}\n";
  }

  const directories = [
    "Script",
    "Script/BY_View",
    "Script/BY_Model",
    "Script/BY_Ctrl",
    "Script/BY_Network",
    "Script/BY_ResourceMgr",
    "Script/BY_Config",
    "Script/BY_Effect",
    "Script/BY_Fish",
    "Script/Framework_Bundle",
    "_Resources",
    "Doc",
    "Editor"
  ];

  for (const relativeDir of directories) {
    await fs.mkdir(path.join(rootDir, relativeDir), { recursive: true });
  }

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
  }
}

async function makeProfileDocsCompliant(rootDir) {
  const docPaths = [
    "docs/project/overview.md",
    "docs/project/architecture.md",
    "docs/project/repo-map.md",
    "docs/project/entrypoints.md",
    "docs/project/glossary.md",
    "docs/project/coding-rules.md",
    "docs/agents/quickstart.md",
    "docs/agents/change-playbook.md",
    "docs/agents/authoring/evidence-map.md"
  ];

  for (const relativePath of docPaths) {
    await rewriteFile(rootDir, relativePath, (content) =>
      content.replaceAll("待补充", "已补充")
    );
  }
}

async function rewriteFile(rootDir, relativePath, transform) {
  const absolutePath = path.join(rootDir, relativePath);
  const original = await fs.readFile(absolutePath, "utf8");
  await fs.writeFile(absolutePath, transform(original), "utf8");
}

function runProfileInit(rootDir, overrides = {}, cliOptions = {}) {
  const args = profileInitArgs(rootDir, overrides);
  return runCli(args, cliOptions);
}

function profileInitArgs(rootDir, overrides = {}) {
  const projectName = overrides.projectName ?? "Unity ToLua Test Repo";
  const bootstrapAgent = overrides.bootstrapAgent ?? "none";

  return [
    "init",
    "--profile",
    "unity-tolua-game",
    "--project-name",
    projectName,
    "--bootstrap-agent",
    bootstrapAgent,
    rootDir
  ];
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
    input: options.input,
    env: {
      ...process.env,
      ...options.env
    }
  });
}
