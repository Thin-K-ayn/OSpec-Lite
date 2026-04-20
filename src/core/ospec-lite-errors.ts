export class OSpecLiteError extends Error {}

export class InitIncompleteError extends OSpecLiteError {
  constructor(public readonly missingMarkers: string[]) {
    super(`Initialization is incomplete. Missing markers: ${missingMarkers.join(", ")}`);
  }
}

export class NotInitializedError extends OSpecLiteError {
  constructor(rootDir: string) {
    super(`Repository is not initialized for ospec-lite: ${rootDir}`);
  }
}

export class InvalidChangeSlugError extends OSpecLiteError {
  constructor(slug: string) {
    super(`Invalid change slug: ${slug}`);
  }
}

export class UnknownProfileError extends OSpecLiteError {
  constructor(profileId: string) {
    super(`Unknown profile: ${profileId}`);
  }
}

export class InvalidProfileError extends OSpecLiteError {
  constructor(message: string) {
    super(message);
  }
}

export class ProfilePreconditionError extends OSpecLiteError {
  constructor(
    public readonly profileId: string,
    public readonly missingRepoPaths: string[]
  ) {
    super(
      `Profile ${profileId} requires these repo paths: ${missingRepoPaths.join(", ")}`
    );
  }
}

export class ProfileInitAnswersRequiredError extends OSpecLiteError {
  constructor(
    public readonly profileId: string,
    public readonly missingFields: string[]
  ) {
    super(
      `Profile ${profileId} requires these init values in non-interactive mode: ${missingFields.join(", ")}`
    );
  }
}

export class DocVerificationError extends OSpecLiteError {
  constructor(
    public readonly profileId: string,
    public readonly checklistPath: string,
    public readonly issues: { file: string; message: string }[]
  ) {
    super(
      `Documentation verification failed for profile ${profileId}: ${issues.length} issue(s).`
    );
  }
}

export class InvalidPluginNameError extends OSpecLiteError {
  constructor(pluginName: string) {
    super(`Invalid plugin name: ${pluginName}`);
  }
}

export class UnknownBundledPluginError extends OSpecLiteError {
  constructor(pluginName: string) {
    super(`Unknown bundled plugin: ${pluginName}`);
  }
}

export class PluginAlreadyExistsError extends OSpecLiteError {
  constructor(pluginName: string, pluginPath: string) {
    super(`Plugin already exists: ${pluginName} at ${pluginPath}`);
  }
}

export class InvalidPluginSourceError extends OSpecLiteError {
  constructor(sourcePath: string) {
    super(
      `Plugin source is missing a valid .codex-plugin/plugin.json manifest: ${sourcePath}`
    );
  }
}

export class RefreshStateError extends OSpecLiteError {
  constructor(
    public readonly rootDir: string,
    public readonly state: "uninitialized" | "incomplete",
    public readonly missingMarkers: string[]
  ) {
    super(`Cannot refresh repository in state ${state}: ${rootDir}`);
  }
}

export class ChangeValidationError extends OSpecLiteError {
  constructor(
    public readonly changePath: string,
    public readonly phase: "apply" | "verify",
    public readonly issues: string[]
  ) {
    super(
      `Cannot mark change as ${phase === "apply" ? "applied" : "verified"}: ${issues.join(" ")}`
    );
  }
}

export class BugValidationError extends OSpecLiteError {
  constructor(
    public readonly bugId: string,
    public readonly phase: "fix" | "apply",
    public readonly issues: string[]
  ) {
    super(
      `Cannot mark bug ${bugId} as ${phase === "fix" ? "fixed" : "applied"}: ${issues.join(" ")}`
    );
  }
}
