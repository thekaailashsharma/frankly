import { hexToHsl, hslToHex } from "./color";

interface ColourFieldProps {
  colour: string;
  calm: number;
  className?: string;
}

/**
 * Ported 1:1 from ColourField.swift — a five-tone HSL ladder rendered as a
 * symmetric 9-stop horizontal gradient plus a soft radial lift, not a
 * flat fill. `calm` (0..1) compresses the spread and desaturates slightly
 * as an event settles.
 */
export function ColourField({ colour, calm, className }: ColourFieldProps) {
  const base = hexToHsl(colour);
  const spread = 1 - calm * 0.55;
  const sat = 1 - calm * 0.35;

  function tone(satMul: number, lightDelta: number): string {
    return hslToHex({
      h: base.h,
      s: Math.max(0, Math.min(1, base.s * satMul * sat)),
      l: Math.max(0, Math.min(1, base.l + lightDelta * spread)),
    });
  }

  const edge = tone(1.01, -0.03);
  const shoulder = tone(1.0, -0.015);
  const mid = tone(0.99, 0);
  const inner = tone(0.97, 0.012);
  const centre = tone(0.95, 0.022);

  const gradient = [
    `${edge} 0%`,
    `${shoulder} 12%`,
    `${mid} 26%`,
    `${inner} 40%`,
    `${centre} 50%`,
    `${inner} 60%`,
    `${mid} 74%`,
    `${shoulder} 88%`,
    `${edge} 100%`,
  ].join(", ");

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: centre,
        backgroundImage: [
          `radial-gradient(900px circle at 50% 40%, ${withAlpha(centre, 0.1)}, transparent)`,
          `linear-gradient(to right, ${gradient})`,
        ].join(", "),
        transition: "background 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    />
  );
}

function withAlpha(hexStr: string, alpha: number): string {
  const r = parseInt(hexStr.slice(1, 3), 16);
  const g = parseInt(hexStr.slice(3, 5), 16);
  const b = parseInt(hexStr.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
