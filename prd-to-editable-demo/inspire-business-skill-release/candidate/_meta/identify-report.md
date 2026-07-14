# Identify Report: douyin-mall-independent-app-prototype-guidance

## Data Sources

| Source | Authority | Owner | Notes |
| --- | --- | --- | --- |
| Product-owner requirements in the PRD-to-prototype project | authoritative | Product owner | Confirms Inspire as final container, zero Emoji, native mobile character, direct editing and versioned Agent iteration. |
| `inspire-business-skill/negative-rules.md` | authoritative within this project | Project maintainer | Encodes owner-confirmed failure modes; it is not an official Douyin brand specification. |
| `inspire-business-skill/components.md` and `design-tokens.json` | supplementary | Project maintainer | Candidate interaction and layout guidance requiring business-design review. |
| Project-authored neutral SVG icons | supplementary | Project maintainer | MIT neutral geometry for local tests only; not official brand assets and not packaged as runtime assets. |
| Three recorded prototype-reference hashes | archive only | Project maintainer | The original captures are not present, so hashes cannot support an official visual claim. |

## Target Environment

- Primary: Inspire Prototype Builder.
- Builder constraints: no shell, no local filesystem, no skill-local runtime assets, and no unpublished repository access.

## Responsibility

This skill lets Builder produce mobile-commerce prototypes that follow the owner-confirmed interaction and anti-generic-AI constraints for the Douyin Mall independent-app concept.

## Skill Identity

- Proposed name / skillKey: `douyin-mall-independent-app-prototype-guidance`.
- Scope: Douyin Mall independent-app prototype guidance, not an official brand design system.
- Rejected names: `douyin-mall-native-design` overstates official authority; `design-system` is too generic.
- Category: `design-system`, because the selectable value is product UI rules and component patterns.

## Inventory

- Candidate: `inspire-business-skill-release/candidate/`.
- References: foundations, component patterns, scenarios and review gate.
- Runtime assets and dependencies: none in the first private candidate.
- Intended initial scope: private E2E only.

## Environmental Mismatches

- Blockers for public review: official logo, navigation icons, brand font, approved token source and original accepted visual references are missing.
- Concern: project-level component metrics require business-design confirmation.
- Nice-to-have: owner-approved E2E captures for skill preview images.

## Runtime Asset Plan

| Asset | Runtime role | Source/rights | Action |
| --- | --- | --- | --- |
| Neutral SVG set | none | project-authored, MIT | Keep outside uploaded package; do not present as brand assets. |
| Official logo/icons/font | future runtime asset | missing | Block until business owner supplies rights-cleared assets. |
| Skill preview | future preview image | accepted E2E capture | Create only after owner accepts a real private E2E result. |

## Scope Plan

- Initial upload: private owner package.
- Workspace sharing: only after owner accepts E2E.
- Public review: blocked.

## Dependency Verification

No npm package or CSS dependency is required.

## Decision

- Proceed with an explicitly non-official private candidate.
- Do not share publicly or claim native-brand fidelity until authoritative design sources and approved assets are supplied.
