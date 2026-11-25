import { useRef, useState } from 'react';
import { mascotPercent, type MascotLayout, type MascotPlacement } from '@/shared/theme/mascot';
import type { MascotDragHandlers } from './MascotScene';

type Item = keyof MascotLayout;

interface Drag {
  item: Item;
  pointerId: number;
  origin: MascotPlacement;
  clientX: number;
  clientY: number;
  travelX: number;
  travelY: number;
}

function moved(drag: Drag, x: number, y: number): MascotPlacement {
  return {
    ...drag.origin,
    x: drag.travelX > 0 ? mascotPercent(drag.origin.x + ((x - drag.clientX) / drag.travelX) * 100) : drag.origin.x,
    y: drag.travelY > 0 ? mascotPercent(drag.origin.y + ((y - drag.clientY) / drag.travelY) * 100) : drag.origin.y,
  };
}

export function useMascotDrag(layout: MascotLayout, save: (layout: MascotLayout) => void) {
  const active = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<{ item: Item; placement: MascotPlacement } | null>(null);

  function reset(pointerId: number) {
    if (active.current?.pointerId !== pointerId) return;
    active.current = null;
    setDraft(null);
  }

  function handlers(item: Item): MascotDragHandlers {
    return {
      onPointerDown(event) {
        const box = event.currentTarget;
        const parent = box.parentElement;
        if (active.current || !parent || event.button !== 0) return;
        box.setPointerCapture(event.pointerId);
        active.current = {
          item,
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          origin: layout[item],
          travelX: parent.clientWidth - box.offsetWidth,
          travelY: parent.clientHeight - box.offsetHeight,
        };
      },
      onPointerMove(event) {
        const drag = active.current;
        if (drag?.pointerId !== event.pointerId || drag.item !== item) return;
        setDraft({ item, placement: moved(drag, event.clientX, event.clientY) });
      },
      onPointerUp(event) {
        const drag = active.current;
        if (drag?.pointerId !== event.pointerId || drag.item !== item) return;
        const placement = moved(drag, event.clientX, event.clientY);
        reset(event.pointerId);
        if (placement.x !== drag.origin.x || placement.y !== drag.origin.y) save({ ...layout, [item]: placement });
      },
      onPointerCancel: (event) => reset(event.pointerId),
      onLostPointerCapture: (event) => reset(event.pointerId),
    };
  }

  return { layout: draft ? { ...layout, [draft.item]: draft.placement } : layout, handlers };
}
