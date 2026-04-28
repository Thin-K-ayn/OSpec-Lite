import { FileRepo } from "../fs/file-repo";
import { ScanService } from "../init/ospec-lite-scan-service";
import { MarkdownRenderer } from "../render/ospec-lite-markdown-renderer";
import { AgentEntryService } from "../agents/ospec-lite-agent-entry-service";
import { IndexService } from "../init/ospec-lite-index-service";
import { InitService } from "../init/ospec-lite-init-service";
import { StatusService } from "../status/ospec-lite-status-service";
import { ChangeService } from "../change/ospec-lite-change-service";
import { BugService } from "../bug/ospec-lite-bug-service";
import { RefreshService } from "../refresh/ospec-lite-refresh-service";
import { ProfileLoader } from "../profile/ospec-lite-profile-loader";
import { DocVerifierService } from "../docs/ospec-lite-doc-verifier-service";
import { KnowledgeTemplateService } from "../init/ospec-lite-knowledge-template-service";
import { PluginService } from "../plugins/ospec-lite-plugin-service";
import { ReportService } from "../report/ospec-lite-report-service";

export interface CliServices {
  repo: FileRepo;
  profileLoader: ProfileLoader;
  initService: InitService;
  statusService: StatusService;
  refreshService: RefreshService;
  changeService: ChangeService;
  bugService: BugService;
  docVerifier: DocVerifierService;
  pluginService: PluginService;
  reportService: ReportService;
}

export function createCliServices(): CliServices {
  const repo = new FileRepo();
  const scanService = new ScanService(repo);
  const renderer = new MarkdownRenderer();
  const agentEntries = new AgentEntryService(repo);
  const indexService = new IndexService();
  const profileLoader = new ProfileLoader(repo);
  const knowledgeService = new KnowledgeTemplateService(renderer, profileLoader);
  const initService = new InitService(
    repo,
    scanService,
    renderer,
    agentEntries,
    indexService,
    profileLoader
  );
  const statusService = new StatusService(repo);
  const refreshService = new RefreshService(
    repo,
    scanService,
    agentEntries,
    indexService,
    profileLoader,
    statusService,
    knowledgeService
  );
  const changeService = new ChangeService(repo, statusService);
  const bugService = new BugService(repo, statusService);
  const docVerifier = new DocVerifierService(repo);
  const pluginService = new PluginService(repo);
  const reportService = new ReportService(
    repo,
    scanService,
    profileLoader,
    statusService,
    knowledgeService
  );

  return {
    repo,
    profileLoader,
    initService,
    statusService,
    refreshService,
    changeService,
    bugService,
    docVerifier,
    pluginService,
    reportService
  };
}
