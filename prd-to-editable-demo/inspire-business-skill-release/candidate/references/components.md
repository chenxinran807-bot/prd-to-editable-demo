# Component Patterns

## AI try-on mobile frame

For the independent-app outfit experience, use a 375 × 812 mobile content frame. Reserve 44px for the status bar, 44px for the top tab bar and 83px for bottom navigation including the safe area. Do not wrap this frame in a decorative device shell.

## Outfit tabs and feed

When the PRD is about the outfit-discovery surface, use the source-backed `穿搭 / 直播 / 推荐` top-level tabs with a short 24 × 2 active indicator. The outfit feed starts below the 88px top region and uses a 367px content width with two 181px columns and a 5px gutter. Preserve the product image as the dominant card content.

穿搭 Feed 使用双列瀑布流：两列各 181px，中间间距 5px；图片始终是商品卡的视觉主体。

## Outfit product card

Keep the card media, concise description, attached product thumbnails and `试穿` action as separate layers. When two products are attached, show two small product cards with opposing tilt; when more than two are attached, use a compact stacked fan instead of shrinking every item. The tilt and stack are limited to attached-product affordances and must not be applied to ordinary catalog cards.

商品卡关联 2 个商品时，两个小商品卡以相反方向轻微倾斜；超过 2 个时采用紧凑叠放，不把所有商品等比缩小。

## Try-on entry

The `试衣间` floating entry is a compact 95 × 42 action above the bottom navigation. Choose its light, green or dark treatment from the underlying content contrast; do not hardcode one treatment across video and light-feed surfaces. A card-level `试穿` action remains associated with the corresponding outfit card.

## Loading and recovery

The two-column outfit feed needs a matching skeleton layout, a centered network-error state with a named refresh action, and an upward-load state that keeps existing cards visible. Do not replace these states with a generic spinner or blank screen.

必须覆盖与双列布局一致的骨架屏、带明确刷新动作的错误状态，以及保留既有内容的上滑加载状态。

## Top navigation

Use a concise title aligned with the current task. A back action must return to a real prior state; do not add decorative subtitles.

## Bottom navigation

Use it only when the PRD describes persistent top-level destinations. Keep destination labels visible. Without approved icons, use text labels rather than glyph substitutes.

## Product card

Keep media ratios consistent within one list. Limit the title to a compact readable block and separate verified commercial facts from actions.

## Primary action

Use at most one visually dominant action in the same action area. The label must state the business outcome, such as Add to cart or Upload photo.

## Dialog and bottom sheet

Use a dialog for blocking confirmation and a bottom sheet for short mobile choices or contextual actions. Always provide a clear dismissal path.

## State feedback

Loading names the task; success offers the next valid step; failure explains the recoverable reason and retry path; empty states explain why content is absent.
