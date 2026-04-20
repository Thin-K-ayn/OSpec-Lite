export type DocumentLanguage = "en-US" | "zh-CN";
export type ProfileInitField = "projectName" | "bootstrapAgent";

export type AgentTarget = "codex" | "claude-code";
export type BootstrapAgent = AgentTarget | "none";
export type HostAgent = AgentTarget | "unknown";
export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun" | "unknown";
export type DependencySection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";
export type PathAdvisoryKind =
  | "generated"
  | "entrypoint"
  | "package-manifest"
  | "lockfile"
  | "workflow"
  | "agent-instructions";

export type InitState = "uninitialized" | "initialized" | "incomplete";

export type ChangeStatus = "draft" | "active" | "applied" | "verified" | "archived";
export type ChangeValidationPhase = "apply" | "verify";
export type BugStatus = "reported" | "fixed" | "applied";
export type BugValidationPhase = "fix" | "apply";

export type ProfileAssetMode =
  | "write-if-missing"
  | "managed-codex-section"
  | "managed-claude-section";

export interface OSpecLiteConfig {
  version: 1;
  documentLanguage: DocumentLanguage;
  initializedAt: string;
  agentTargets: AgentTarget[];
  agentEntryFiles: Record<AgentTarget, string>;
  agentWrapperFiles?: Partial<Record<AgentTarget, string[]>>;
  projectName?: string;
  bootstrapAgent?: BootstrapAgent;
  projectDocsRoot: string;
  agentDocsRoot: string;
  changeRoot: string;
  archiveLayout: "date-slug";
  profileId?: string;
  authoringPackRoot?: string;
  profileOutputs?: string[];
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

export interface PackageManagerInfo {
  name: PackageManagerName;
  source: "lockfile" | "package-json" | "heuristic";
  lockFile?: string;
  installCommand?: string;
  scriptCommandPrefix?: string;
}

export interface RepoCommandSet {
  install?: string;
  dev?: string;
  start?: string;
  build?: string;
  test?: string;
  lint?: string;
  typecheck?: string;
  pack?: string;
}

export interface DependencyInsight {
  name: string;
  version: string;
  section: DependencySection;
}

export interface LanguageInsight {
  name: string;
  extensions: string[];
  fileCount: number;
}

export interface PathAdvisory {
  path: string;
  kind: PathAdvisoryKind;
  reason: string;
}

export interface ToolingInsight {
  packageManager: PackageManagerInfo | null;
  scripts: Record<string, string>;
  commands: RepoCommandSet;
  majorDependencies: DependencyInsight[];
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
  tooling: ToolingInsight;
  primaryLanguages: LanguageInsight[];
  generatedDirectories: string[];
  riskyPaths: PathAdvisory[];
  askFirstAreas: PathAdvisory[];
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
  tooling: ToolingInsight;
  primaryLanguages: LanguageInsight[];
  generatedDirectories: string[];
  riskyPaths: PathAdvisory[];
  askFirstAreas: PathAdvisory[];
  docSuggestionHashes?: Record<string, string>;
}

export interface InitResult {
  state: InitState;
  configPath: string;
  indexPath: string;
  missingMarkers: string[];
  config?: OSpecLiteConfig | null;
  bootstrapPlan?: InitBootstrapPlan | null;
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

export interface BugRecord {
  version: 1;
  id: string;
  title: string;
  status: BugStatus;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  source: {
    type: "manual";
    id: string;
  };
  affects: string[];
  owner: string;
  notes: string;
}

export interface BugKnowledgeFileRecord {
  path: string;
  bytes: number;
  entryCount: number;
  updatedAt: string;
}

export interface BugIndex {
  version: 1;
  nextBugNumber: number;
  nextKnowledgeFileNumber: number;
  currentKnowledgeFile: string;
  knowledgeFileMaxBytes: number;
  knowledgeFileMinBytes: number;
  items: BugRecord[];
  knowledgeFiles: BugKnowledgeFileRecord[];
}

export interface StatusReport {
  state: InitState;
  missingMarkers: string[];
  config: OSpecLiteConfig | null;
  activeChanges: string[];
  archivedChanges: string[];
  activeBugs: string[];
  appliedBugs: string[];
}

export interface RefreshReport {
  rootDir: string;
  updatedArtifacts: string[];
  reviewNeededDocs: string[];
  baselineInitializedDocs: string[];
}

export interface OSpecLiteProfileAsset {
  source: string;
  target: string;
  mode?: ProfileAssetMode;
}

export interface OSpecLiteProfile {
  version: 1;
  id: string;
  displayName: string;
  description: string;
  documentLanguage: DocumentLanguage;
  authoringPackRoot: string;
  outputs: string[];
  assets: OSpecLiteProfileAsset[];
  requiredInitFields?: ProfileInitField[];
  requiredRepoPaths?: string[];
  agentWrapperFiles?: Partial<Record<AgentTarget, string[]>>;
}

export interface LoadedOSpecLiteProfile extends OSpecLiteProfile {
  rootDir: string;
  profileJsonPath: string;
}

export interface ProfileTemplateValues {
  projectName: string;
  summary: string;
  documentLanguage: DocumentLanguage;
  bootstrapAgent: BootstrapAgent;
  docsRoot: string;
  agentDocsRoot: string;
  authoringPackRoot: string;
  profileId: string;
  managedStart: string;
  managedEnd: string;
}

export interface InitOptions {
  documentLanguage?: DocumentLanguage;
  profileId?: string;
  projectName?: string;
  bootstrapAgent?: BootstrapAgent;
  hostAgent?: HostAgent;
}

export interface InitBootstrapPlan {
  bootstrapAgent: BootstrapAgent;
  hostAgent: HostAgent;
  wrapperPath?: string;
  nextStep?: string;
  shouldBootstrapNow: boolean;
}

export interface DocChecklistSectionRule {
  heading: string;
  requiredSnippets?: string[];
  requiredPatterns?: string[];
  forbiddenPatterns?: string[];
}

export interface DocChecklistFile {
  path: string;
  requiredHeadings?: string[];
  requiredSnippets?: string[];
  requiredPatterns?: string[];
  forbiddenPatterns?: string[];
  evidenceSections?: string[];
  sectionRules?: DocChecklistSectionRule[];
  skipPlaceholderCheck?: boolean;
}

export interface DocTaskChecklist {
  version: 1;
  profileId: string;
  placeholderPatterns: string[];
  forbiddenPatterns: string[];
  requiredEvidenceLabels: string[];
  allowedStatuses: string[];
  files: DocChecklistFile[];
}

export interface DocVerificationIssue {
  file: string;
  message: string;
}

export interface DocVerificationReport {
  profileId: string;
  checklistPath: string;
  checkedFiles: string[];
  issues: DocVerificationIssue[];
}
