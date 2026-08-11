import { hex } from "./Theme";

export type DeadZone = "topLeading" | "top" | "bottomLeading" | "leading";

export interface Cover {
  id: string;
  asset: string;
  deadZone: DeadZone;
  ink: string;
  lift: number;
}

/** Ported 1:1 from Theme/Cover.swift. Placement and ink colour are
 * pre-baked design decisions per photograph, not computed at runtime. */
export const COVERS: Cover[] = [
  { id: "ember", asset: "cover-ember.jpg", deadZone: "topLeading", ink: hex(0xfbf3e6), lift: 0.0 },
  { id: "station", asset: "cover-station.jpg", deadZone: "top", ink: hex(0xf6efe2), lift: 0.0 },
  { id: "grind", asset: "cover-grind.jpg", deadZone: "topLeading", ink: hex(0x1a1d22), lift: 0.0 },
  { id: "hill", asset: "cover-hill.jpg", deadZone: "topLeading", ink: hex(0x18202c), lift: 0.0 },
  { id: "ink", asset: "cover-ink.jpg", deadZone: "top", ink: hex(0x14161a), lift: 0.0 },
  { id: "paper", asset: "cover-paper.jpg", deadZone: "bottomLeading", ink: hex(0x2a241c), lift: 0.06 },
];

export function coverById(id: string | null): Cover | null {
  if (!id) return null;
  return COVERS.find((c) => c.id === id) ?? null;
}

export function deadZoneAlignment(zone: DeadZone): { justify: string; align: string } {
  switch (zone) {
    case "topLeading":
      return { justify: "flex-start", align: "flex-start" };
    case "top":
      return { justify: "center", align: "flex-start" };
    case "bottomLeading":
      return { justify: "flex-start", align: "flex-end" };
    case "leading":
      return { justify: "flex-start", align: "center" };
  }
}
