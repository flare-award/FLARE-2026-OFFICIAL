# Experimental Liquid Glass

Opt-in in the own-profile panel; off by default. Same localStorage key as v1;
no database or account writes. The ordinary theme and game physics stay independent.

## Rendering

- `liquid-glass.css` is the single token/component system. Separate clipped,
  pointer-transparent optical spans avoid taking over existing pseudo-elements,
  media positioning, badge tooltips or grid structure.
- `liquid-glass.js` generates rounded-rectangle signed-distance maps using a
  Snell-law surface profile. The centre is neutral; only the bezel displaces
  backdrop pixels. Three subtly different RGB samples create edge dispersion.
- Chromium detection explicitly excludes iOS. SVG backdrop filters are enabled
  only on visible key surfaces, never inside another glass surface. Other
  top-level surfaces get regular CSS glass; nested controls stay flat.
- At most eight SVG filters; at most sixteen cached maps; longest map side 640
  pixels, independent of device pixel ratio. Resize work is debounced, pointer
  light coalesced per frame; text-only game-score mutations are ignored.
- A separate scroll-edge veil is a sibling of the navbar, not a nested backdrop.
- Segmented controls retain their real buttons and handlers. A noninteractive
  FLIP-style bubble animates between their measured bounds, including rerenders.
- Disabling removes all injected layers, filters, observers, classes, variables,
  animations and cached maps. User preference is the only persisted state.

## Accessibility / fallback

Regular dark tint prioritizes readable text over bright backgrounds. Primary
buttons have their own protective tint. Native keyboard/switch semantics and
focus rings are retained. Reduced transparency/forced colors disable refraction;
reduced motion disables spring and morph animations. Blocked storage applies
only for the current page and reports that it could not save.

Optional `data-lg-tone="light|dark"` on html overrides the glass tokens; this is
not a separate user-facing setting. Safari/Firefox take the CSS path without SVG
URL filters. Without backdrop-filter, the regular surface is nearly opaque.

## Validation and limitations

Run `node tests/liquid-glass.cjs` and browser suites with the repository's external
Puppeteer/Chromium harness (`NODE_PATH`): `liquid-glass-optics.browser.cjs`,
`liquid-glass.browser.cjs`, and the existing BOING/profile regressions.

The optical suite checks actual Chromium SVG backdrops, neutral centres and edge
sampling, RGB filters, allocation bounds, no nested filters, cursor/press feedback,
segment movement, reduced transparency, teardown and simulated Safari UA routing.
The simulated Safari route is **not native WebKit validation**. Native Safari/iOS
visual acceptance and sustained 60 FPS on real phones remain manual checks; the
software-rendered headless environment does not certify those performance targets.
