import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import {
  BootstrapAgent,
  DocumentLanguage,
  HostAgent
} from "../../core/ospec-lite-types";
import {
  InitIncompleteError,
  OSpecLiteError,
  ProfileInitAnswersRequiredError
} from "../../core/ospec-lite-errors";
import { CliServices } from "../cli-services";
import { isCompleteStatusConfig, printAgentWrappers, readFlagValue } from "../cli-shared";

const PROFILE_FLAG_UNSUPPORTED_MESSAGE =
  "--project-name and --bootstrap-agent are only supported with a profile that requires those init values.";

export async function handleInit(args: string[], services: CliServices): Promise<void> {
  const { pathArg, documentLanguage, profileId, projectName, bootstrapAgent } =
    parseInitArgs(args);
  const targetDir = path.resolve(pathArg);
  const before = await services.initService.getInitState(targetDir);

  if (before.state === "initialized") {
    const status = await services.statusService.getStatus(targetDir);
    console.log("OSpec Lite: repository already initialized");
    console.log(`Path: ${targetDir}`);
    console.log(`Config: ${path.relative(targetDir, before.configPath).replace(/\\/g, "/")}`);
    if (isCompleteStatusConfig(status.config)) {
      if (status.config.projectName) {
        console.log(`Project: ${status.config.projectName}`);
      }
      if (status.config.profileId) {
        console.log(`Profile: ${status.config.profileId}`);
      }
      if (status.config.bootstrapAgent) {
        console.log(`Bootstrap agent: ${status.config.bootstrapAgent}`);
      }
      console.log(`Agent targets: ${status.config.agentTargets.join(", ")}`);
      console.log("Agent entry files:");
      for (const [target, fileName] of Object.entries(status.config.agentEntryFiles)) {
        console.log(`- ${target}: ${fileName}`);
      }
      printAgentWrappers(status.config.agentWrapperFiles);
      console.log(`Project docs: ${status.config.projectDocsRoot}`);
      if (status.config.authoringPackRoot) {
        console.log(`Authoring pack: ${status.config.authoringPackRoot}`);
      }
      console.log(`Changes root: ${status.config.changeRoot}`);
    }
    return;
  }

  if (before.state === "incomplete") {
    throw new InitIncompleteError(before.missingMarkers);
  }

  const resolvedAnswers = await resolveProfileInitAnswers(targetDir, services, {
    profileId,
    projectName,
    bootstrapAgent
  });
  const result = await services.initService.init(targetDir, {
    documentLanguage,
    profileId,
    projectName: resolvedAnswers.projectName,
    bootstrapAgent: resolvedAnswers.bootstrapAgent,
    hostAgent: detectHostAgent()
  });
  console.log("OSpec Lite: repository initialized");
  console.log(`Path: ${targetDir}`);
  console.log(`Config: ${path.relative(targetDir, result.configPath).replace(/\\/g, "/")}`);
  console.log(`Index: ${path.relative(targetDir, result.indexPath).replace(/\\/g, "/")}`);
  if (result.config?.projectName) {
    console.log(`Project: ${result.config.projectName}`);
  }
  if (result.config?.profileId) {
    console.log(`Profile: ${result.config.profileId}`);
  }
  if (result.config?.bootstrapAgent) {
    console.log(`Bootstrap agent: ${result.config.bootstrapAgent}`);
  }
  if (result.bootstrapPlan) {
    if (result.bootstrapPlan.shouldBootstrapNow) {
      console.log("Bootstrapping now...");
      if (result.bootstrapPlan.wrapperPath) {
        console.log(`Bootstrap wrapper: ${result.bootstrapPlan.wrapperPath}`);
      }
      if (result.bootstrapPlan.nextStep) {
        console.log(`Bootstrap command: ${result.bootstrapPlan.nextStep}`);
      }
    } else if (result.bootstrapPlan.nextStep) {
      console.log("Next step:");
      console.log(result.bootstrapPlan.nextStep);
      if (result.bootstrapPlan.wrapperPath) {
        console.log(`Wrapper: ${result.bootstrapPlan.wrapperPath}`);
      }
    }
  }
}

export function parseInitArgs(args: string[]): {
  pathArg: string;
  documentLanguage?: DocumentLanguage;
  profileId?: string;
  projectName?: string;
  bootstrapAgent?: BootstrapAgent;
} {
  let pathArg: string | undefined;
  let documentLanguage: DocumentLanguage | undefined;
  let profileId: string | undefined;
  let projectName: string | undefined;
  let bootstrapAgent: BootstrapAgent | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--document-language") {
      const next = readFlagValue(args, index, "--document-language");
      documentLanguage = parseDocumentLanguage(next.value);
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--document-language=")) {
      documentLanguage = parseDocumentLanguage(
        arg.slice("--document-language=".length)
      );
      continue;
    }

    if (arg === "--profile") {
      const next = readFlagValue(args, index, "--profile");
      profileId = next.value;
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      profileId = arg.slice("--profile=".length);
      continue;
    }

    if (arg === "--project-name") {
      const next = readFlagValue(args, index, "--project-name");
      projectName = next.value.trim();
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--project-name=")) {
      projectName = arg.slice("--project-name=".length).trim();
      continue;
    }

    if (arg === "--bootstrap-agent") {
      const next = readFlagValue(args, index, "--bootstrap-agent");
      bootstrapAgent = parseBootstrapAgent(next.value);
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--bootstrap-agent=")) {
      bootstrapAgent = parseBootstrapAgent(arg.slice("--bootstrap-agent=".length));
      continue;
    }

    if (arg.startsWith("--")) {
      throw new OSpecLiteError(`Unsupported option: ${arg}`);
    }

    if (pathArg) {
      throw new OSpecLiteError(`Unexpected argument: ${arg}`);
    }

    pathArg = arg;
  }

  return {
    pathArg: pathArg ?? ".",
    documentLanguage,
    profileId,
    projectName,
    bootstrapAgent
  };
}

function parseDocumentLanguage(value: string): DocumentLanguage {
  if (value === "en-US" || value === "zh-CN") {
    return value;
  }
  throw new OSpecLiteError(`Unsupported document language: ${value}`);
}

function parseBootstrapAgent(value: string): BootstrapAgent {
  if (value === "codex" || value === "claude-code" || value === "none") {
    return value;
  }
  throw new OSpecLiteError(`Unsupported bootstrap agent: ${value}`);
}

async function resolveProfileInitAnswers(
  targetDir: string,
  services: CliServices,
  values: {
    profileId?: string;
    projectName?: string;
    bootstrapAgent?: BootstrapAgent;
  }
): Promise<{
  projectName?: string;
  bootstrapAgent?: BootstrapAgent;
}> {
  if (!values.profileId) {
    if (values.projectName || values.bootstrapAgent) {
      throw new OSpecLiteError(PROFILE_FLAG_UNSUPPORTED_MESSAGE);
    }
    return {};
  }

  const profile = await services.profileLoader.loadProfile(values.profileId);
  const requiredFields = new Set(profile.requiredInitFields ?? []);

  if (requiredFields.size === 0) {
    if (values.projectName || values.bootstrapAgent) {
      throw new OSpecLiteError(PROFILE_FLAG_UNSUPPORTED_MESSAGE);
    }
    return values;
  }

  if (values.projectName && !requiredFields.has("projectName")) {
    throw new OSpecLiteError(PROFILE_FLAG_UNSUPPORTED_MESSAGE);
  }
  if (values.bootstrapAgent && !requiredFields.has("bootstrapAgent")) {
    throw new OSpecLiteError(PROFILE_FLAG_UNSUPPORTED_MESSAGE);
  }

  const missingFields: string[] = [];
  if (requiredFields.has("projectName") && !values.projectName) {
    missingFields.push("projectName");
  }
  if (requiredFields.has("bootstrapAgent") && !values.bootstrapAgent) {
    missingFields.push("bootstrapAgent");
  }

  if (missingFields.length === 0) {
    return values;
  }

  if (!isInteractiveInitAllowed()) {
    throw new ProfileInitAnswersRequiredError(values.profileId, missingFields);
  }

  const defaults = {
    projectName: path.basename(targetDir),
    bootstrapAgent: "none" as BootstrapAgent
  };
  const prompter = await createInitPrompter();

  try {
    const projectName = requiredFields.has("projectName")
      ? values.projectName ??
        (await prompter.ask("Project name", defaults.projectName))
      : values.projectName;
    const bootstrapAnswer = requiredFields.has("bootstrapAgent")
      ? values.bootstrapAgent ??
        (await prompter.ask(
          "Bootstrap agent (codex/claude-code/none)",
          defaults.bootstrapAgent
        ).then((answer) => parseBootstrapAgent(answer)))
      : values.bootstrapAgent;

    return {
      projectName,
      bootstrapAgent: bootstrapAnswer
    };
  } finally {
    prompter.close();
  }
}

function isInteractiveInitAllowed(): boolean {
  return (
    process.env.OSLITE_FORCE_INTERACTIVE === "1" ||
    (process.stdin.isTTY === true && process.stdout.isTTY === true)
  );
}

function detectHostAgent(): HostAgent {
  const value = process.env.OSLITE_HOST_AGENT;
  if (value === "codex" || value === "claude-code") {
    return value;
  }
  return "unknown";
}

interface InitPrompter {
  ask(label: string, defaultValue: string): Promise<string>;
  close(): void;
}

async function createInitPrompter(): Promise<InitPrompter> {
  if (process.stdin.isTTY === true && process.stdout.isTTY === true) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return {
      ask: async (label: string, defaultValue: string) => {
        const answer = (await rl.question(`${label} [${defaultValue}]: `)).trim();
        return answer.length > 0 ? answer : defaultValue;
      },
      close: () => rl.close()
    };
  }

  const answers = await readPromptAnswersFromStdin();
  let cursor = 0;

  return {
    ask: async (label: string, defaultValue: string) => {
      process.stdout.write(`${label} [${defaultValue}]: `);
      const answer = (answers[cursor] ?? "").trim();
      cursor += 1;
      return answer.length > 0 ? answer : defaultValue;
    },
    close: () => undefined
  };
}

async function readPromptAnswersFromStdin(): Promise<string[]> {
  process.stdin.setEncoding("utf8");
  let content = "";

  for await (const chunk of process.stdin) {
    content += chunk;
  }

  return content
    .split(/\r?\n/)
    .filter((line, index, items) => !(index === items.length - 1 && line.length === 0));
}
