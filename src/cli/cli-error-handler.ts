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

export function reportCliError(error: unknown): void {
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
