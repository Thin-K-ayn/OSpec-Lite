const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../dist/cli/index.js");
const HALL_PROFILE_ROOT = path.resolve(__dirname, "..", "profiles", "unity-tolua-hall");

test("hall profile init succeeds non-interactively when project name and bootstrap agent are provided", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-hall-profile-init-");
  await seedUnityToLuaHallRepo(rootDir);

  const initResult = runHallProfileInit(rootDir, {
    projectName: "NeoHall",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 0, initResult.stderr);
  assert.match(initResult.stdout, /repository initialized/i);
  assert.match(initResult.stdout, /Project: NeoHall/);
  assert.match(initResult.stdout, /Profile: unity-tolua-hall/);
  assert.match(initResult.stdout, /Bootstrap agent: none/);

  const config = JSON.parse(
    await fs.readFile(path.join(rootDir, ".oslite", "config.json"), "utf8")
  );
  assert.equal(config.documentLanguage, "zh-CN");
  assert.equal(config.profileId, "unity-tolua-hall");
  assert.equal(config.projectName, "NeoHall");
  assert.equal(config.bootstrapAgent, "none");

  const brief = await fs.readFile(
    path.join(rootDir, ".oslite", "docs", "agents", "authoring", "project-brief.md"),
    "utf8"
  );
  assert.match(brief, /NeoHall/);
  assert.match(brief, /Assets\/_GameCenter\/ClientLua\/Main\.lua/);
  assert.match(brief, /Assets\/_GameModule/);
  assert.match(brief, /项目简报/);
});

test("hall profile init fails clearly when the required hall anchors are missing", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-hall-profile-precondition-");
  await seedUnityToLuaHallRepo(rootDir, { includeMainEntry: false });

  const initResult = runHallProfileInit(rootDir, {
    projectName: "Broken Hall Repo",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 1);
  assert.match(initResult.stderr, /Profile unity-tolua-hall requires these repo paths/i);
  assert.match(initResult.stderr, /Assets\/_GameCenter\/ClientLua\/Main\.lua/);
});

test("hall docs verify passes on a compliant hall fixture", async (t) => {
  const rootDir = await createTempRepo(t, "ospec-lite-hall-profile-verify-pass-");
  await seedUnityToLuaHallRepo(rootDir);

  const initResult = runHallProfileInit(rootDir, {
    projectName: "Verify Hall Repo",
    bootstrapAgent: "none"
  });
  assert.equal(initResult.status, 0, initResult.stderr);
  await makeHallProfileDocsCompliant(rootDir);

  const verifyResult = runCli(["docs", "verify", rootDir]);
  assert.equal(verifyResult.status, 0, verifyResult.stderr);
  assert.match(verifyResult.stdout, /docs verification passed/i);
  assert.match(verifyResult.stdout, /Profile: unity-tolua-hall/);
  assert.match(verifyResult.stdout, /\.oslite\/docs\/project\/entrypoints\.md/);
});

test("hall profile assets preserve hall-specific guidance", async () => {
  const agents = await fs.readFile(
    path.join(HALL_PROFILE_ROOT, "templates", "AGENTS.md"),
    "utf8"
  );
  const checklist = await fs.readFile(
    path.join(HALL_PROFILE_ROOT, "authoring-pack", "repo-reading-checklist.md"),
    "utf8"
  );
  const codingRules = await fs.readFile(
    path.join(HALL_PROFILE_ROOT, "templates", "docs", "project", "coding-rules.md"),
    "utf8"
  );
  const quickstart = await fs.readFile(
    path.join(HALL_PROFILE_ROOT, "templates", "docs", "agents", "quickstart.md"),
    "utf8"
  );
  const codexWrapper = await fs.readFile(
    path.join(HALL_PROFILE_ROOT, "wrappers", "codex", "SKILL.md"),
    "utf8"
  );
  const profileReadme = await fs.readFile(
    path.join(HALL_PROFILE_ROOT, "README.md"),
    "utf8"
  );

  assert.match(agents, /unity-tolua-hall/);
  assert.match(agents, /大厅仓库/);
  assert.match(agents, /Assets\/_GameCenter\/ClientLua\/Main\.lua/);
  assert.match(agents, /Assets\/_GameModule/);
  assert.match(agents, /AGENTS\.md/);
  assert.match(agents, /先征求用户明确许可/);
  assert.match(agents, /Assets\/Editor\//);
  assert.match(agents, /真钱流程/);
  assert.match(checklist, /Launch\.cs/);
  assert.match(checklist, /ResDownloadManager\.lua/);
  assert.match(checklist, /Assets\/_GameModule/);
  assert.match(codingRules, /运行时 C# 修改策略/);
  assert.match(codingRules, /用户明确许可/);
  assert.match(codingRules, /支付改动策略/);
  assert.match(codingRules, /二次确认/);
  assert.match(quickstart, /改打包内运行时 C# 前先征求用户明确许可/);
  assert.match(quickstart, /先与用户二次确认/);
  assert.match(codexWrapper, /oslite init --profile unity-tolua-hall/);
  assert.match(codexWrapper, /--bootstrap-agent codex/);
  assert.match(codexWrapper, /Assets\/_GameModule/);
  assert.match(profileReadme, /unity-tolua-hall/);
  assert.match(profileReadme, /oslite docs verify/);
  assert.match(profileReadme, /Assets\/_GameModule/);
  assert.match(profileReadme, /非 Editor 的运行时 C# 修改默认需要先征求用户许可/);
  assert.match(profileReadme, /必须先与用户二次确认再改/);
});

async function createTempRepo(t, prefix) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });
  return rootDir;
}

async function seedUnityToLuaHallRepo(rootDir, options = {}) {
  const includeMainEntry = options.includeMainEntry !== false;
  const files = {
    "README.md": "# NeoHall\n",
    "Assets/_GameCenter/FrameWork/Behaviours/Launch.cs": "public class Launch {}\n",
    "Assets/_GameCenter/LuaFramework/Scripts/Main.cs": "public class Main {}\n",
    "Assets/_GameCenter/ClientLua/CC.lua": "return {}\n",
    "Assets/_GameCenter/ClientLua/Model/HallCenter.lua": "return {}\n",
    "Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua": "return {}\n",
    "Assets/_GameCenter/ClientLua/Model/Network/Network.lua": "return {}\n",
    "Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua": "return {}\n",
    "Assets/_GameCenter/ClientLua/View/ViewCenter.lua": "return {}\n",
    "Assets/_GameCenter/FrameWork/IO/NEO_PARTY_GAMES_Launcher.cs": "public class NEO_PARTY_GAMES_Launcher {}\n",
    "Assets/_GameCenter/FrameWork/Common/Client.cs": "public class Client {}\n",
    "Assets/_GameCenter/LuaFramework/Scripts/Manager/NEO_PARTY_GAMES_GameManager.cs": "public class NEO_PARTY_GAMES_GameManager {}\n",
    "Assets/_GameCenter/LuaFramework/Scripts/Common/NEO_PARTY_GAMES_AppConst.cs": "public class NEO_PARTY_GAMES_AppConst {}\n",
    "Assets/_GameCenter/Root/root.unity": "%YAML 1.1\n",
    "Assets/_GameCenter/_Resources/HallScene/main.unity": "%YAML 1.1\n"
  };

  if (includeMainEntry) {
    files["Assets/_GameCenter/ClientLua/Main.lua"] = "return {}\n";
  }

  const directories = [
    "Assets/_GameCenter/ClientLua/Common",
    "Assets/_GameCenter/ClientLua/Model",
    "Assets/_GameCenter/ClientLua/SubGame",
    "Assets/_GameCenter/FrameWork/Editor",
    "Assets/_GameCenter/LuaFramework/ToLua",
    "Assets/_GameModule",
    "Assets/_GameWrap/Generate",
    "Assets/Common/Unity-Logs-Viewer/Reporter/Test",
    "Assets/Editor",
    "Channel",
    "UnityInterface",
    "Tools"
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

async function makeHallProfileDocsCompliant(rootDir) {
  const docPaths = [
    ".oslite/docs/project/overview.md",
    ".oslite/docs/project/architecture.md",
    ".oslite/docs/project/repo-map.md",
    ".oslite/docs/project/entrypoints.md",
    ".oslite/docs/project/glossary.md",
    ".oslite/docs/project/coding-rules.md",
    ".oslite/docs/agents/quickstart.md",
    ".oslite/docs/agents/change-playbook.md",
    ".oslite/docs/agents/authoring/evidence-map.md"
  ];

  for (const relativePath of docPaths) {
    await rewriteFile(rootDir, relativePath, (content) =>
      content.replaceAll("待补充", "已补充").replaceAll("TBD", "Done")
    );
  }
}

async function rewriteFile(rootDir, relativePath, transform) {
  const absolutePath = path.join(rootDir, relativePath);
  const original = await fs.readFile(absolutePath, "utf8");
  await fs.writeFile(absolutePath, transform(original), "utf8");
}

function runHallProfileInit(rootDir, overrides = {}, cliOptions = {}) {
  return runCli(
    [
      "init",
      "--profile",
      "unity-tolua-hall",
      "--project-name",
      overrides.projectName ?? "NeoHall",
      "--bootstrap-agent",
      overrides.bootstrapAgent ?? "none",
      rootDir
    ],
    cliOptions
  );
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
