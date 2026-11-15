import { buildTileTurtleBackdrop } from '@/shared/lib/themeBackdrop';
import type { BackdropGeometry } from '@/shared/lib/themeBackdrop';

export interface TileTurtleBackdropProps {
  recipe: unknown;
  scheme: 'light' | 'dark';
  geometry: BackdropGeometry;
}

/** Static decorative renderer. Each mounted SVG must receive its own geometry.clipId. */
export function TileTurtleBackdrop({ recipe, scheme, geometry }: TileTurtleBackdropProps) {
  const { skeleton, artworks, palette } = buildTileTurtleBackdrop(recipe, scheme, geometry);
  const { svg } = skeleton;
  const { clip } = svg.defs;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={skeleton.viewport[0]}
      height={skeleton.viewport[1]}
      viewBox={svg.viewBox.join(' ')}
      preserveAspectRatio={svg.preserveAspectRatio}
      aria-hidden={svg.ariaHidden}
      focusable="false"
    >
      <defs>
        <clipPath id={clip.id} clipPathUnits={clip.clipPathUnits}>
          {clip.rectangles.map((rect, index) => (
            <rect key={index} {...rect} />
          ))}
        </clipPath>
      </defs>
      <rect width="1000" height="1000" fill={palette[0]} />
      {svg.children.map((frame, index) => (
        <g key={frame.index} clipPath={frame.clipPath}>
          <g transform={frame.motionGroup.transform}>
            <g transform={frame.motionGroup.artwork.transform} shapeRendering="crispEdges">
              {artworks[index]!.rectangles.map(({ color, ...rect }, pixel) => (
                <rect key={pixel} {...rect} fill={palette[color]} />
              ))}
            </g>
          </g>
        </g>
      ))}
    </svg>
  );
}
