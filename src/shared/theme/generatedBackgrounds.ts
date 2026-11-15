/** Bundled production preset; persisted appearance contains only its ID. */
export const GENERATED_BACKGROUND_IDS = ['tile-turtle'] as const;

export const tileTurtleRecipe = {
  schemaVersion: 1,
  catalogVersion: 1,
  title: 'Night sea and turtle',
  seed: 42,
  palette: {
    dark: ['#101D32', '#25455B', '#65A9A3', '#B7CFBA'],
    light: ['#E8F1EC', '#A2C9C3', '#568783', '#345F65'],
  },
  composition: 'quietCenter',
  layers: [
    {
      kind: 'tile',
      motif: 'turtle',
      anchor: 'bottomRight',
      color: 2,
      scale: 0.7,
      density: 0.5,
      depth: 1,
      motion: 'none',
    },
  ],
} as const;
