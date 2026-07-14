# Single-Skill Best-Quality Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `prd-to-editable-demo` independently deliver the strongest available PRD-to-interactive-demo result from one installation, with Inspire as the enforced professional container and no hidden peer-Skill dependencies.

**Architecture:** Keep the host Skill as the only entry point. Move distilled, domain-neutral product-design knowledge into four internal reference contracts, add a capability/preflight controller that distinguishes automatic repair from user-required authorization, and make delivery mode explicit. Existing semantic IR, Inspire lineage, editable runtime, and audits remain the execution foundation.

**Tech Stack:** Agent Skills Markdown, Node.js ESM, JSON contracts, Node test runner, zero-dependency editable HTML runtime, Inspire Prototype CLI.

---

## File map

- `SKILL.md`: single-entry workflow, mode selection, internal references, and truthful capability rules.
- `references/interaction-design.md`: domain-neutral journey, screen, component, state, and transition rules.
- `references/visual-quality.md`: native mobile visual rules, asset hierarchy, and anti-generic constraints.
- `references/capability-policy.md`: core versus optional capability contract and user-action boundaries.
- `references/quality-gates.md`: deterministic and subjective acceptance criteria.
- `src/capability-controller.mjs`: pure preflight decision engine.
- `src/select-route.mjs`: explicit fast-review versus professional delivery selection.
- `bin/prd-to-editable-demo.mjs`: emit capability requirements and prevent silent professional downgrade.
- `src/inspire-plan.mjs`: inject internal interaction and visual contracts into professional handoff.
- `src/native-design-audit.mjs`: enforce generic asset and visual failure rules.
- `scripts/package-skill.sh`: assert the standalone package contains every core contract.
- `test/capability-controller.test.mjs`: preflight and user-action behavior.
- `test/select-route.test.mjs`: delivery-mode routing.
- `test/skill.test.mjs`: no peer-Skill dependency and internal-reference requirements.
- `test/package-install.test.mjs`: clean-install completeness.
- `test/inspire-plan.test.mjs`: professional prompt contract.
- `test/native-design-audit.test.mjs`: quality-gate adversarial cases.

### Task 1: Replace peer-Skill dependency language with an internal capability contract

**Files:**
- Modify: `SKILL.md`
- Create: `references/capability-policy.md`
- Modify: `test/skill.test.mjs`

- [ ] **Step 1: Write the failing Skill contract test**

Add:

```js
test('Skill is a standalone core and treats discovered tools only as optional enhancements', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /单一安装|单 Skill/);
  assert.match(source, /capability-policy\.md/);
  assert.match(source, /未安装.*不影响.*核心|不依赖.*其他.*Skill/);
  assert.match(source, /专业模式.*Inspire/);
  assert.doesNotMatch(source, /`prd-generator`、`pm-kakaxi-skills`/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test --test-name-pattern='standalone core' test/skill.test.mjs`

Expected: FAIL because the current Skill still lists peer Skills as professional-path inputs.

- [ ] **Step 3: Write the internal capability policy**

Create `references/capability-policy.md` with this contract:

```markdown
# 能力策略

核心能力随包提供：语义需求建模、交互设计、通用视觉约束、可编辑运行时和质量验收。
外部能力只有在运行时真实发现、调用并取得证据后才能记为 enhancement；名称出现不等于能力存在。

专业模式必须使用 Inspire。系统自动处理可安装组件、能力发现、版本解析、重试和候选修订。只有登录、授权、受限素材访问和会推翻核心方案的选择需要用户操作。

缺少同类 Agent Skill 不影响核心流程。缺少 Inspire 权限时暂停专业交付并保存可恢复状态；不得静默交付低质量替代品。
```

- [ ] **Step 4: Rewrite `SKILL.md` around the single-install workflow**

Replace the peer-Skill enumeration with:

```markdown
本 Skill 是单一安装和调用入口，核心交付不得依赖宿主另行安装其他同类 Skill。运行时发现的外部工具只能作为可验证增强。执行前读取 [capability-policy.md](references/capability-policy.md)。
```

Add explicit professional and fast-review modes; keep model-semantic extraction mandatory in both.

- [ ] **Step 5: Run the Skill tests and commit**

Run: `node --test test/skill.test.mjs`

Expected: all Skill tests PASS.

Commit:

```bash
git add SKILL.md references/capability-policy.md test/skill.test.mjs
git commit -m "docs: make the Skill standalone by contract"
```

### Task 2: Distill interaction, visual, and acceptance knowledge into internal references

**Files:**
- Create: `references/interaction-design.md`
- Create: `references/visual-quality.md`
- Create: `references/quality-gates.md`
- Modify: `SKILL.md`
- Modify: `test/skill.test.mjs`

- [ ] **Step 1: Write failing reference-coverage tests**

Add:

```js
test('Skill ships domain-neutral professional design references', async () => {
  const source = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  for (const name of ['interaction-design.md', 'visual-quality.md', 'quality-gates.md']) assert.match(source, new RegExp(name));
  for (const name of ['interaction-design.md', 'visual-quality.md', 'quality-gates.md']) {
    const reference = await readFile(new URL(`../references/${name}`, import.meta.url), 'utf8');
    assert.match(reference, /状态|交互|视觉|验收/);
    assert.doesNotMatch(reference, /AI 试穿的入口|拍照浮层|相机拍照页/);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test --test-name-pattern='domain-neutral professional' test/skill.test.mjs`

Expected: FAIL with missing reference files.

- [ ] **Step 3: Create the interaction-design contract**

The file must define: task-first screen derivation, one clear responsibility per screen, state matrix (`default/loading/empty/error/disabled/permission/success` when applicable), complete forward and return paths, trigger→system response→user feedback, modal nesting prohibition, stable editable keys, and evidence/assumption labels.

- [ ] **Step 4: Create the visual-quality contract**

The file must define: platform-native hierarchy, typography and spacing rhythm, 44px minimum touch targets, SVG icon provenance, image role and crop rules, zero Emoji, no generic purple gradients, no fake phone shell, no desktop navigation in mobile products, and a generic-asset fallback that is marked for replacement rather than presented as brand-authentic.

- [ ] **Step 5: Create the quality-gates contract and link all references**

The file must separate deterministic gates from subjective review and require evidence for business coverage, path reachability, state coverage, editable dimensions, asset provenance, actual Inspire Skill activation, hierarchy, native feel, semantic accuracy, and demo value.

- [ ] **Step 6: Run tests and commit**

Run: `node --test test/skill.test.mjs`

Expected: PASS.

Commit:

```bash
git add SKILL.md references/interaction-design.md references/visual-quality.md references/quality-gates.md test/skill.test.mjs
git commit -m "feat: internalize professional product design contracts"
```

### Task 3: Add a quality-assurance capability controller

**Files:**
- Create: `src/capability-controller.mjs`
- Create: `test/capability-controller.test.mjs`

- [ ] **Step 1: Write failing controller tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCapabilityReadiness } from '../src/capability-controller.mjs';

test('professional mode asks only for authorization that cannot be automated', () => {
  assert.deepEqual(decideCapabilityReadiness({ mode: 'professional', cliInstalled: true, authenticated: false, designSkillVisible: false }), {
    status: 'user-action-required',
    action: 'authorize-inspire',
    resumeAt: 'preflight'
  });
});

test('professional mode never silently downgrades when the design Skill is unavailable', () => {
  const result = decideCapabilityReadiness({ mode: 'professional', cliInstalled: true, authenticated: true, designSkillVisible: false });
  assert.equal(result.status, 'professional-blocked');
  assert.equal(result.allowLocalFinal, false);
});

test('fast review remains available without Inspire', () => {
  assert.equal(decideCapabilityReadiness({ mode: 'fast-review', cliInstalled: false, authenticated: false, designSkillVisible: false }).status, 'ready-local');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/capability-controller.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure decision engine**

```js
export function decideCapabilityReadiness(state) {
  if (state.mode === 'fast-review') return { status: 'ready-local', allowLocalFinal: false };
  if (!state.cliInstalled) return { status: 'auto-repair', action: 'install-inspire-cli', resumeAt: 'preflight' };
  if (!state.authenticated) return { status: 'user-action-required', action: 'authorize-inspire', resumeAt: 'preflight' };
  if (!state.designSkillVisible) return { status: 'professional-blocked', action: 'resolve-design-skill', allowLocalFinal: false, resumeAt: 'preflight' };
  return { status: 'ready-inspire', allowLocalFinal: false };
}
```

- [ ] **Step 4: Run tests and commit**

Run: `node --test test/capability-controller.test.mjs`

Expected: 3 PASS.

Commit:

```bash
git add src/capability-controller.mjs test/capability-controller.test.mjs
git commit -m "feat: add professional capability readiness controller"
```

### Task 4: Make delivery mode explicit and prohibit silent professional fallback

**Files:**
- Modify: `src/select-route.mjs`
- Modify: `bin/prd-to-editable-demo.mjs`
- Modify: `test/select-route.test.mjs`
- Modify: `test/cli.test.mjs`

- [ ] **Step 1: Write failing routing tests**

```js
test('native, branded, high-fidelity, and Inspire-editable requests select professional mode', () => {
  for (const intent of ['原生移动端', '品牌高保真', '在 Inspire 编辑']) {
    assert.equal(selectRoute({ intent, source: '# 需求', assets: [] }).deliveryMode, 'professional');
  }
});

test('explicit speed-first review selects fast-review mode', () => {
  assert.equal(selectRoute({ intent: '快速评审初版', source: '# 需求', assets: [] }).deliveryMode, 'fast-review');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern='mode' test/select-route.test.mjs`

Expected: FAIL because routes do not expose `deliveryMode`.

- [ ] **Step 3: Add delivery mode to every route result**

Return `deliveryMode: 'professional'` for Inspire/high-fidelity/brand/native requests and `deliveryMode: 'fast-review'` only for explicit speed-first review. Ambiguous prototype requests default to professional.

- [ ] **Step 4: Add capability-state output to the CLI**

For professional handoff, add:

```js
qualityAssurance: {
  mode: route.deliveryMode,
  finalContainer: 'inspire',
  silentDowngradeAllowed: false,
  readiness: 'preflight-required'
}
```

For fast review, mark the manifest `delivery.mode = 'fast-review'` and `delivery.formal = false`.

- [ ] **Step 5: Run routing and CLI tests and commit**

Run: `node --test test/select-route.test.mjs test/cli.test.mjs`

Expected: PASS.

Commit:

```bash
git add src/select-route.mjs bin/prd-to-editable-demo.mjs test/select-route.test.mjs test/cli.test.mjs
git commit -m "feat: enforce explicit professional and fast-review modes"
```

### Task 5: Carry internal professional contracts into Inspire generation and audit

**Files:**
- Modify: `src/inspire-plan.mjs`
- Modify: `src/native-design-audit.mjs`
- Modify: `test/inspire-plan.test.mjs`
- Modify: `test/native-design-audit.test.mjs`

- [ ] **Step 1: Write failing prompt and audit tests**

```js
test('professional prompt contains interaction, visual, editability, and quality contracts', () => {
  const plan = buildInspirePlan({ handoff, designSkill: 'private:test@1' });
  assert.match(plan.prompt, /状态矩阵/);
  assert.match(plan.prompt, /图片、Icon、位置、大小/);
  assert.match(plan.prompt, /主观视觉审查/);
});

test('audit rejects fake icon glyphs and generic mobile presentation', () => {
  const report = auditNativeDesign({ html: '<div>⭐</div><div class="phone-shell purple-gradient">内容</div>', manifest });
  assert.equal(report.pass, false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/inspire-plan.test.mjs test/native-design-audit.test.mjs`

Expected: FAIL on missing integrated contract language or findings.

- [ ] **Step 3: Extend the Inspire plan**

Add concise, domain-neutral requirements to the generated prompt: preserve semantic IR; derive screens from tasks; cover applicable states and return paths; use native hierarchy; prohibit Emoji/fake icons/generic gradients; expose editable text/color/image/icon/position/size/visibility/state/navigation; require evidence in the result summary.

- [ ] **Step 4: Extend deterministic audit without claiming visual excellence**

Add findings for Emoji, text-glyph icons, fake device frames, generic purple gradients, missing asset provenance, and missing declared editable dimensions. Keep `subjectiveReviewRequired: true` even when deterministic checks pass.

- [ ] **Step 5: Run tests and commit**

Run: `node --test test/inspire-plan.test.mjs test/native-design-audit.test.mjs`

Expected: PASS.

Commit:

```bash
git add src/inspire-plan.mjs src/native-design-audit.mjs test/inspire-plan.test.mjs test/native-design-audit.test.mjs
git commit -m "feat: enforce professional contracts in Inspire delivery"
```

### Task 6: Prove clean-install independence and publish the new package

**Files:**
- Modify: `scripts/package-skill.sh`
- Modify: `test/package-install.test.mjs`
- Modify: `test/benchmark.test.mjs`
- Modify: `scripts/run-benchmark.mjs`

- [ ] **Step 1: Write failing package completeness checks**

Extend the package test to assert these files exist after unzip:

```js
for (const file of [
  'references/requirements-ir.md',
  'references/capability-policy.md',
  'references/interaction-design.md',
  'references/visual-quality.md',
  'references/quality-gates.md',
  'src/capability-controller.mjs'
]) assert.ok(existsSync(join(installed, file)), `${file} must ship`);
```

Add a clean-install run with `HOME` pointed at an empty temporary directory and no peer Skill directories; expect the fast-review fixture to produce an editable artifact.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/package-install.test.mjs`

Expected: FAIL until all references and package assertions exist.

- [ ] **Step 3: Add three unrelated adversarial benchmark cases**

Add cold-chain scheduling, museum restoration, and laboratory allocation fixtures. Assertions: semantic screens are not document chapters, no generic placeholder page titles, all transition endpoints exist, and every professional case routes to Inspire.

- [ ] **Step 4: Strengthen the packaging script**

Before zipping, loop over the required file list and exit non-zero with `missing standalone core file: <path>` when any file is absent. Keep `SKILL.md` at zip root.

- [ ] **Step 5: Run the complete verification sequence**

Run:

```bash
npm test
npm run benchmark
npm run smoke
npm run package
unzip -l dist/prd-to-editable-demo-skill.zip
```

Expected: all tests pass, benchmark reports `passed: true`, smoke emits an `index.html`, and the archive contains every standalone core file at root-relative paths.

- [ ] **Step 6: Commit and push**

```bash
git add scripts/package-skill.sh scripts/run-benchmark.mjs test/package-install.test.mjs test/benchmark.test.mjs fixtures
git commit -m "test: prove standalone best-quality delivery"
git push origin agent/prd-to-editable-demo
```

Record the final commit, test count, benchmark result, package path, and remaining external authorization boundary in the handoff.
