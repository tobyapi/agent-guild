# Stage 4a/4b: deterministic SVG skeleton and protection clip

`buildBackdropSkeleton(recipe: unknown, content?: readonly LayerExpansion[], geometry?: BackdropGeometry): BackdropSkeleton`
is exported from `src/shared/lib/themeBackdrop/index.ts`. The input must pass the raw JSON
reader when originating as text. The function rechecks structure, then builds an SVG descriptor
with fixed `viewBox=[0,0,1000,1000]`, `preserveAspectRatio='none'`, `ariaHidden=true` and three
`g` descriptors per Recipe layer in painter order. Consumers construct React SVG elements from
these values; this API never returns markup or uses innerHTML. No title, external URL or external asset
is inserted into attributes. Protection clip descriptors are emitted in Stage 4b. Artwork, animation playback and scrim are not emitted.

## Placement

Coordinates are normalized viewBox units. The anchor bounds are:

| Anchor | x | y | width | height |
| --- | ---: | ---: | ---: | ---: |
| left | 0 | 0 | 180 | 1000 |
| right | 820 | 0 | 180 | 1000 |
| bottomLeft | 0 | 820 | 180 | 180 |
| bottomRight | 820 | 820 | 180 | 180 |

Each protagonist frame has width and height `180 * scale`. A seeded generator supplies two
values per layer, in Recipe order, for x/y offsets within the remaining anchor space.
Offsets are floored to 0.001 units, avoiding rounding beyond anchor bounds. Every frame stays
outside the quiet rectangle `[240,80,520,840]`; bottom anchors use only the corners of the lower
18%, keeping the central lower area quiet too. The group transform is `translate(frame.x frame.y)`;
the middle motion group uses these local frame coordinates. The inner artwork group corrects proportions.

The generator is Mulberry32. Set `state=seed>>>0`; for each sample add `0x6d2b79f5` modulo 2^32,
apply `Math.imul` mixing and unsigned shifts, then divide the unsigned result by 2^32.
There is no global random source, clock, environment or shared mutable state. Seeds 0 and
4294967295 are valid. Only placement depends on seed; changing it preserves root attributes,
layer order/configuration and cost. A full-size corner frame has no free space, so changing its
seed cannot move it. Order changes intentionally change subsequent random assignments.

`preserveAspectRatio='none'` maps these percentage bounds directly to any viewport without a
cover crop. These are placement frames, not an artwork aspect-ratio policy. Stage 4b supplies the inverse viewport scaling for artwork and motion below.

## Actual shell cost and component connection

For N clip rectangles the root/defs/clipPath/rects contribute `{primitives:N,dom:3+N,definitions:1,movingGroups:0}`. Each layer contributes
three actual `g` nodes (stationary clip, motion, artwork correction), zero primitives/definitions, and one reserved moving group if its declared
motion is not `none`. Motion is not running at this stage, but its group counts toward the budget.
Component metadata excludes these three groups and is added to the shell counts. Returned
`baseCost` and `expansions` can be passed directly to `validateRecipeCost` with `[1000,1000]`.
The builder already does so and rejects over-budget assemblies. A missing `content` argument
means empty groups, not a claim that a complete tile/paper/symbol costs zero. A supplied array
must match the Recipe layer count. Descriptors and metadata are copied, without mutating inputs.

Pattern periods must be expressed in viewBox units **after** component transforms. Convert a
CSS-pixel period `(w,h)` in viewport `(W,H)` to `(1000*w/W,1000*h/H)` for the same repetition count.
Counting continues to use the shared area formula, including the partial-cell row/column.
The Stage 3b `pattern-18`, `pattern-32`, `pattern-50`, `sum-1040` examples are reused directly
by `skeleton.cost.test.ts`; component primitives agree and clip primitives/DOM add exactly the shell nodes. These are
synthetic component metadata until Stage 5 implements the actual parts. Actual future paths,
definitions and pattern content must supply measured expansion counts.

No shared calculation rule or fixture changes in Stage 4a. Rust does not assemble the SVG tree;
its existing cost formula already matches these shared examples. No Rust change or new
cross-language fixture is needed. The existing normal6/error12/raw15/cost11/color37 examples
remain in the related TS test suite. This API does not authorize saving or applying a background;
text protection, full component cost and rendered validation are still required.

## Stage 4b: stationary protection and physical proportions

`BackdropGeometry` is app-owned, never Recipe JSON. `viewport=[W,H]` is the actual positive finite
CSS-pixel size, default `[1000,1000]` for old skeleton-only callers. Rendering must pass the real size
and recompute after resize. `textProtection` contains normalized root-viewBox rectangles derived
from the app content boxes (all potentially occupied text, including scroll/wrap), not individual
glyph bounds. Omission adds only the central protection; it does not prove actual text safety.
Three-pane measurement and UI wiring remain Stage 12. `clipId` is an app-owned unique instance ID
(default `backdrop-protection`); simultaneous SVG instances must supply different IDs.

The fixed quiet center is `[240,80,520,840]`. Start with the whole `[0,0,1000,1000]` and subtract
this center and every text rectangle, splitting each remaining rectangle into up to four disjoint
rectangles. Overlapping holes therefore remain excluded; even-odd cancellation cannot reopen them.
Clip rectangles have no stroke. Entirely protected viewports produce an empty clip. `defs.clip`
uses `clipPathUnits=userSpaceOnUse` and its rectangles are rendered as `rect` children. Rectangles
are clipped to the viewport by subtraction; partially outside text rectangles are supported.
There are at most 32 app text rectangles; malformed geometry returns `$ / invalid_expansion`.
The existing cost gate rejects excessive clip fragmentation without changing any budget.

Required renderer hierarchy (descriptors are not mounted yet):

```text
svg > defs > clipPath(id) > rect[]
svg > g(clipPath, NO transform) > g(placement + motion) > g(artwork.transform) > component
```

`SvgLayerFrame.tag/clipPath` describe the stationary outer group. `motionGroup.tag/transform` describe
the nested middle group; no transform is present on the outer clipped group. The inner
`motionGroup.artwork` group maps a unit square `[0,1]^2` to a centered physical square. Every component, including antialiasing allowance, stroke and fixed shadow, must fit that
unit square. Independent artwork or clipping outside this hierarchy is unsupported. The outer
clip stays fixed while descendants move, so even erroneous oversized art cannot paint into the
center or supplied text rectangles. Percent protection survives anisotropic root scaling.

With physical frame dimensions `Fw=frame.width*W/1000`, `Fh=frame.height*H/1000`, choose:

```text
d = 8 CSS px for drift, otherwise 0
theta = 2 degrees for sway, otherwise 0
q = cos(theta) + sin(theta)
s = (min(Fw,Fh)-2*d)/q
sx = 1000*s/W; sy = 1000*s/H
artwork.transform = translate((frame.width-sx)/2, (frame.height-sy)/2) scale(sx,sy)
envelope width = 1000*(s*q+2*d)/W; height = 1000*(s*q+2*d)/H
```

The envelope is centered on the frame and lies inside it, hence inside its anchor and outside
the quiet center for all times. Drift conservatively permits +/-8px independently on both axes.
Sway rotates around the center; `cos(t)+abs(sin(t)) <= q` for `abs(t)<=2 degrees` proves containment.
If the frame cannot fit drift, reject `$ / invalid_expansion`; the app must choose static rendering
or retry with usable geometry, never silently exceed the envelope. No animation is running yet.

Root `preserveAspectRatio='none'` remains to preserve percentage placement and clip geometry.
`motionGroup.artwork.motion.drift` gives root-local units per axis. `origin` is the local frame center.
A plain SVG rotate in anisotropic root units is incorrect: for sway angle t, use the conjugated
matrix `matrix(cos(t), (W/H)*sin(t), -(H/W)*sin(t), cos(t), 0, 0)` around `origin`, followed by
placement translation. `swayMatrixScale=[W/H,H/W]` supplies these two factors. This produces a
physical rotation of the corrected square without stretching it. Non-square motif proportions
remain the component's unit-square geometry. No OS font, external image, filter or emoji is used.

Tests cover all six valid recipes and existing fixtures, 432 seed/scale/anchor/motion combinations
across 16:9/21:9/9:16, stationary clip references, overlapping text holes, full protection,
determinism, aspect correction, invalid geometry and actual additional node/definition budgets.
Rust/shared fixtures are unchanged because these are TS assembly rules using the existing cost gate.
