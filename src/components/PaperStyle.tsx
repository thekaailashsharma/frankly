import { useEffect, useRef } from "react";

export type PaperStyleKind = "plain" | "ruled" | "dotted" | "aged";

interface PaperStyleProps {
  kind: PaperStyleKind;
  tint: string;
  lineSpacing: number;
  className?: string;
}

function withAlpha(hexStr: string, alpha: number): string {
  const r = parseInt(hexStr.slice(1, 3), 16);
  const g = parseInt(hexStr.slice(3, 5), 16);
  const b = parseInt(hexStr.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Ported 1:1 from PaperStyle.swift — drawn under the ink, above the
 * card. Purely decorative texture, never intercepts a pointer. */
export function PaperStyle({ kind, tint, lineSpacing, className }: PaperStyleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const w = rect.width;
      const h = rect.height;

      if (kind === "plain") return;

      if (kind === "ruled") {
        ctx.strokeStyle = withAlpha(tint, 0.13);
        ctx.lineWidth = 0.5;
        for (let y = lineSpacing; y < h; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        return;
      }

      if (kind === "dotted") {
        ctx.fillStyle = withAlpha(tint, 0.22);
        for (let y = lineSpacing; y < h; y += lineSpacing) {
          for (let x = lineSpacing; x < w; x += lineSpacing) {
            ctx.beginPath();
            ctx.ellipse(x, y, 0.7, 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        return;
      }

      // aged
      ctx.fillStyle = withAlpha(tint, 0.02);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = withAlpha(tint, 0.022);
      for (let i = 0; i < 26; i++) {
        const x = (((i * 7919) % 1000) / 1000) * w;
        const y = (((i * 104729) % 1000) / 1000) * h;
        const radius = 6 + (((i * 31) % 100) / 100) * 22;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kind, tint, lineSpacing]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
