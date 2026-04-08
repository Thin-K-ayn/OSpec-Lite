export class OsliteError extends Error {}

export class InitIncompleteError extends OsliteError {
  constructor(public readonly missingMarkers: string[]) {
    super(
      `Initialization is incomplete. Missing markers: ${missingMarkers.join(", ")}`,
    );
  }
}

export class NotInitializedError extends OsliteError {
  constructor(rootDir: string) {
    super(`Repository is not initialized for ospec-lite: ${rootDir}`);
  }
}

export class InvalidChangeSlugError extends OsliteError {
  constructor(slug: string) {
    super(`Invalid change slug: ${slug}`);
  }
}
