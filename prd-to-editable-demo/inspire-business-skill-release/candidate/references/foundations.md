# Foundations

## Mobile shell

- Render one mobile application surface without a decorative device frame.
- Keep navigation, content and the current action state visually distinct.
- Prefer content hierarchy, whitespace and typography over decorative gradients.
- Touch actions need readable labels; color alone cannot communicate state.

## Commerce hierarchy

- Product media, title, price or benefit facts, and actions must remain separate information layers.
- Never add a promotion, discount, guarantee, price or inventory fact that the PRD does not provide. Plausible-looking sample commerce data is still fabricated data.
- When a layout needs missing data, use explicit schema placeholders: `商品 A`, `商品 B`, `价格待提供`, `权益待确认`, `库存状态待提供`. Do not use currency symbols, numbers, policy names or marketing tags without source evidence.
- Use the user's business terms for screen titles and actions; avoid generic labels such as Continue when a precise action name exists.

## Asset policy

- No runtime brand asset is included in this candidate.
- Never recreate a logo with text or CSS.
- Do not reference skill-local SVG, image or font paths from generated code.
- Do not call random-image or placeholder-photo services. A missing source image must remain an honest, labeled neutral placeholder.
- `lucide-react@0.563.0` was verified in private E2E for generic utility actions only. It is not a source for brand logos or bottom-navigation identity.
