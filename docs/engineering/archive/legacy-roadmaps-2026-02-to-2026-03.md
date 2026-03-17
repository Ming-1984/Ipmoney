# Legacy Roadmaps Archive (2026-02 to 2026-03)

> Archived on: 2026-03-15  
> Purpose: merge and retire duplicated planning documents to keep one active source of truth.

## Scope
- This archive replaces historical planning docs that overlapped heavily with current governance docs.
- Active execution documents are:
  - `docs/engineering/full-quality-todo-2026-03-05.md`
  - `docs/engineering/test-report.md`
  - `docs/engineering/project-status.md`

## Merged Sources
- `docs/engineering/overall-todo.md`
- `docs/engineering/dev-qa-todo.md`
- `docs/engineering/execution-playbook.md`
- `docs/engineering/admin-backend-todo.md`

## Historical Decisions Kept
- Phase boundary: real WeChat login/payment/AI integration out of current delivery scope.
- Dev standard startup: `scripts/start-dev.ps1 -EnableDemoAuth`.
- Key focus in that phase: remove 401 storms, improve WeApp build stability, align OpenAPI coverage, and establish scripted verification path.
- Production transition remained a separate track with env segregation and safety gates.

## Why Archived
- The four documents became parallel task trackers and introduced maintenance overlap.
- Their actionable items have been absorbed into:
  - consolidated remediation roadmap (`full-quality-todo-2026-03-05.md`)
  - rolling evidence log (`test-report.md`)
  - short status summary (`project-status.md`)

## Retrieval Guidance
- If you need older context, use git history on this archive file and the original paths listed above.
