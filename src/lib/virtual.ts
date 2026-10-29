import { useEffect, useState, type RefObject } from "react";

const MIN_VIRTUAL_COUNT = 160;
const OVERSCAN = 7;
const DEFAULT_ROW_HEIGHT = 58;

export interface VirtualRows {
  start: number;
  end: number;
  rowHeight: number;
  topPadding: number;
  bottomPadding: number;
  virtualized: boolean;
}

/**
 * Window a long track list. The app scrolls `.content`, not the window, so the
 * hook reads that element's scroll position and keeps only the visible rows
 * mounted. Small lists keep the original full render (and FLIP animations).
 */
export function useVirtualRows(
  containerRef: RefObject<HTMLElement | null>,
  count: number,
): VirtualRows {
  const virtualized = count > MIN_VIRTUAL_COUNT;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(count, virtualized ? 60 : count));
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);

  useEffect(() => {
    if (!virtualized) {
      setStart(0);
      setEnd(count);
      return;
    }

    const container = containerRef.current;
    const scroller = container?.closest<HTMLElement>(".content");
    if (!container || !scroller) {
      setStart(0);
      setEnd(count);
      return;
    }

    let frame = 0;
    const update = (): void => {
      frame = 0;
      const containerRect = container.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const head = container.querySelector<HTMLElement>(".track-head");
      const paddingTop = Number.parseFloat(getComputedStyle(container).paddingTop) || 0;
      const headHeight = head?.getBoundingClientRect().height ?? 0;
      const rowsTop =
        containerRect.top - scrollerRect.top + scroller.scrollTop + paddingTop + headHeight;
      const viewTop = scroller.scrollTop - rowsTop;
      const first = Math.max(
        0,
        Math.floor(viewTop / rowHeight) - OVERSCAN,
      );
      const last = Math.min(
        count,
        Math.ceil((viewTop + scroller.clientHeight) / rowHeight) + OVERSCAN,
      );
      const nextStart = Math.min(first, Math.max(0, count - 1));
      const nextEnd = Math.max(nextStart + 1, Math.min(count, last));
      setStart((current) => (current === nextStart ? current : nextStart));
      setEnd((current) => (current === nextEnd ? current : nextEnd));
    };
    const schedule = (): void => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    observer.observe(container);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, count, rowHeight, virtualized]);

  useEffect(() => {
    const row = containerRef.current?.querySelector<HTMLElement>(".track-row");
    if (!row) return;
    const measured = row.getBoundingClientRect().height;
    if (measured > 0 && Math.abs(measured - rowHeight) > 0.5) {
      setRowHeight(measured);
    }
  }, [containerRef, rowHeight, start, end]);

  return {
    start,
    end,
    rowHeight,
    topPadding: start * rowHeight,
    bottomPadding: Math.max(0, count - end) * rowHeight,
    virtualized,
  };
}