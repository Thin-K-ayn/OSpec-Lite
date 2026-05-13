import * as path from "node:path";
import {
  BugValidationError,
  ChangeValidationError,
  DocVerificationError,
  InitIncompleteError,
  ProfileInitAnswersRequiredError,
  RefreshStateError,
  ReportStateError
} from "../core/ospec-lite-errors";

export interface CliErrorReportOptions {
  json?: boolean;
}

export function reportCliError(
  error: unknown,
  options: CliErrorReportOptions = {}
): void {
  if (options.json) {
    console.error(JSON.stringify(toStructuredError(error), null, 2));
    process.exitCode = 1;
    return;
  }

  if (error instanceof InitIncompleteError) {
    console.error("OSpec Lite: initialization incomplete");
    for (const marker of error.missingMarkers) {
      console.error(`- ${marker}`);
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof ProfileInitAnswersRequiredError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (error instanceof DocVerificationError) {
    console.error("OSpec Lite docs verification failed");
    console.error(`Profile: ${error.profileId}`);
    console.error(`Checklist: ${error.checklistPath}`);
    for (const issue of error.issues) {
      console.error(`- ${issue.file}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof RefreshStateError) {
    console.error(`OSpec Lite refresh blocked: repository state is ${error.state}`);
    if (error.missingMarkers.length > 0) {
      console.error("Missing markers:");
      for (const marker of error.missingMarkers) {
        console.error(`- ${marker}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof ReportStateError) {
    console.error(`OSpec Lite report blocked: repository state is ${error.state}`);
    if (error.missingMarkers.length > 0) {
      console.error("Missing markers:");
      for (const marker of error.missingMarkers) {
        console.error(`- ${marker}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof ChangeValidationError) {
    console.error(
      `OSpec Lite change ${error.phase} blocked: ${path.resolve(error.changePath)}`
    );
    for (const issue of error.issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof BugValidationError) {
    console.error(`OSpec Lite bug ${error.phase} blocked: ${error.bugId}`);
    for (const issue of error.issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
}

function toStructuredError(error: unknown): {
  ok: false;
  error: Record<string, unknown>;
} {
  if (error instanceof InitIncompleteError) {
    return {
      ok: false,
      error: {
        code: "InitIncompleteError",
        message: error.message,
        missingMarkers: error.missingMarkers
      }
    };
  }

  if (error instanceof ProfileInitAnswersRequiredError) {
    return {
      ok: false,
      error: {
        code: "ProfileInitAnswersRequiredError",
        message: error.message,
        profileId: error.profileId,
        missingFields: error.missingFields
      }
    };
  }

  if (error instanceof DocVerificationError) {
    return {
      ok: false,
      error: {
        code: "DocVerificationError",
        message: error.message,
        profileId: error.profileId,
        checklistPath: error.checklistPath,
        issues: error.issues
      }
    };
  }

  if (error instanceof RefreshStateError || error instanceof ReportStateError) {
    return {
      ok: false,
      error: {
        code: error.constructor.name,
        message: error.message,
        rootDir: error.rootDir,
        state: error.state,
        missingMarkers: error.missingMarkers
      }
    };
  }

  if (error instanceof ChangeValidationError) {
    return {
      ok: false,
      error: {
        code: "ChangeValidationError",
        message: error.message,
        changePath: path.resolve(error.changePath),
        phase: error.phase,
        issues: error.issues
      }
    };
  }

  if (error instanceof BugValidationError) {
    return {
      ok: false,
      error: {
        code: "BugValidationError",
        message: error.message,
        bugId: error.bugId,
        phase: error.phase,
        issues: error.issues
      }
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: error.constructor.name,
        message: error.message
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "UnknownError",
      message: String(error)
    }
  };
}
