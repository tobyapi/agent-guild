# Recipe reader and calculation shared fixtures (stage 3b)

These fixtures supplement `theme-backdrop-recipe.json`; its six accepted recipes and twelve rejected recipes are unchanged. Each file is an array of `{ name, input, expected }` cases, following the existing behavior fixture convention. Rust `tests/domain/theme_backdrop_shared.rs` and TS `themeBackdrop/shared.behavior.test.ts` consume the same files. Production validation rules and limits are unchanged.

## Raw JSON: `theme-backdrop-raw.json` (15 cases)

`input` is an ordered array of `{ text, count }` segments. Concatenate each text repeated count times without separators, encoding the resulting string as UTF-8. This representation preserves duplicate keys, invalid syntax, and escaped lone surrogates without making the fixture itself invalid JSON. Accepted cases have `expected.value`; rejected cases have exactly one `expected.validationErrors` entry. All diagnostic fields are `$`.

| Names | Rule varied | Expected |
| --- | --- | --- |
| escaped-duplicate, nested-duplicate | Equal decoded keys at root / inside an object | duplicate_key |
| trailing-data, markdown-fence, trailing-comma, leading-zero | One syntax violation in each case | invalid_json |
| number-overflow | Nonfinite numeric result | invalid_json |
| lone-high-surrogate, lone-low-surrogate | Unpaired UTF-16 escape | invalid_json |
| depth-nine | Nine nested containers | nesting_too_deep |
| bytes-over | 32769 ASCII bytes | input_too_large |
| utf8-bytes-over | 10923 three-byte characters plus two quotes | input_too_large |
| bytes-exact | 32768 bytes including `{}` | Accept `{}` |
| depth-eight | Eight nested arrays | Accept eight nested arrays |
| escaped-strings | Escaped quote and valid surrogate pair | Accept decoded quote and emoji |

## Cost: `theme-backdrop-cost.json` (11 cases)

`input.recipe` references a name in `theme-backdrop-recipe.json`. Clone that recipe and repeat its first layer once per `input.layers` entry. Each expansion has `cost` and `patterns`; the viewport is in CSS pixels. `movingGroups` is the shared JSON spelling (Rust adapters map it to `moving_groups`). Success has `expected.cost`; rejection has `expected.validationErrors`. All budget errors have field `layers`. Expansion values are synthetic app-owned metadata, not actual SVG measurements.

| Name | Rule varied | Expected |
| --- | --- | --- |
| pattern-18 | Viewport 200×100, period 100×50, two primitives per cell | primitives 18, dom 3, definitions 1, movingGroups 0 |
| pattern-32 | Viewport 201×101; partial cells | primitives 32, other counts unchanged |
| pattern-50 | Viewport 400×200 | primitives 50, other counts unchanged |
| pattern-budget | Same pattern at viewport 10000×10000 | primitive_budget_exceeded |
| sum-1040 | Base + two layers + two patterns | 1040 / 210 / 17 / 2 (primitives / dom / definitions / movingGroups) |
| inclusive-limits | All limits exactly met | 2000 / 400 / 32 / 2 |
| primitives-over | Only primitives exceeds its limit by one | primitive_budget_exceeded |
| dom-over | Only dom exceeds its limit by one | dom_budget_exceeded |
| definitions-over | Only definitions exceeds its limit by one | definition_budget_exceeded |
| movingGroups-over | Only movingGroups exceeds its limit by one | motion_budget_exceeded |
| sum-motion-over | sum-1040 with one additional moving group | motion_budget_exceeded |

## Color: `theme-backdrop-color.json` (37 cases)

`input.recipe` references the unchanged six-recipe fixture. `scheme`, `expansion.underlay`, `expansion.usesBlackShadow`, `surface`, and `text` are explicit. An optional `palette` replaces only the selected scheme's palette. All RGB components are normalized sRGB. Text is opaque with no state overlays; raster failure is false. These are synthetic black/white test tokens, not actual application tokens. Compare `{ alpha, verified }` exactly; alpha is an integer grid step divided by 1000 in both implementations.

For each of `tile-turtle-none`, `halftone-wave-none`, `paper-hill-none`, `paper-turtle-drift`, `paper-seaweed-sway`, and `symbol-tree-sway`, append `-<scheme>-<mode>` to form the case name (36 cases):

| Scheme | Mode | Rule varied | Expected alpha / verified |
| --- | --- | --- | --- |
| light | legacy | No underlay, black shadow included | 0.462 / true |
| light | plain | White underlay, black shadow absent | 0.180 / true |
| light | shadow | White underlay, black shadow included | 0.462 / true |
| dark | legacy | No underlay, black shadow included | 0.417 / true |
| dark | plain | Black underlay, black shadow absent | 0.417 / true |
| dark | shadow | Black underlay, black shadow included | 0.417 / true |

`red-green-midpoint` replaces the light palette with red and green, without underlay or shadow, and uses opaque `(0.5,0.5,0)` text on black surface. Expected alpha is **0.946**, verified true. Its expected box low `(0,0,0)` and high `(1,1,0)` must contain the midpoint `(0.5,0.5,0)`. The high alpha belongs to this deliberately difficult synthetic text/background combination; it is not a normal recipe or an application token. Palette endpoints alone cannot prove safety because the sRGB midpoint luminance is approximately 0.198587, below both endpoint luminances 0.2126 and 0.7152.

The exact expected plain/shadow values also fix the non-increasing-alpha property when removing black shadow, across both schemes and all six recipes. No drawing, saving, UI or real-token integration is established by these fixtures.
