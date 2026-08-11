import { useEffect, useRef } from "react";
import type { Surface } from "../Theme";
import { VERTEX_SRC, CONTOUR_FRAG, MARBLE_FRAG, BOKEH_FRAG } from "./shaders";
import { createProgram, drawFullscreenTriangle, hexToRgb01 } from "./glUtil";

interface GeneratedSurfaceProps {
  surface: Extract<Surface, { kind: "contour" | "marble" | "bokeh" }>;
  seed: number;
  calm: number;
  reducedMotion: boolean;
  className?: string;
}

/**
 * The three generated surfaces (contour/marble/bokeh) rendered on the GPU
 * at a fixed 30fps cap — same ceiling the native app uses for its Metal
 * shaders, chosen there (and kept here) because the motion is meant to be
 * ambient, not smooth 60fps decoration that competes with the ink.
 */
export function GeneratedSurface({ surface, seed, calm, reducedMotion, className }: GeneratedSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    // Re-bound with an explicit type: TS does not carry the narrowing
    // above into the nested `resize`/`frame` function declarations below.
    const canvas: HTMLCanvasElement = canvasEl;
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false });
    if (!gl) return;

    const fragSrc = surface.kind === "contour" ? CONTOUR_FRAG : surface.kind === "marble" ? MARBLE_FRAG : BOKEH_FRAG;
    const program = createProgram(gl, VERTEX_SRC, fragSrc);
    gl.useProgram(program);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uSize = uniform("uSize");
    const uTime = uniform("uTime");
    const uSeed = uniform("uSeed");
    const uCalm = uniform("uCalm");

    if (surface.kind === "contour") {
      gl.uniform3fv(uniform("uBase"), hexToRgb01(surface.base));
      gl.uniform3fv(uniform("uLine"), hexToRgb01(surface.line));
      gl.uniform3fv(uniform("uGlow"), hexToRgb01(surface.glow));
      gl.uniform1f(uniform("uBands"), surface.bands);
    } else if (surface.kind === "marble") {
      gl.uniform3fv(uniform("uC1"), hexToRgb01(surface.c1));
      gl.uniform3fv(uniform("uC2"), hexToRgb01(surface.c2));
      gl.uniform3fv(uniform("uC3"), hexToRgb01(surface.c3));
    } else {
      gl.uniform3fv(uniform("uBase"), hexToRgb01(surface.base));
      gl.uniform3fv(uniform("uNear"), hexToRgb01(surface.near));
      gl.uniform3fv(uniform("uFar"), hexToRgb01(surface.far));
      gl.uniform1f(uniform("uDensity"), surface.density);
    }
    gl.uniform1f(uSeed, seed);

    let raf = 0;
    let running = true;
    let lastFrameAt = 0;
    const FRAME_INTERVAL = 1000 / 30; // 30fps cap, matching the native shader refresh
    const start = performance.now();

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl!.viewport(0, 0, w, h);
      }
      gl!.uniform2f(uSize, w, h);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    function frame(now: number) {
      if (!running) return;
      if (now - lastFrameAt >= FRAME_INTERVAL) {
        lastFrameAt = now;
        const t = reducedMotion ? 40 : (now - start) / 1000;
        gl!.uniform1f(uTime, t);
        gl!.uniform1f(uCalm, calm);
        drawFullscreenTriangle(gl!, program);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      gl.deleteProgram(program);
    };
    // Recompiling per surface/seed change is intentional — themes switch
    // rarely (host setup), so this isn't a hot path.
  }, [surface, seed, calm, reducedMotion]);

  return <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} />;
}
