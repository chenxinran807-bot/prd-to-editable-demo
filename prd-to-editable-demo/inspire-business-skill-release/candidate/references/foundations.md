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
- Do not call random-image or placeholder-photo services. When the PRD or accepted input supplies a product image or person image, use that supplied image as the dominant card media instead of replacing it with a gray block.
- When source media is genuinely missing, use an honest neutral composition placeholder with the same crop ratio, silhouette hierarchy and foreground/background separation expected by the layout. The placeholder must preserve composition and content layers without pretending to be a real product photo.
- 已提供产品图片或商品图片时必须真实使用；未提供时，占位区域也要保留构图、层次与裁切比例。
- 不得用“穿搭示例图”“网络异常插画”“档案”等文字充当插画或图标，也不得把 `+`、`>` 等字符当作操作图标。Use an approved utility icon, a simple non-brand CSS shape, or a clearly labeled text action outside the media region.
- Avoid consecutive large gray placeholder blocks. Alternate neutral surface values and preserve card-level composition, proportion and hierarchy so missing assets do not collapse the whole feed into one gray texture.
- 禁止连续使用大面积灰色占位色块，避免双列内容流退化为单一灰色纹理。
- `lucide-react@0.563.0` was verified in private E2E for generic utility actions only. It is not a source for brand logos or bottom-navigation identity.
