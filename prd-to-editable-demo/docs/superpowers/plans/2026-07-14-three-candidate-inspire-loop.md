# Three-Candidate Inspire Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the professional PRD entry point into an end-to-end Inspire workflow that automatically selects one eligible business design Skill, generates three comparable candidates, validates each against the real PRD contract, and records the user's selected asset as the only iteration parent.

**Architecture:** Keep semantic requirements as the source of truth. Add three isolated units: an acceptance-contract compiler, a deterministic visible-Skill matcher, and a candidate workflow service. The CLI will compose these units through dependency injection so unit tests can use a controlled Inspire client while live evidence tests continue to call the official CLI.

**Tech Stack:** Node.js ESM, built-in `node:test`, official `inspire-prototype` CLI, JSON workflow artifacts, zero runtime dependencies.

---

## File Map

- Create `src/acceptance-contract.mjs`: compile semantic requirements into production audit requirements.
- Create `src/design-skill-matcher.mjs`: normalize, score, rank, and disambiguate visible Inspire business Skills.
- Create `src/candidate-briefs.mjs`: derive three distinct but requirement-preserving candidate directions.
- Create `src/professional-workflow.mjs`: orchestrate preflight, generation, audit, comparison, and partial failure rules.
- Create `src/candidate-selection.mjs`: validate an explicit choice and promote only that asset into lineage.
- Create `bin/select-candidate.mjs`: public fallback CLI for A/B/C text selection.
- Modify `bin/prd-to-editable-demo.mjs`: run the professional workflow instead of ending at handoff.
- Modify `bin/run-inspire-pipeline.mjs`: reuse the shared single-candidate workflow path and real acceptance contract.
- Modify `src/inspire-client.mjs`: expose visible Skill discovery and candidate generation interfaces needed by the workflow.
- Modify `src/inspire-plan.mjs`: accept a candidate brief without changing stable requirements.
- Modify `scripts/run-benchmark.mjs`: stop treating exit code 3 as a successful professional Demo.
- Modify `SKILL.md`: document the new user-visible one-entry workflow and ambiguity recovery.
- Add focused tests under `test/` for every new unit and the complete professional CLI path.

### Task 1: Compile the real acceptance contract

**Files:**
- Create: `src/acceptance-contract.mjs`
- Create: `test/acceptance-contract.test.mjs`
- Modify: `bin/prd-to-editable-demo.mjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Write the failing unit test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAcceptanceContract } from '../src/acceptance-contract.mjs';

test('compiles PRD screens, actions, states, transitions, labels and editing requirements', () => {
  const contract = compileAcceptanceContract({
    screens: ['规格选择', '确认订单', '支付结果'],
    userActions: ['立即购买', '提交订单'],
    states: ['库存不足', '提交中', '支付成功', '支付失败'],
    transitions: [
      { from: '规格选择', action: '立即购买', to: '确认订单' },
      { from: '确认订单', action: '提交订单', to: '支付结果' }
    ]
  });
  assert.deepEqual(contract.screens, ['规格选择', '确认订单', '支付结果']);
  assert.deepEqual(contract.actions, ['立即购买', '提交订单']);
  assert.deepEqual(contract.states, ['库存不足', '提交中', '支付成功', '支付失败']);
  assert.deepEqual(contract.touchLabels, ['立即购买', '提交订单']);
  assert.deepEqual(contract.editableDimensions, ['image', 'icon', 'position', 'size', 'text', 'color', 'visibility', 'state', 'navigation']);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/acceptance-contract.test.mjs`

Expected: FAIL because `src/acceptance-contract.mjs` does not exist.

- [ ] **Step 3: Implement the pure compiler**

```js
const EDITABLE_DIMENSIONS = ['image', 'icon', 'position', 'size', 'text', 'color', 'visibility', 'state', 'navigation'];

export function compileAcceptanceContract(requirements = {}) {
  const transitions = Array.isArray(requirements.transitions) ? requirements.transitions : [];
  const actions = [...new Set([
    ...(requirements.userActions ?? []),
    ...transitions.map(item => item.action)
  ].filter(Boolean))];
  return {
    screens: [...new Set(requirements.screens ?? [])],
    actions,
    states: [...new Set(requirements.states ?? [])],
    transitions,
    components: [...new Set(requirements.requiredComponents ?? [])],
    touchLabels: actions,
    editableDimensions: EDITABLE_DIMENSIONS
  };
}
```

- [ ] **Step 4: Add a failing CLI assertion**

Extend the professional CLI test to assert that the generated `specialist-handoff.json` contains `auditRequirements` compiled from the real fixture rather than a test-only object.

- [ ] **Step 5: Run the CLI test and verify RED**

Run: `node --test test/cli.test.mjs`

Expected: FAIL because the handoff omits `auditRequirements`.

- [ ] **Step 6: Attach the compiled contract to the handoff**

Import `compileAcceptanceContract` in `bin/prd-to-editable-demo.mjs`, create it after requirements validation, and include it as `handoff.auditRequirements`.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test test/acceptance-contract.test.mjs test/cli.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/acceptance-contract.mjs test/acceptance-contract.test.mjs bin/prd-to-editable-demo.mjs test/cli.test.mjs
git commit -m "feat: compile PRD acceptance contract"
```

### Task 2: Match visible business design Skills deterministically

**Files:**
- Create: `src/design-skill-matcher.mjs`
- Create: `references/design-skill-registry.json`
- Create: `test/design-skill-matcher.test.mjs`

- [ ] **Step 1: Write failing matcher tests**

Cover four behaviors:

```js
test('selects the owner-approved mall mobile Skill for a consumer commerce PRD', () => {});
test('rejects mobile-shell and design utilities as final business Skills', () => {});
test('returns ambiguity when the first two eligible candidates are too close', () => {});
test('excludes private Skills unless explicitly selected or allowlisted', () => {});
```

Use visible-Skill fixtures shaped exactly like `inspire-prototype skills visible --json` output. Assert a result union:

```js
{ status: 'selected', candidate, evidence, ranked }
{ status: 'ambiguous', candidates, reason }
{ status: 'unavailable', candidates: [], reason }
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/design-skill-matcher.test.mjs`

Expected: FAIL because the matcher does not exist.

- [ ] **Step 3: Add the domain-neutral registry**

Store structured overrides keyed by Skill identity. Include current known public/built-in families and an owner-approved private entry for `douyin-mall-independent-app-prototype-guidance`; do not encode individual PRD pages or states.

Each entry must use:

```json
{
  "domains": ["commerce"],
  "products": ["douyin-mall-independent-app"],
  "platforms": ["mobile"],
  "surfaces": ["consumer"],
  "capabilities": ["browse", "transaction", "after-sales"],
  "exclusions": ["merchant-console", "desktop"],
  "qualityLevel": "brand-native",
  "privateAutoUse": "owner-approved"
}
```

- [ ] **Step 4: Implement normalization and scoring**

The matcher must:

1. Drop categories other than `design-system`.
2. Drop `mobile-shell` and utility Skills.
3. Merge registry fields with description, summary, and `intentKeywords`.
4. Score product, audience/surface, platform, domain, capability, exclusion conflicts, source eligibility, version, and active visibility.
5. Select only when the top candidate clears the minimum and lead thresholds.
6. Return 2–3 ranked candidates on ambiguity.
7. Produce human-readable evidence for every score contribution.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test test/design-skill-matcher.test.mjs`

Expected: all matcher tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/design-skill-matcher.mjs references/design-skill-registry.json test/design-skill-matcher.test.mjs
git commit -m "feat: match Inspire business design Skills"
```

### Task 3: Derive three comparable candidate briefs

**Files:**
- Create: `src/candidate-briefs.mjs`
- Create: `test/candidate-briefs.test.mjs`
- Modify: `src/inspire-plan.mjs`
- Modify: `test/inspire-plan.test.mjs`

- [ ] **Step 1: Write failing brief tests**

Assert that `buildCandidateBriefs(requirements)` returns exactly three briefs with unique IDs and labels, while each brief preserves the exact screens, actions, states, transitions, and acceptance contract hash.

Assert that labels are derived from experience type and goal rather than fixed product names.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/candidate-briefs.test.mjs test/inspire-plan.test.mjs`

Expected: FAIL because candidate briefs and prompt support do not exist.

- [ ] **Step 3: Implement candidate brief derivation**

Use three domain-neutral strategy families:

- `task-efficiency`: minimize steps and foreground the primary task.
- `content-discovery`: foreground browse, context, and progressive entry when applicable.
- `conversion-focus`: foreground decision evidence and the primary completion action when applicable.

For non-browse or non-transaction PRDs, derive equivalent labels from the requirement shape, such as overview-first, guided-flow, and object-centered. Never add screens, actions, or states.

- [ ] **Step 4: Extend the Inspire prompt**

Add a `candidateBrief` parameter to `buildInspirePlan`. Render the allowed structural strategy and immutable contract separately. Explicitly forbid deleting or inventing requirements to create visual difference.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test test/candidate-briefs.test.mjs test/inspire-plan.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/candidate-briefs.mjs test/candidate-briefs.test.mjs src/inspire-plan.mjs test/inspire-plan.test.mjs
git commit -m "feat: derive comparable Inspire candidate briefs"
```

### Task 4: Orchestrate three candidate generations

**Files:**
- Create: `src/professional-workflow.mjs`
- Create: `test/professional-workflow.test.mjs`
- Modify: `src/inspire-client.mjs`
- Modify: `test/inspire-client.test.mjs`

- [ ] **Step 1: Write failing orchestration tests**

Use an injected client with real method contracts, not a subprocess fixture. Cover:

1. One eligible Skill generates three candidates with the exact same Skill identity and acceptance contract.
2. Skill ambiguity returns `selection-required` before generation.
3. Three successful candidates return `comparison-ready`.
4. Two successful candidates return `comparison-ready` with one retryable failure.
5. Fewer than two valid candidates return `generation-blocked`.
6. A candidate whose activated/opened Skill differs is rejected.
7. A candidate missing a required action or state is rejected.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/professional-workflow.test.mjs`

Expected: FAIL because the workflow service does not exist.

- [ ] **Step 3: Implement the workflow service**

Export:

```js
export async function runProfessionalWorkflow({
  requirements,
  auditRequirements,
  inputs,
  visibleSkills,
  selectedDesignSkill,
  privateAllowlist,
  client,
  references
})
```

The service must return structured status instead of exiting. Generate candidates sequentially by default to make logs and rate-limit behavior deterministic. Preserve all candidate failures with safe error kinds and retry inputs.

- [ ] **Step 4: Refactor Inspire client without changing behavior**

Expose the existing preflight, generate, and asset calls through the injected client contract. Keep exact Skill activation validation in `inspire-client.mjs`; do not duplicate it in the orchestrator.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test test/professional-workflow.test.mjs test/inspire-client.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/professional-workflow.mjs test/professional-workflow.test.mjs src/inspire-client.mjs test/inspire-client.test.mjs
git commit -m "feat: orchestrate three Inspire candidates"
```

### Task 5: Make the public CLI truly end-to-end

**Files:**
- Modify: `bin/prd-to-editable-demo.mjs`
- Modify: `bin/run-inspire-pipeline.mjs`
- Modify: `test/cli.test.mjs`
- Create: `test/professional-cli.test.mjs`

- [ ] **Step 1: Write failing public CLI tests**

Run the real public CLI with an injected official-CLI-compatible executable and assert:

- professional success exits `0`, not `3`;
- output includes `candidate-comparison.json` and three candidate entries;
- each entry includes `assetId`, `previewUrl`, `inboxDeepLink`, exact design Skill identity, audit status, and candidate brief;
- ambiguity exits with a documented nonzero status and writes `design-skill-selection.json`;
- fewer than two valid candidates writes `generation-blocker.json`;
- fast-review still emits local HTML and never calls Inspire.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/professional-cli.test.mjs test/cli.test.mjs`

Expected: FAIL because the professional entry point still stops at exit code 3.

- [ ] **Step 3: Compose the workflow in the main CLI**

The main CLI must:

1. Produce semantic requirements and acceptance contract.
2. Query visible Skills through the client.
3. Match or return a selection artifact.
4. Generate and audit three candidates.
5. Write the comparison artifact and safe recovery files.
6. Print a concise JSON result containing comparison status and preview links.

Retain `specialist-handoff.json` as an internal checkpoint only.

- [ ] **Step 4: Make the legacy pipeline reuse shared code**

Refactor `run-inspire-pipeline.mjs` to call the same shared single-candidate generation/audit path so it cannot diverge from the public CLI acceptance contract.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test test/professional-cli.test.mjs test/cli.test.mjs test/inspire-pipeline.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add bin/prd-to-editable-demo.mjs bin/run-inspire-pipeline.mjs test/professional-cli.test.mjs test/cli.test.mjs test/inspire-pipeline.test.mjs
git commit -m "feat: complete professional CLI workflow"
```

### Task 6: Record explicit candidate selection and lineage

**Files:**
- Create: `src/candidate-selection.mjs`
- Create: `bin/select-candidate.mjs`
- Create: `test/candidate-selection.test.mjs`
- Modify: `src/inspire-lineage.mjs`
- Modify: `test/inspire-lineage.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing selection tests**

Cover:

- A/B/C and asset-ID selection both resolve to one successful candidate.
- An unknown, failed, or rejected candidate cannot be selected.
- Selection writes one `currentAssetId` and marks all other candidates `not-selected`.
- Re-selection requires an explicit new action and records the prior selection.
- Future iteration plans use only `currentAssetId` as parent.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/candidate-selection.test.mjs test/inspire-lineage.test.mjs`

Expected: FAIL because selection behavior does not exist.

- [ ] **Step 3: Implement selection and CLI**

Expose:

```js
export function selectCandidate(comparison, choice, metadata = {})
```

The CLI contract is:

```bash
prd-to-editable-demo-select --comparison <candidate-comparison.json> --choice A --out <selected-candidate.json>
```

Write the selected candidate, selection timestamp, optional reason, previous selection, and updated lineage. Never mutate the comparison input.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/candidate-selection.test.mjs test/inspire-lineage.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/candidate-selection.mjs bin/select-candidate.mjs test/candidate-selection.test.mjs src/inspire-lineage.mjs test/inspire-lineage.test.mjs package.json
git commit -m "feat: select one Inspire candidate for iteration"
```

### Task 7: Replace false-positive benchmarks with outcome tests

**Files:**
- Modify: `scripts/run-benchmark.mjs`
- Modify: `test/benchmark.test.mjs`
- Create: `fixtures/commerce-*/expected-professional.json`

- [ ] **Step 1: Write a failing benchmark assertion**

Require professional benchmark cases to report:

```js
{
  route: 'inspire',
  candidateCount: 3,
  validCandidateCount: 3,
  comparisonReady: true,
  sameRequirementsHash: true,
  sameDesignSkillPackage: true,
  previewUrlsPresent: true,
  auditPassed: true
}
```

Explicitly reject exit code 3 plus handoff-only output as success.

- [ ] **Step 2: Run benchmark test and verify RED**

Run: `node --test test/benchmark.test.mjs`

Expected: FAIL because the current benchmark treats handoff as success.

- [ ] **Step 3: Implement outcome-based benchmark reporting**

Use controlled official-CLI-compatible fixtures for repeatable CI. Mark reports as `simulated` and ensure they cannot be cited as live visual evidence.

- [ ] **Step 4: Run benchmark test and verify GREEN**

Run: `node --test test/benchmark.test.mjs && npm run benchmark`

Expected: tests pass and all benchmark cases report their evidence class.

- [ ] **Step 5: Commit**

```bash
git add scripts/run-benchmark.mjs test/benchmark.test.mjs fixtures
git commit -m "test: benchmark completed Inspire outcomes"
```

### Task 8: Update the standalone Skill contract and package

**Files:**
- Modify: `SKILL.md`
- Modify: `references/capability-policy.md`
- Modify: `references/quality-gates.md`
- Modify: `test/skill-contract.test.mjs`
- Modify: `test/package.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing contract assertions**

Require the packaged Skill to state:

- professional mode continues to real Inspire candidates;
- three candidates share one requirements and acceptance contract;
- ambiguity is the only normal user choice before generation;
- explicit candidate selection determines the parent asset;
- handoff-only output is not successful professional delivery;
- live preview and screenshot evidence are required for high-fidelity claims.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/skill-contract.test.mjs test/package.test.mjs`

Expected: FAIL because the current Skill still documents handoff exit code 3 as normal completion.

- [ ] **Step 3: Update documentation and version**

Revise the Skill workflow and bump the package version to `0.2.0`, since the professional CLI success contract changes materially.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/skill-contract.test.mjs test/package.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add SKILL.md references/capability-policy.md references/quality-gates.md test/skill-contract.test.mjs test/package.test.mjs package.json
git commit -m "docs: publish three-candidate professional workflow"
```

### Task 9: Full verification and live evidence gate

**Files:**
- Create: `docs/evaluations/2026-07-14-v0.2.0-evidence.md`
- Update only if produced by commands: `dist/prd-to-editable-demo-skill.zip`

- [ ] **Step 1: Run all deterministic verification**

Run:

```bash
npm test
npm run benchmark
npm run smoke
npm run package
```

Expected: zero failures, a successful package install smoke test, and a root-level `SKILL.md` in the ZIP.

- [ ] **Step 2: Run one live Inspire ecommerce case**

Use the official CLI and current authenticated account. Do not use a fake executable. Run one representative ecommerce PRD through the public command and capture:

- visible Skill candidates and selection evidence;
- three generated `assetId` values;
- three preview URLs and screenshots;
- exact activated/opened Skill package;
- candidate audit reports;
- candidate comparison artifact.

Expected: three valid candidates. If fewer than two succeed, record the blocker and do not claim end-to-end completion.

- [ ] **Step 3: Perform subjective visual review**

Inspect all three screenshots at the same viewport. Record native-mobile feel, hierarchy, asset quality, business semantics, and visible differences. Deterministic success alone cannot pass this step.

- [ ] **Step 4: Select one candidate and verify iteration parent**

Run the selection CLI, then build an iteration plan. Confirm the plan's `parentAssetId` equals only the selected asset and the other candidates are marked `not-selected`.

- [ ] **Step 5: Write the evidence report**

Document command timestamps, artifact paths, live versus simulated evidence, pass/fail status, unresolved visual risks, and the exact claim the evidence supports.

- [ ] **Step 6: Commit verified artifacts**

```bash
git add docs/evaluations/2026-07-14-v0.2.0-evidence.md
git commit -m "test: verify v0.2.0 three-candidate workflow"
```

- [ ] **Step 7: Push only after verification**

```bash
git push origin agent/prd-to-editable-demo
```

Expected: remote branch contains all implementation and evidence commits.

## Self-Review

- Spec coverage: semantic IR, acceptance contract, Skill selection, three candidates, comparison, explicit selection, version lineage, quality gates, outcome benchmarks, packaging, and live evidence each have a task.
- Scope: browser comparison rendering is represented by `candidate-comparison.json` and fallback selection CLI; external Agent-specific UI adapters remain out of scope as specified.
- Type consistency: `auditRequirements`, `candidateBrief`, `candidate-comparison.json`, `selected-candidate.json`, `currentAssetId`, and exact Skill identity use the same names throughout.
- Failure posture: ambiguity, no eligible Skill, partial generation, Skill fallback, missing audit source, and unselected candidates all fail closed.
