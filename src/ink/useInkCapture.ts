import { useCallback, useRef } from "react";
import type { StrokePoint } from "./types";

interface CaptureOptions {
  /** Fires synchronously at pointer-down, before the first point even
   * lands — Station uses this to leave the attract phase and to drive
   * the palette's auto-minimize timer, both of which need to react the
   * instant the pen touches down, not after the first rAF-batched point. */
  onStrokeBegan?: () => void;
  onPointsChanged: (points: StrokePoint[]) => void;
  onStrokeEnd: (points: StrokePoint[]) => void;
  getCanvasRect: () => DOMRect;
  enabled: boolean;
}

/**
 * Captures a pointer stream at the highest fidelity Safari actually offers.
 *
 * `getCoalescedEvents()` returns the same native sub-frame samples UIKit
 * hands PencilKit — real, not a JS approximation — confirmed by reading
 * WebKit's own source. We take every one of them rather than just the
 * last position per frame, which is where most of the "laggy" feeling in
 * naive canvas apps actually comes from.
 *
 * Palm rejection is done by hand: a touch pointer arriving within 500ms of
 * pen activity is treated as the heel of the hand, not a finger note. On a
 * phone with no pen ever seen, touch is first-class input from the start.
 */
export function useInkCapture({
  onStrokeBegan,
  onPointsChanged,
  onStrokeEnd,
  getCanvasRect,
  enabled,
}: CaptureOptions) {
  const pointsRef = useRef<StrokePoint[]>([]);
  const activePointerId = useRef<number | null>(null);
  const lastPenTime = useRef(0);
  const startTime = useRef(0);

  const toPoint = useCallback(
    (e: PointerEvent, rect: DOMRect): StrokePoint => ({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: e.timeStamp - startTime.current,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    }),
    []
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!enabled) return;
      const now = performance.now();
      if (e.pointerType === "pen") lastPenTime.current = now;
      else if (e.pointerType === "touch" && now - lastPenTime.current < 500) {
        // Heel of the hand while a pencil is in use — reject.
        return;
      }

      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      activePointerId.current = e.pointerId;
      startTime.current = e.timeStamp;

      onStrokeBegan?.();
      const rect = getCanvasRect();
      pointsRef.current = [toPoint(e.nativeEvent, rect)];
      onPointsChanged(pointsRef.current);
    },
    [enabled, getCanvasRect, toPoint, onPointsChanged, onStrokeBegan]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      e.preventDefault();
      const rect = getCanvasRect();
      const native = e.nativeEvent as PointerEvent & {
        getCoalescedEvents?: () => PointerEvent[];
      };
      const coalesced = native.getCoalescedEvents?.() ?? [native];
      for (const ev of coalesced) {
        pointsRef.current.push(toPoint(ev, rect));
      }
      onPointsChanged(pointsRef.current);
    },
    [getCanvasRect, toPoint, onPointsChanged]
  );

  const endStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      activePointerId.current = null;
      const finished = pointsRef.current;
      pointsRef.current = [];
      if (finished.length > 0) onStrokeEnd(finished);
    },
    [onStrokeEnd]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endStroke,
    onPointerCancel: endStroke,
    onPointerLeave: endStroke,
  };
}
