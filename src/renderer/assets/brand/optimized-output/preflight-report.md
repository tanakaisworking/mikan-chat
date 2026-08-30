# Image Preflight Report

Processed images: 2
Original total: 2.6 MB
Recommended delivery total: 50.9 KB
Estimated reduction: 98.1%

Applied fixes:
- Renamed assets to context-aware lower-kebab-case filenames.
- Converted delivery assets to WebP.
- Generated JPEG/PNG fallbacks.
- Generated responsive image widths for web delivery.
- Preserved transparency by using PNG fallback where needed.
- Prepared SEO/accessibility alt text suggestions.
- Stripped unnecessary metadata by re-encoding outputs.

## mikan-basket-sidebar-decoration

- Original: `mikan-basket-decoration.png` (1122×1402, 1.6 MB)
- Recommended delivery: `images/mikan-basket-sidebar-decoration-320w.webp` (36.4 KB, 97.7% reduction)
- Mode: `seo`
- Role: `decorative`
- Alt: empty alt (`alt=""`)
- Variants:
  - `images/mikan-basket-sidebar-decoration-64w.webp` — 64×80, webp, 3.7 KB
  - `images/mikan-basket-sidebar-decoration-64w.png` — 64×80, png, 9.5 KB
  - `images/mikan-basket-sidebar-decoration-320w.webp` — 320×400, webp, 36.4 KB
  - `images/mikan-basket-sidebar-decoration-320w.png` — 320×400, png, 154.5 KB
- Decisions:
  - Generated responsive WebP variants plus fallback images.
  - Prepared HTML implementation guidance.
  - Decorative image should usually use empty alt text.
  - Detected transparency; used PNG fallback instead of JPEG fallback.
- Assumptions:
  - SEO mode assumes the image will be used on a website or web page.

## mikan-chat-brand-mark

- Original: `mikan-brand-mark.png` (1254×1254, 1.0 MB)
- Recommended delivery: `images/mikan-chat-brand-mark-320w.webp` (14.5 KB, 98.6% reduction)
- Mode: `seo`
- Role: `logo`
- Alt: `葉付きのみかんのmikan chatロゴ`
- Variants:
  - `images/mikan-chat-brand-mark-64w.webp` — 64×64, webp, 1.8 KB
  - `images/mikan-chat-brand-mark-64w.png` — 64×64, png, 4.9 KB
  - `images/mikan-chat-brand-mark-320w.webp` — 320×320, webp, 14.5 KB
  - `images/mikan-chat-brand-mark-320w.png` — 320×320, png, 82.3 KB
- Decisions:
  - Generated responsive WebP variants plus fallback images.
  - Prepared HTML implementation guidance.
  - Non-hero SEO images can usually use lazy loading.
  - Detected transparency; used PNG fallback instead of JPEG fallback.
- Assumptions:
  - SEO mode assumes the image will be used on a website or web page.
