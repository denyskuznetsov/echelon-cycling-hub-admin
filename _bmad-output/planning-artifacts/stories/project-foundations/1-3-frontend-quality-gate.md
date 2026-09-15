---
title: Dependable frontend quality gate
story_id: '1.3'
epic_id: '1'
review_recommendation: FE-3
requirements: [FR3, UX-DR3]
status: backlog
priority: high
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.3: Dependable frontend quality gate

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review FE-3](../../reviews/project-foundations-review-2026-09-15.md#fe-3--make-frontend-quality-checks-a-dependable-gate)

## User story

As a developer extending the portal,
I want a passing and enforced application-quality gate with real browser coverage,
So that reuse of existing components does not spread regressions into new features.

## Review context and evidence

The final review run passed TypeScript and all 161 Node tests, but ESLint reported 17 errors and 22 warnings. These are dated counts, not a current target. Some auth/UI tests read source files and match strings, which cannot prove user-visible behavior. Repository CI at review time consisted of database deployment workflows without an application pull-request gate.

Entry points:

- `package.json`, `eslint.config.mjs`, `tsconfig.json`, `.github/workflows/`.
- `src/upgrade-gate.test.mts`, `src/workshop-ui.test.mts`, `src/search-field.test.mts`.
- Current lint findings in editors, drawers, auth context, navigation, and shared UI.
- Login/protected layouts, list pages, Bike Fit/Wiki editors, Workshop tablet navigation.

## Scope

- Resolve current application lint errors while preserving behavior; examine warnings and fix substantive accessibility issues or document narrow, justified exceptions.
- Establish a small runtime browser suite covering critical existing behavior: search/history, autosave, and role navigation. Reuse any test infrastructure introduced since the review.
- Add stable local commands and a CI check for lint, TypeScript, existing Node tests, and the browser suite; document and configure the repository merge gate where authorized.
- Exclude exhaustive E2E coverage, framework upgrades, a visual redesign, and new save/navigation product behavior. Findings that belong to another story stay owned there.

## Acceptance criteria

### AC1 — Clean, meaningful lint baseline

**Given** a fresh installation on the supported project runtime, **When** the documented lint command runs, **Then** it exits successfully with zero errors and substantive warnings are addressed or explicitly justified; **And** broad rule disabling or hiding application code from lint is not used to manufacture a pass.

### AC2 — Actual list behavior

**Given** a browser running against isolated test data, **When** a user submits search, changes filters/pages, and uses Back/Forward with delayed results, **Then** assertions inspect the rendered UI and resulting URL state, including retention of a newer draft.

### AC3 — Actual saves and permission navigation

**Given** isolated users for supported roles and an editor record, **When** the browser performs a successful save, a recoverable failed save, an expired-session action, and allowed/forbidden navigation, **Then** the expected persistence, feedback, and auth boundaries are verified through real application paths.

### AC4 — Required CI checks

**Given** a pull request introducing a lint/type failure or a covered runtime regression, **When** CI runs, **Then** the relevant check fails and the merge gate requires it; **And** a passing change runs all documented application checks without depending on an unrelated foundation story.

### AC5 — Isolated and reproducible execution

**Given** a clean local or CI environment, **When** the suite runs, **Then** setup uses synthetic users/data and local or disposable services, outbound vendor effects are mocked/disabled, failures include useful diagnostics, and no staging/production credentials are required.

### AC6 — Coverage is maintained

**Given** existing source-structure and domain tests, **When** the gate is introduced, **Then** useful architectural assertions remain while runtime tests cover the named user behaviors; **And** test commands, check names, setup, and debugging instructions are documented for the next developer.

## Implementation notes and constraints

Read `AGENTS.md`. Reuse current components and test runners where appropriate; select a browser harness based on actual needs. Do not introduce implementation-mirroring tests in place of behavior tests. Keep secrets out of test artifacts and use explicit test-service isolation. Preserve Subframe synchronization conventions when changing shared/generated UI.

Repository merge protection is external configuration: inspect it at implementation time and record the exact required status checks. A workflow file alone is not proof that merge protection is enabled. If permissions prevent configuring the gate, report the precise remaining action and do not claim AC4 is complete.

## Verification

- Run the documented local checks from a clean setup; exercise a deliberately failing test or fixture in isolation to demonstrate the gate detects failure, then remove the deliberate regression.
- Confirm CI check results and merge-protection configuration when access permits.
- Cover desktop and the existing Workshop tablet layout with stable selectors and condition-based waits.

## Decisions at pickup

- Refresh lint/test baselines; do not assume the historical 17/22/161 counts remain current.
- Select the minimal browser harness and fixture strategy; confirm required merge-check configuration against current repository settings.

## Independence and coordination

No hard dependency. Own application CI and the browser harness. Provide the minimal isolated setup this suite needs without waiting for Story 1.5. That story owns broader database/seed/migration validation. Test current approved behavior; do not require Story 1.1 or 1.2's future features to make this gate pass.

## Completion record

Implementation has not started in this recording task. Record refreshed baseline, lint resolutions, test commands/results, CI and merge-gate evidence, residual limitations, and final status; update the epic index.
