import { matchDesignSkill } from './design-skill-matcher.mjs';
import { buildCandidateBriefs } from './candidate-briefs.mjs';
import { planAssetStages } from './asset-staging.mjs';
import { buildInspirePlan } from './inspire-plan.mjs';
import { auditNativeDesign } from './native-design-audit.mjs';

function safeFailure(error, candidateBrief) {
  return {
    candidateId: candidateBrief.id,
    kind: error?.kind ?? 'candidate-generation-failed',
    message: error?.message ?? 'candidate generation failed',
    retryable: true
  };
}

export async function runProfessionalWorkflow({
  requirements,
  auditRequirements,
  inputs = {},
  visibleSkills = [],
  selectedDesignSkill = null,
  registry = {},
  privateAllowlist = [],
  client,
  references = {}
}) {
  const skillMatch = selectedDesignSkill
    ? { status: 'selected', candidate: { reference: selectedDesignSkill }, evidence: [{ dimension: 'explicit-selection', matches: [selectedDesignSkill], score: 1 }] }
    : matchDesignSkill({ requirements, visibleSkills, registry, privateAllowlist });
  if (skillMatch.status === 'ambiguous') {
    return { status: 'selection-required', skillCandidates: skillMatch.candidates, reason: skillMatch.reason };
  }
  if (skillMatch.status !== 'selected') {
    return { status: 'generation-blocked', candidates: [], failures: [], reason: skillMatch.reason };
  }

  const designSkill = skillMatch.candidate.reference;
  const preflight = await client.preflight(designSkill);
  const stages = planAssetStages(inputs.assets ?? [], { maxFiles: inputs.maxFiles ?? 10 });
  const briefs = buildCandidateBriefs(requirements);
  const candidates = [];
  const failures = [];

  for (const candidateBrief of briefs) {
    try {
      let parentAssetId = null;
      let generation = null;
      const lineage = [];
      const shortCandidateId = candidateBrief.id.replace(/^candidate-/u, '').toUpperCase();
      const resumedAssetId = inputs.resumeCandidates?.[candidateBrief.id]
        ?? inputs.resumeCandidates?.[shortCandidateId]
        ?? null;
      if (resumedAssetId) {
        generation = { assetId: resumedAssetId };
        lineage.push({ stage: { id: 'resume', files: [] }, assetId: resumedAssetId, parentAssetId: null });
      } else {
        for (const stage of stages) {
          const plan = buildInspirePlan({
            route: { id: 'inspire', stages: ['inspire'], finalContainer: 'inspire' },
            requirements,
            inputs: { ...inputs, assets: stage.files.map(file => file.path) },
            designSkill,
            parentAssetId,
            candidateBrief
          });
          generation = await client.generate({ ...plan, expectedDesignSkill: preflight.designSkill });
          lineage.push({ stage, assetId: generation.assetId, parentAssetId });
          parentAssetId = generation.assetId;
        }
      }
      const asset = await client.asset(generation.assetId);
      const source = await client.assetSource(asset);
      const audit = auditNativeDesign(source, { requirements: auditRequirements, references });
      if (audit.status !== 'passed') {
        throw Object.assign(new Error('candidate failed the PRD acceptance contract'), { kind: 'candidate-audit-failed', audit });
      }
      candidates.push({
        candidateBrief,
        designSkill,
        assetId: generation.assetId,
        previewUrl: generation.previewUrl ?? asset.previewUrl ?? null,
        inboxDeepLink: generation.inboxDeepLink ?? null,
        audit,
        lineage
      });
    } catch (error) {
      failures.push({ ...safeFailure(error, candidateBrief), audit: error.audit ?? null });
    }
  }

  return {
    status: candidates.length >= 2 ? 'comparison-ready' : 'generation-blocked',
    designSkill,
    skillEvidence: skillMatch.evidence,
    candidates,
    failures
  };
}
