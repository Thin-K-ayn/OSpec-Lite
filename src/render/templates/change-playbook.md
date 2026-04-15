# Change Playbook

## What A Change Is

A change is a repo-local work record for one non-trivial task.

- It is not a git branch.
- It is not a commit message.
- It is the shared place to capture request, plan, applied work, and verification.

Use a change when the task affects behavior, spans multiple files, needs review notes, or may need handoff.

## What Lives In A Change

Each active change lives under `.oslite/changes/active/<slug>/`.

- `request.md`: what was asked for and what is in scope
- `plan.md`: intended approach, expected files, and known risks
- `apply.md`: what actually changed
- `verify.md`: checks performed and remaining risks
- `change.json`: machine-readable status and metadata

## Start A Change

1. Create a change with `oslite change new <slug> .`
2. Capture the request in `request.md`
3. Write the intended approach in `plan.md`

## Plan Before Editing

- Clarify scope, affected files, and expected risks.
- Do not start broad refactors without writing them down first.

## Record Applied Work

- Update `apply.md` with the files you changed and any deviation from plan.
- Move the change status to `applied` when the implementation is complete locally.

## Record Verification

- Add checks, manual validation notes, and remaining risks to `verify.md`.
- Move the change status to `verified` after validation.

## Archive When Done

- Archive only after the change status is `verified`.
- Use `oslite change archive <path>` to move the change into history.

## Why This Helps

- Reviewers can see intent, implementation, and validation separately.
- Agents can resume work without rebuilding context from chat alone.
- Archived changes become a lightweight history of why a task happened and how it was checked.
