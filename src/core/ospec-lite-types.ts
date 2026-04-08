export type DocumentLanguage = "en-US" | "zh-CN";

export type AgentTarget = "codex" | "claude-code";

export type InitState = "uninitialized" | "initialized" | "incomplete";

export type ChangeStatus = "draft" | "active" | "applied" | "verified" | "archived";

export interface OSpecLiteConfig {
  version: 1;
  documentLanguage: DocumentLanguage;
  initializedAt: string;
  agentTargets: AgentTarget[];
  agentEntryFiles: Record<AgentTarget, string>;
  projectDocsRoot: string;
  agentDocsRoot: string;
  changeRoot: string;
  archiveLayout: "date-slug";
}

export interface RuleItem {
  id: string;
  text: string;
  source: "default" | "harvested";
}

export interface DirectoryMapItem {
  path: string;
  kind: "directory" | "file";
  role: string;
}

export interface EntryPointItem {
  path: string;
  score: number;
  reasons: string[];
}

export interface RepositoryScanResult {
  projectName: string;
  rootDir: string;
  directoryMap: DirectoryMapItem[];
  entrypoints: EntryPointItem[];
  rules: RuleItem[];
  importantFiles: string[];
  glossarySeeds: string[];
  signals: Record<string, boolean>;
}

export interface OSpecLiteIndex {
  version: 1;
  generatedAt: string;
  project: {
    name: string;
    documentLanguage: DocumentLanguage;
  };
  agentTargets: AgentTarget[];
  roots: {
    repoRoot: ".";
    changeRoot: string;
  };
  directoryMap: DirectoryMapItem[];
  entrypoints: EntryPointItem[];
  rules: RuleItem[];
  importantFiles: string[];
  glossarySeeds: string[];
  signals: Record<string, boolean>;
}

export interface InitResult {
  state: InitState;
  configPath: string;
  indexPath: string;
  missingMarkers: string[];
}

export interface ChangeRecord {
  version: 1;
  slug: string;
  status: ChangeStatus;
  createdAt: string;
  updatedAt: string;
  source: {
    type: "manual";
    id: string;
  };
  affects: string[];
  owner: string;
  notes: string;
}

export interface StatusReport {
  state: InitState;
  missingMarkers: string[];
  config: OSpecLiteConfig | null;
  activeChanges: string[];
  archivedChanges: string[];
}
