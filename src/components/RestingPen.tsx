interface RestingPenProps {
  tint: string;
  width: number;
  height?: number;
}

/**
 * A decorative drawn pen, ported 1:1 from the native SwiftUI shape — a
 * tapered body with a soft drop shadow, not an icon-font glyph. Purely
 * ornamental (empty-state art, onboarding), so it renders as inline SVG
 * rather than a component with any interactive surface.
 */
export function RestingPen({ tint, width, height = 22 }: RestingPenProps) {
  const midY = height / 2;
  const bodyX = width * 0.16;
  const bodyW = width * 0.8;
  const bodyY = midY - 2.6;
  const bodyH = 5.2;
  const shadowDy = 5;

  return (
    <svg width={width} height={height + shadowDy} viewBox={`0 0 ${width} ${height + shadowDy}`} aria-hidden>
      {/* shadow — same body rect, offset down, drawn first (behind) */}
      <rect x={bodyX} y={bodyY + shadowDy} width={bodyW} height={bodyH} rx={2.6} fill={tint} opacity={0.13} />
      {/* nib — a triangle tapering to a point at the left edge */}
      <polygon points={`${bodyX},${midY - 2.6} ${bodyX},${midY + 2.6} 0,${midY}`} fill={tint} />
      {/* body */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx={2.6} fill={tint} />
    </svg>
  );
}
