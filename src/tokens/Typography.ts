import type { CSSProperties } from "react";

/**
 * Ported 1:1 from Typography.swift. Four fixed app-voice roles plus the
 * closed NoteFace palette for handwriting-to-type conversion. Values not
 * given here (point sizes) are call-site-supplied, exactly as in the
 * native app — this module only fixes the *face* and its optical scale.
 */

export function poster(size: number, medium = false): CSSProperties {
  return { fontFamily: medium ? "ClashDisplay-Medium" : "ClashDisplay-Regular", fontSize: size };
}

export function editorial(size: number, light = false): CSSProperties {
  return { fontFamily: light ? "Zodiak-Light" : "Zodiak-Regular", fontSize: size };
}

export function label(size: number, medium = false): CSSProperties {
  return { fontFamily: medium ? "Satoshi-Medium" : "Satoshi-Regular", fontSize: size };
}

export function micro(size = 10, medium = true): CSSProperties {
  return { fontFamily: medium ? "JetBrainsMono-Medium" : "JetBrainsMono-Regular", fontSize: size };
}

export type NoteFace =
  | "comico"
  | "kalam"
  | "britney"
  | "telma"
  | "pencerio"
  | "rosaline"
  | "gambarino"
  | "stardom"
  | "tanker";

interface NoteFaceConfig {
  label: string;
  family: string;
  opticalScale: number;
  isHandlike: boolean;
}

export const NOTE_FACES: Record<NoteFace, NoteFaceConfig> = {
  comico: { label: "Comico", family: "Comico-Regular", opticalScale: 1.0, isHandlike: true },
  kalam: { label: "Kalam", family: "Kalam-Regular", opticalScale: 0.94, isHandlike: true },
  britney: { label: "Britney", family: "Britney-Regular", opticalScale: 1.06, isHandlike: true },
  telma: { label: "Telma", family: "Telma-Regular", opticalScale: 1.02, isHandlike: true },
  pencerio: { label: "Pencerio", family: "Pencerio-Hairline", opticalScale: 1.34, isHandlike: true },
  rosaline: { label: "Rosaline", family: "Rosaline-Regular", opticalScale: 1.22, isHandlike: true },
  gambarino: { label: "Gambarino", family: "Gambarino-Regular", opticalScale: 0.96, isHandlike: false },
  stardom: { label: "Stardom", family: "Stardom-Regular", opticalScale: 0.92, isHandlike: false },
  tanker: { label: "Tanker", family: "Tanker-Regular", opticalScale: 0.82, isHandlike: false },
};

export function noteFaceFont(face: NoteFace, size: number): CSSProperties {
  const config = NOTE_FACES[face];
  return { fontFamily: config.family, fontSize: size * config.opticalScale };
}
