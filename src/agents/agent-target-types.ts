import { AgentTarget } from "../core/types";

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
  }): AgentManagedSection;
}
