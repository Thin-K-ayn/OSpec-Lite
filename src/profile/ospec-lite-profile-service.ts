import * as path from "node:path";
import { AUTHORING_PACK_FILES } from "../core/ospec-lite-schema";
import {
  DocTaskChecklist,
  LoadedOSpecLiteProfile,
  ProfileSummary,
  ProfileValidationIssue,
  ProfileValidationReport
} from "../core/ospec-lite-types";
import { FileRepo } from "../fs/file-repo";
import { ProfileLoader } from "./ospec-lite-profile-loader";

export class ProfileService {
  constructor(
    private readonly repo: FileRepo,
    private readonly loader: ProfileLoader,
    private readonly profilesRoot = path.resolve(__dirname, "..", "..", "profiles")
  ) {}

  async listProfiles(): Promise<ProfileSummary[]> {
    const ids = await this.listProfileIds();
    const summaries: ProfileSummary[] = [];
    for (const id of ids) {
      const profile = await this.loader.loadProfile(id);
      summaries.push(this.toSummary(profile));
    }
    return summaries;
  }

  async getProfile(profileId: string): Promise<LoadedOSpecLiteProfile> {
    return this.loader.loadProfile(profileId);
  }

  async validateProfile(profileId: string): Promise<ProfileValidationReport> {
    const profileJsonPath = path.join(this.profilesRoot, profileId, "profile.json");
    const checkedFiles: string[] = [];
    const issues: ProfileValidationIssue[] = [];

    try {
      const profile = await this.loader.loadProfile(profileId);
      checkedFiles.push(this.relativeToProfilesRoot(profile.profileJsonPath));
      await this.validateLoadedProfile(profile, checkedFiles, issues);
      return {
        profileId,
        profileJsonPath: profile.profileJsonPath,
        valid: issues.length === 0,
        issues,
        checkedFiles
      };
    } catch (error) {
      issues.push({
        file: this.relativeToProfilesRoot(profileJsonPath),
        message: error instanceof Error ? error.message : String(error)
      });
      return {
        profileId,
        profileJsonPath,
        valid: false,
        issues,
        checkedFiles
      };
    }
  }

  async validateAllProfiles(): Promise<ProfileValidationReport[]> {
    const ids = await this.listProfileIds();
    const reports: ProfileValidationReport[] = [];
    for (const id of ids) {
      reports.push(await this.validateProfile(id));
    }
    return reports;
  }

  private async listProfileIds(): Promise<string[]> {
    if (!(await this.repo.exists(this.profilesRoot))) {
      return [];
    }
    const entries = await this.repo.listDirents(this.profilesRoot);
    const ids: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (await this.repo.exists(path.join(this.profilesRoot, entry.name, "profile.json"))) {
        ids.push(entry.name);
      }
    }
    return ids.sort((left, right) => left.localeCompare(right));
  }

  private async validateLoadedProfile(
    profile: LoadedOSpecLiteProfile,
    checkedFiles: string[],
    issues: ProfileValidationIssue[]
  ): Promise<void> {
    const assetTargets = new Set(profile.assets.map((asset) => asset.target));
    const outputs = new Set(profile.outputs);

    for (const output of profile.outputs) {
      if (path.isAbsolute(output) || output.includes("..")) {
        issues.push({
          file: this.relativeToProfilesRoot(profile.profileJsonPath),
          message: `Output path must be repo-relative and stay inside the repo: ${output}`
        });
      }
      if (!assetTargets.has(output)) {
        issues.push({
          file: this.relativeToProfilesRoot(profile.profileJsonPath),
          message: `Output does not have a matching asset target: ${output}`
        });
      }
    }

    for (const asset of profile.assets) {
      const sourcePath = path.join(profile.rootDir, asset.source);
      checkedFiles.push(this.relativeToProfilesRoot(sourcePath));
      if (!(await this.repo.exists(sourcePath))) {
        issues.push({
          file: this.relativeToProfilesRoot(profile.profileJsonPath),
          message: `Asset source is missing: ${asset.source}`
        });
      }
      if (path.isAbsolute(asset.target) || asset.target.includes("..")) {
        issues.push({
          file: this.relativeToProfilesRoot(profile.profileJsonPath),
          message: `Asset target must be repo-relative and stay inside the repo: ${asset.target}`
        });
      }
      if (!outputs.has(asset.target)) {
        issues.push({
          file: this.relativeToProfilesRoot(profile.profileJsonPath),
          message: `Asset target is not declared in outputs: ${asset.target}`
        });
      }
    }

    this.validateWrapperOutputs(profile, outputs, assetTargets, issues);
    await this.validateAuthoringPack(profile, outputs, assetTargets, checkedFiles, issues);
    await this.validateChecklist(profile, outputs, checkedFiles, issues);
  }

  private validateWrapperOutputs(
    profile: LoadedOSpecLiteProfile,
    outputs: Set<string>,
    assetTargets: Set<string>,
    issues: ProfileValidationIssue[]
  ): void {
    for (const [target, files] of Object.entries(profile.agentWrapperFiles ?? {})) {
      for (const filePath of files) {
        if (!outputs.has(filePath) || !assetTargets.has(filePath)) {
          issues.push({
            file: this.relativeToProfilesRoot(profile.profileJsonPath),
            message: `Agent wrapper for ${target} is not declared as both output and asset: ${filePath}`
          });
        }
      }
    }
  }

  private async validateAuthoringPack(
    profile: LoadedOSpecLiteProfile,
    outputs: Set<string>,
    assetTargets: Set<string>,
    checkedFiles: string[],
    issues: ProfileValidationIssue[]
  ): Promise<void> {
    for (const fileName of AUTHORING_PACK_FILES) {
      const target = `${profile.authoringPackRoot}/${fileName}`;
      if (!outputs.has(target) || !assetTargets.has(target)) {
        issues.push({
          file: this.relativeToProfilesRoot(profile.profileJsonPath),
          message: `Authoring pack file is not declared as both output and asset: ${target}`
        });
      }

      const source = profile.assets.find((asset) => asset.target === target)?.source;
      if (!source) {
        continue;
      }

      const sourcePath = path.join(profile.rootDir, source);
      checkedFiles.push(this.relativeToProfilesRoot(sourcePath));
      if (!(await this.repo.exists(sourcePath))) {
        issues.push({
          file: this.relativeToProfilesRoot(profile.profileJsonPath),
          message: `Authoring pack source is missing: ${source}`
        });
      }
    }
  }

  private async validateChecklist(
    profile: LoadedOSpecLiteProfile,
    outputs: Set<string>,
    checkedFiles: string[],
    issues: ProfileValidationIssue[]
  ): Promise<void> {
    const checklistAsset = profile.assets.find((asset) =>
      asset.target.endsWith("/doc-task-checklist.json")
    );
    if (!checklistAsset) {
      return;
    }

    const checklistPath = path.join(profile.rootDir, checklistAsset.source);
    checkedFiles.push(this.relativeToProfilesRoot(checklistPath));
    if (!(await this.repo.exists(checklistPath))) {
      return;
    }

    try {
      const checklist = await this.repo.readJson<DocTaskChecklist>(checklistPath);
      if (checklist.version !== 1) {
        issues.push({
          file: this.relativeToProfilesRoot(checklistPath),
          message: `Unsupported checklist version: ${String(checklist.version)}`
        });
      }
      if (checklist.profileId !== profile.id) {
        issues.push({
          file: this.relativeToProfilesRoot(checklistPath),
          message: `Checklist profileId ${checklist.profileId} does not match ${profile.id}`
        });
      }
      for (const fileRule of checklist.files ?? []) {
        if (!outputs.has(fileRule.path)) {
          issues.push({
            file: this.relativeToProfilesRoot(checklistPath),
            message: `Checklist references a path not declared in outputs: ${fileRule.path}`
          });
        }
      }
    } catch (error) {
      issues.push({
        file: this.relativeToProfilesRoot(checklistPath),
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private toSummary(profile: LoadedOSpecLiteProfile): ProfileSummary {
    return {
      id: profile.id,
      displayName: profile.displayName,
      description: profile.description,
      documentLanguage: profile.documentLanguage,
      profileJsonPath: profile.profileJsonPath
    };
  }

  private relativeToProfilesRoot(targetPath: string): string {
    return path.relative(this.profilesRoot, targetPath).replace(/\\/g, "/");
  }
}
