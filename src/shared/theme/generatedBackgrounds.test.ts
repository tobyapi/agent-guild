import { expect, it } from 'vitest';
import { behaviorFixture } from '@/shared/lib/behaviorFixtures.test-support';
import { buildTileTurtleBackdrop } from '@/shared/lib/themeBackdrop';
import { tileTurtleRecipe } from './generatedBackgrounds';

it('retains the exact palette and static recipe used by the 11b interval proof', () => {
  const proven = behaviorFixture<{ name: string; input: typeof tileTurtleRecipe }[]>('theme-backdrop-recipe.json').find(
    (item) => item.name === 'tile-turtle-none',
  )!.input;
  expect(tileTurtleRecipe).toEqual(proven);
  for (const scheme of ['dark', 'light'] as const) {
    const model = buildTileTurtleBackdrop(tileTurtleRecipe, scheme, { viewport: [1440, 900], clipId: 'preset-proof' });
    expect(model.palette).toEqual(proven.palette[scheme]);
    expect(model.skeleton.cost.movingGroups).toBe(0);
    for (const artwork of model.artworks) {
      for (const rect of artwork.rectangles) expect(proven.palette[scheme][rect.color]).toBeDefined();
    }
  }
});
