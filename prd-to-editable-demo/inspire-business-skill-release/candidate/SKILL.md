---
name: douyin-mall-independent-app-prototype-guidance
description: Use when generating or iterating a mobile-commerce prototype for the Douyin Mall independent-app concept and the result needs owner-confirmed native-mobile interaction patterns rather than generic AI or desktop styling.
category: design-system
---

# Douyin Mall Independent App Prototype Guidance

This is project-level prototype guidance, not an official Douyin brand design system. Do not invent logos, official icons, fonts, benefits, prices or brand claims.

## Mandatory Rules

- Preserve the PRD's user, business objects, actions, branches and named states. Do not turn document chapter titles into screens.
- Treat every concrete product name, price, promotion, entitlement, inventory value and brand promise as unavailable unless supplied by the PRD. Missing commercial facts must use visibly non-factual labels such as `商品 A`, `价格待提供` and `权益待确认`; never create plausible sample values.
- Use mobile app content directly; do not draw a browser, desktop sidebar, admin dashboard or phone-device frame around it.
- Emoji count is zero. Do not use Unicode symbols or text glyphs as icons.
- Use descriptive text labels when an approved icon asset is unavailable. Never fabricate a brand icon.
- Never use random image services, remote placeholder photos, scraped product images or inaccessible image URLs. If the prompt needs a person or product image and none is supplied, render an explicitly labeled neutral placeholder without pretending it is real content.
- Do not default to purple, blue-purple or rainbow marketing gradients.
- Expose success, failure, empty, loading and retry states when the PRD requires them.
- Keep assumptions visibly separate from PRD facts.

## Reference Map

| Task | Open |
| --- | --- |
| Visual hierarchy and mobile shell | `references/foundations.md` |
| Known component patterns | `references/components.md` |
| Product scenarios and state expectations | `references/scenarios.md` |
| Final deterministic and human review | `references/review.md` |

Open only the files relevant to the requested scenario, then always open `references/review.md` before completing the prototype.

## Failure Boundary

If a request requires exact official branding and no approved asset or authoritative rule is present, keep a clear neutral fallback and report the missing source. Do not claim brand fidelity from visual similarity alone.
