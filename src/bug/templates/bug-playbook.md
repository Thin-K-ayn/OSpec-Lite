# Bug Playbook

## What A Bug Item Is

A bug item is a repo-local active bug entry for one defect from report through applied fix.

- It captures the symptom, investigation, fix, validation, and what the agent learned in one shared active bug file.
- It should stay focused on one defect or one tightly related failure mode.

## What Lives In A Bug Item

Active bug work lives in `.oslite/bugs/active-bugs.md`.

- Each bug gets one `## bug-####: ...` section in the shared active bug file.
- The active bug section carries the report, investigation, fix summary, verification evidence, and learned guardrails.
- Durable lessons are written into `.oslite/docs/project/bug-memory.md` and its linked memory segment files.

## Start A Bug

1. Create a bug with `oslite bug new "<title>" .`
2. Fill the new active bug section with the symptom, expected behavior, and reproduction
3. Capture the best current evidence and likely root cause in the same section

## Mark A Bug Fixed

- Fill `Affects`, `Fix Summary`, `File`, and `Reason` with real implementation details.
- Keep the active bug entry scoped to the defect you just fixed.
- Run `oslite bug fix <bug-id>` after the implementation is complete locally.

## Apply A Bug Fix

- Add real `Command` and `Result` evidence to the active bug entry.
- Record the mistaken assumption, the actual logic, and a concrete `Check First` repo path.
- Run `oslite bug apply <bug-id>` to persist the lesson into bug memory and remove the bug from the active queue.

## Memory Compaction

- Bug memory writes into one current segment file until it grows too large.
- When compaction triggers, OSpec Lite re-checks every stored lesson against the current codebase.
- Lessons whose `Check First` paths no longer make sense are dropped.
- Remaining lessons are repacked so small old files merge together and the newest write target stays clear.
