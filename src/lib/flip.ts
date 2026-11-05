import { useLayoutEffect, useRef, type RefObject } from "react";

interface Position {
  x: number;
  y: number;
}

/**
 * A small FLIP helper. Every child carrying `data-flip-id` is measured after
 * each commit. If its layout position changed, it is animated from the old
 * position to the new one with the Web Animations API.
 *
 * Layout offsets (rather than bounding rects) are used so an in-flight
 * transform never distorts the next measurement.
 */
export function useFlip(
  containerRef: RefObject<HTMLElement | null>,
  extraSelector = "",
  enabled = true,
): void {
  const positions = useRef<Map<string, Position>>(new Map());
  const hasRun = useRef(false);
  const lastWidth = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      positions.current.clear();
      hasRun.current = false;
      return;
    }

    const selector = `[data-flip-id]${extraSelector ? `, ${extraSelector}` : ""}`;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const next = new Map<string, Position>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const firstRun = !hasRun.current;
    const width = container.clientWidth;
    const widthChanged = !firstRun && lastWidth.current !== width;
    lastWidth.current = width;
    hasRun.current = true;

    for (const node of nodes) {
      const id = node.dataset.flipId;
      if (!id) continue;

      for (const animation of node.getAnimations()) {
        if ((animation as Animation & { __flip?: boolean }).__flip) {
          animation.cancel();
        }
      }

      const position = { x: node.offsetLeft, y: node.offsetTop };
      next.set(id, position);
      if (reduceMotion || widthChanged) continue;

      const previous = positions.current.get(id);
      if (previous) {
        const dx = previous.x - position.x;
        const dy = previous.y - position.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        const animation = node.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          {
            duration: 330,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );
        (animation as Animation & { __flip?: boolean }).__flip = true;
      } else if (!firstRun) {
        const animation = node.animate(
          [
            { opacity: 0, transform: "translateY(7px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 240,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );
        (animation as Animation & { __flip?: boolean }).__flip = true;
      }
    }

    positions.current = next;
  });
}
