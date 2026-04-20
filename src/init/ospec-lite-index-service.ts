import {
  OSpecLiteConfig,
  OSpecLiteIndex,
  RepositoryScanResult
} from "../core/ospec-lite-types";

export class IndexService {
  buildIndex(
    scan: RepositoryScanResult,
    config: OSpecLiteConfig,
    docSuggestionHashes: Record<string, string> = {}
  ): OSpecLiteIndex {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      project: {
        name: config.projectName ?? scan.projectName,
        documentLanguage: config.documentLanguage
      },
      agentTargets: [...config.agentTargets],
      roots: {
        repoRoot: ".",
        changeRoot: config.changeRoot
      },
      directoryMap: scan.directoryMap,
      entrypoints: scan.entrypoints,
      rules: scan.rules,
      importantFiles: scan.importantFiles,
      glossarySeeds: scan.glossarySeeds,
      signals: scan.signals,
      tooling: scan.tooling,
      primaryLanguages: scan.primaryLanguages,
      generatedDirectories: scan.generatedDirectories,
      riskyPaths: scan.riskyPaths,
      askFirstAreas: scan.askFirstAreas,
      docSuggestionHashes
    };
  }
}
