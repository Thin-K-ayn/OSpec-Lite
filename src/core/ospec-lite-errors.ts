export class OSpecLiteError extends Error {}

export class InitIncompleteError extends OSpecLiteError {
  constructor(public readonly missingMarkers: string[]) {
    super(
      `Initialization is incomplete. Missing markers: ${missingMarkers.join(", ")}`,
    );
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
