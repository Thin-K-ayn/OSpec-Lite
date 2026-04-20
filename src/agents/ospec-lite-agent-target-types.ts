import { AgentTarget } from "../core/ospec-lite-types";

export interface AgentManagedSection {
  title: string;
  content: string;
  managedStart: string;
  managedEnd: string;
}

export interface AgentAdapter {
  target: AgentTarget;
  fileName: string;
  buildSection(input: {
    projectName: string;
    summary: string;
    docsRoot: string;
    agentDocsRoot: string;
    rules: string[];
    importantFiles: string[];
    preferredCommands: string[];
    verificationCommands: string[];
    generatedFiles: string[];
    askBeforeEditAreas: string[];
  }): AgentManagedSection;
}
