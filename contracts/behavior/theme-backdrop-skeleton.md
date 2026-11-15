# Stage 4a: deterministic SVG skeleton

`buildBackdropSkeleton(recipe: unknown, content?: readonly LayerExpansion[]): BackdropSkeleton`
is exported from `src/shared/lib/themeBackdrop/index.ts`. The input must pass the raw JSON
reader when originating as text. The function rechecks structure, then builds an SVG descriptor
with fixed `viewBox=[0,0,1000,1000]`, `preserveAspectRatio='none'`, `ariaHidden=true` and one
`g` descriptor per Recipe layer in painter order. Consumers construct React SVG elements from
these values; this API never returns markup or uses innerHTML. No title, URL or external asset
is inserted into attributes. No background artwork, clip, animation or scrim is emitted yet.

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
future artwork uses local coordinates from zero through frame.width/frame.height.

The generator is Mulberry32. Set `state=seed>>>0`; for each sample add `0x6d2b79f5` modulo 2^32,
apply `Math.imul` mixing and unsigned shifts, then divide the unsigned result by 2^32.
There is no global random source, clock, environment or shared mutable state. Seeds 0 and
4294967295 are valid. Only placement depends on seed; changing it preserves root attributes,
layer order/configuration and cost. A full-size corner frame has no free space, so changing its
seed cannot move it. Order changes intentionally change subsequent random assignments.

`preserveAspectRatio='none'` maps these percentage bounds directly to any viewport without a
cover crop. These are placement frames, not an artwork aspect-ratio policy. Component rendering
must keep its own intended proportions when mapped into those frames. Viewport adaptation,
motion envelopes and the clips protecting text/quiet regions remain later rendering work.

## Actual shell cost and component connection

The root contributes `{primitives:0,dom:1,definitions:0,movingGroups:0}`. Each layer contributes
one actual `g` node, zero primitives/definitions, and one reserved moving group if its declared
motion is not `none`. Motion is not running at this stage, but its group counts toward the budget.
Component metadata excludes this outer group and is added to the shell counts. Returned
`baseCost` and `expansions` can be passed directly to `validateRecipeCost` with `[1000,1000]`.
The builder already does so and rejects over-budget assemblies. A missing `content` argument
means empty groups, not a claim that a complete tile/paper/symbol costs zero. A supplied array
must match the Recipe layer count. Descriptors and metadata are copied, without mutating inputs.

Pattern periods must be expressed in viewBox units **after** component transforms. Convert a
CSS-pixel period `(w,h)` in viewport `(W,H)` to `(1000*w/W,1000*h/H)` for the same repetition count.
Counting continues to use the shared area formula, including the partial-cell row/column.
The Stage 3b `pattern-18`, `pattern-32`, `pattern-50`, `sum-1040` examples are reused directly
by `skeleton.cost.test.ts`; primitives agree and DOM adds exactly the shell nodes. These are
synthetic component metadata until Stage 5 implements the actual parts. Actual future paths,
definitions and pattern content must supply measured expansion counts.

No shared calculation rule or fixture changes in Stage 4a. Rust does not assemble the SVG tree;
its existing cost formula already matches these shared examples. No Rust change or new
cross-language fixture is needed. The existing normal6/error12/raw15/cost11/color37 examples
remain in the related TS test suite. This API does not authorize saving or applying a background;
text protection, full component cost and rendered validation are still required.
