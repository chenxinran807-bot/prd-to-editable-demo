# E2E Artifacts

> Captures are reference material only. The most accurate acceptance path is to open the preview/canvas link and interact with the generated prototype.

## Case 1: image entry and recovery flow

- Package: `private:douyin-mall-independent-app-prototype-guidance@1`.
- Package hash: `0ce0617da52df70ecf5d545707578e92989ab59cbb6c9fa5dca3b76d8cdd6e3c`.
- Asset: `6a559e7b4f3163025878b64e`.
- Preview: https://6a559e7b4f3163025878b64e-prototype.inspire.bytedance.net
- Inbox: https://inspire.bytedance.net/prototype/inbox
- Skill trace: selected, activated and opened from private v1; `mobile-shell` also opened; no warnings.
- Compile/runtime: success; 9/9 captures; no runtime errors; no autofix.
- Owner-quality decision: rejected pending iteration.
- Root cause: generated code introduced `picsum.photos` despite the asset policy, producing blank preview panels; remaining visual language was generic iOS rather than commerce-specific.
- Action: v2 explicitly bans random image services and requires an honest labeled neutral placeholder when no image source is supplied.

## Case 2: image entry regression on v2

- Asset: `6a559fcbbfedcf02350d1f36`.
- Preview: https://6a559fcbbfedcf02350d1f36-prototype.inspire.bytedance.net
- Technical result: success, 7/7 captures, private v2 selected/activated/opened.
- Quality result: random image dependency fixed; generic tool-like visual character remains.

## Case 3: product discovery on v2

- Asset: `6a55a0c14705e00261f8f748`.
- Preview: https://6a55a0c14705e00261f8f748-prototype.inspire.bytedance.net
- Technical result: success, 3/3 captures, private v2 selected/activated/opened.
- Requirements result: failed. It invented specific products, prices and entitlement claims despite no supplied catalog facts.
- Action: v3 adds an explicit missing-commerce-data protocol and source scan gate.

## Case 4: product fact-boundary regression on v3

- Asset: `6a55a1c744ab2902115ef260`.
- Preview: https://6a55a1c744ab2902115ef260-prototype.inspire.bytedance.net
- Package: `private:douyin-mall-independent-app-prototype-guidance@3`.
- Package hash: `10c89579d72a05312cfe8cb9eb49f7607bf1e41dd623a5402b0f8c7060d0a272`.
- Technical result: success, 2/2 captures, expected private Skill selected/activated/opened.
- Requirements result: passed the missing-commerce-data protocol; only explicit placeholders were used.
- Visual result: not accepted yet. The output remains a generic mobile-commerce shell because no authoritative design system or approved product/brand asset is available.
