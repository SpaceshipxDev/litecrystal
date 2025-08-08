"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

export default function MiniMapNav({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  // Board metrics (what's visible vs total)
  const [metrics, setMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });

  // Actual column segments (so the mini-map mirrors your board precisely)
  const [segments, setSegments] = useState<Array<{ id: string; left: number; width: number }>>([]);

  // Drag state for the viewport pill
  const draggingRef = useRef<{ startX: number; startLeft: number } | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;

    const cols = Array.from(el.querySelectorAll<HTMLElement>("[data-col-id]"));
    const segs = cols.map((node) => ({
      id: node.getAttribute("data-col-id") || "",
      left: node.offsetLeft,
      width: node.offsetWidth,
    }));

    setMetrics({ scrollLeft, scrollWidth, clientWidth });
    setSegments(segs);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      setMetrics((m) => ({
        ...m,
        scrollLeft: el.scrollLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
    };

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    const mo = new MutationObserver(() => queueMicrotask(measure));
    mo.observe(el, { childList: true, subtree: true });

    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure, containerRef]);

  // Geometry for the mini-map
  const PADDING = 8;
  const MAP_W = 280;
  const trackW = MAP_W - PADDING * 2;

  const { scrollLeft, scrollWidth, clientWidth } = metrics;
  const maxScroll = Math.max(1, scrollWidth - clientWidth);
  const viewportRatio = Math.max(0, Math.min(1, clientWidth / Math.max(1, scrollWidth)));
  const handleW = Math.max(24, Math.round(trackW * viewportRatio));
  const progress = Math.max(0, Math.min(1, scrollLeft / maxScroll));
  const handleX = Math.round(progress * (trackW - handleW));
  const hasOverflow = scrollWidth > clientWidth + 2;

  const trackXToScrollLeft = (x: number) => {
    const clamped = Math.max(0, Math.min(trackW - handleW, x));
    const p = clamped / Math.max(1, trackW - handleW);
    return Math.round(p * maxScroll);
  };

  const onMouseDownHandle = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = { startX: e.clientX, startLeft: handleX };
    const onMove = (me: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = me.clientX - draggingRef.current.startX;
      const nextTrackX = draggingRef.current.startLeft + delta;
      const el = containerRef.current;
      if (el) el.scrollTo({ left: trackXToScrollLeft(nextTrackX), behavior: "auto" });
    };
    const onUp = () => {
      draggingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - bounds.left - PADDING - handleW / 2;
    const el = containerRef.current;
    if (el) el.scrollTo({ left: trackXToScrollLeft(x), behavior: "smooth" });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    el.scrollBy({ left: delta, behavior: "auto" });
  };

  const page = (dir: -1 | 1) => {
    const el = containerRef.current;
    if (!el) return;
    const amount = Math.max(160, clientWidth - 80);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none" onWheel={onWheel} aria-hidden={false}>
      <div
        className={`rounded-2xl border shadow-sm backdrop-blur ${
          hasOverflow ? "bg-white/90 border-gray-200" : "bg-white/70 border-gray-200/60"
        }`}
        title={hasOverflow ? "" : "没有更多内容可滚动"}
      >
        <div className="flex items-center gap-2 px-2 py-2">
          {/* Left page button */}
          <button
            onClick={() => page(-1)}
            className="h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-40"
            disabled={!hasOverflow}
            aria-label="Scroll left"
          >
            ‹
          </button>

          {/* Track */}
          <div className="relative h-8" style={{ width: MAP_W }} onMouseDown={onTrackClick}>
            {/* Track background */}
            <div className="absolute inset-0 px-2">
              <div className="h-full w-full rounded-lg border border-gray-200 bg-gray-100" />
            </div>

            {/* Column segments */}
            <div className="absolute inset-0" style={{ padding: PADDING }}>
              <div className="relative h-full w-full">
                {segments.map((seg) => {
                  const x = (seg.left / Math.max(1, scrollWidth)) * trackW;
                  const w = Math.max(2, (seg.width / Math.max(1, scrollWidth)) * trackW - 2);
                  return (
                    <div
                      key={seg.id}
                      className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm bg-gray-300/70"
                      style={{ left: x, width: w }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Viewport pill */}
            <div className="absolute inset-0" style={{ padding: PADDING }}>
              <div
                role="slider"
                aria-label="Board viewport"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-md border bg-white shadow-sm ${
                  hasOverflow ? "border-blue-300 cursor-grab active:cursor-grabbing" : "border-gray-300 cursor-not-allowed"
                }`}
                style={{ left: handleX, width: handleW }}
                onMouseDown={hasOverflow ? onMouseDownHandle : undefined}
              />
            </div>
          </div>

          {/* Right page button */}
          <button
            onClick={() => page(1)}
            className="h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-40"
            disabled={!hasOverflow}
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
