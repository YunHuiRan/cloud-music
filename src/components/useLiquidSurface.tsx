import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";

interface LiquidSurfaceOptions {
  draggable?: boolean;
  onDragSelect?: (index: number) => void;
}

interface Glow {
  x: number;
  y: number;
  active: boolean;
  dx: number;
  dy: number;
}

const initialGlow: Glow = { x: 0, y: 0, active: false, dx: 0, dy: 0 };

export function useLiquidSurface<T extends HTMLElement = HTMLDivElement>({
  draggable = false,
  onDragSelect,
}: LiquidSurfaceOptions = {}) {
  const ref = useRef<T>(null);
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const [glow, setGlow] = useState<Glow>(initialGlow);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: PointerEvent<T>) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const surface = ref.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    start.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    moved.current = false;
    surface.setPointerCapture(event.pointerId);
    setDragging(true);
    setGlow({
      x: start.current.x,
      y: start.current.y,
      active: true,
      dx: 0,
      dy: 0,
    });
  };

  const onPointerMove = (event: PointerEvent<T>) => {
    const surface = ref.current;
    if (!surface?.hasPointerCapture(event.pointerId)) return;
    const rect = surface.getBoundingClientRect();
    const dx = event.clientX - (rect.left + start.current.x);
    const dy = event.clientY - (rect.top + start.current.y);
    if (Math.hypot(dx, dy) > 6) moved.current = true;
    setGlow({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true,
      dx: Math.max(-10, Math.min(10, dx * 0.045)),
      dy: Math.max(-5, Math.min(5, dy * 0.03)),
    });
  };

  const finish = (event: PointerEvent<T>) => {
    const surface = ref.current;
    if (!surface?.hasPointerCapture(event.pointerId)) return;
    surface.releasePointerCapture(event.pointerId);
    if (moved.current) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 280);
      if (draggable) {
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-liquid-index]");
        const index = Number(target?.dataset.liquidIndex);
        if (Number.isFinite(index)) onDragSelect?.(index);
      }
    }
    setDragging(false);
    setGlow((current) => ({ ...current, active: false, dx: 0, dy: 0 }));
  };

  const cancel = (event: PointerEvent<T>) => {
    if (ref.current?.hasPointerCapture(event.pointerId)) {
      ref.current.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    setGlow(initialGlow);
  };

  const onClickCapture = (event: MouseEvent<T>) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const style = {
    "--glow-x": `${glow.x}px`,
    "--glow-y": `${glow.y}px`,
    "--glow-opacity": glow.active ? 1 : 0,
    "--drag-x": `${glow.dx}px`,
    "--drag-y": `${glow.dy}px`,
  } as CSSProperties;

  return {
    ref,
    dragging,
    style,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: cancel,
      onClickCapture,
    },
    decor: (
      <>
        <span className="liquid-glow" aria-hidden="true" />
        <span className="liquid-sheen" aria-hidden="true" />
      </>
    ),
  };
}
