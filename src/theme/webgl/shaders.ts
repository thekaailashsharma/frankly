/**
 * GLSL transliteration of the native app's Metal noise primitives
 * (Backdrops.metal). Same hash, same value-noise, same fbm — bit-for-bit
 * the same algorithm, just a different shading language. This shared
 * block is prepended to all three surface fragment shaders below.
 */
export const NOISE_LIB = `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p = p * 2.02 + vec2(37.1, 11.7);
      amp *= 0.5;
    }
    return v;
  }

  vec2 field(vec2 pos, vec2 size, float scale, float seed) {
    vec2 uv = pos / max(size, vec2(1.0));
    float aspect = size.x / max(size.y, 1.0);
    uv.x *= aspect;
    return uv * scale + vec2(seed * 13.7, seed * 7.3);
  }
`;

export const VERTEX_SRC = `
  attribute vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const HEADER = `
  precision highp float;
  uniform vec2 uSize;
  uniform float uTime;
  uniform float uSeed;
  uniform float uCalm;
`;

/** Contour — ported from `contourBackdrop(size:time:base:line:glow:bands:seed:calm:)`. */
export const CONTOUR_FRAG = `
  ${HEADER}
  uniform vec3 uBase;
  uniform vec3 uLine;
  uniform vec3 uGlow;
  uniform float uBands;
  ${NOISE_LIB}
  void main() {
    vec2 pos = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
    vec2 p = field(pos, uSize, 3.0, uSeed);
    float t = uTime * 0.020 * (1.0 - uCalm * 0.6);
    float h = fbm(p + vec2(t, -t * 0.6));
    float b = h * uBands;
    float d = abs(fract(b) - 0.5) * 2.0;
    float crisp = 1.0 - smoothstep(0.0, 0.10, d);
    float halo = 1.0 - smoothstep(0.0, 0.62, d);
    float region = smoothstep(0.25, 0.85, fbm(p * 0.35 + 20.0));
    vec3 colour = uBase;
    colour = mix(colour, uGlow, halo * 0.30 * (0.35 + region * 0.65));
    colour = mix(colour, uLine, crisp * (0.55 + region * 0.45) * (1.0 - uCalm * 0.5));
    gl_FragColor = vec4(colour, 1.0);
  }
`;

/** Marble — ported from `marbleBackdrop(size:time:c1:c2:c3:seed:calm:)`,
 * a two-stage domain-warped fbm. */
export const MARBLE_FRAG = `
  ${HEADER}
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  ${NOISE_LIB}
  void main() {
    vec2 pos = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
    vec2 p = field(pos, uSize, 2.2, uSeed);
    float t = uTime * 0.030 * (1.0 - uCalm * 0.6);
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0)), fbm(p + vec2(5.2, 1.3)));
    vec2 r = vec2(
      fbm(p + 3.4 * q + vec2(1.7, 9.2) + t),
      fbm(p + 3.4 * q + vec2(8.3, 2.8) - t * 0.7)
    );
    float v = fbm(p + 3.0 * r);
    v = clamp(v * 1.55 - 0.22, 0.0, 1.0);
    vec3 colour = v < 0.5
      ? mix(uC1, uC2, smoothstep(0.0, 0.5, v))
      : mix(uC2, uC3, smoothstep(0.5, 1.0, v));
    float vein = 1.0 - smoothstep(0.0, 0.16, abs(fract(v * 7.0) - 0.5) * 2.0);
    colour = mix(colour, uC3, vein * 0.14 * (1.0 - uCalm));
    float lum = dot(colour, vec3(0.2126, 0.7152, 0.0722));
    colour = mix(colour, vec3(lum), uCalm * 0.55);
    gl_FragColor = vec4(colour, 1.0);
  }
`;

/** Bokeh — ported from `bokehBackdrop(size:time:base:near:far:density:seed:calm:)`.
 * Two layers of sparse jittered points on a 3x3 neighbourhood, 55% of
 * cells skipped so bokeh reads as scattered rather than a solid grid. */
export const BOKEH_FRAG = `
  ${HEADER}
  uniform vec3 uBase;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uDensity;
  ${NOISE_LIB}
  vec3 layer(vec2 uv, float aspect, float t, float layerIndex, float density, float seed,
             vec3 near, vec3 far, float calm) {
    float scale = density * (layerIndex < 0.5 ? 1.0 : 0.55);
    vec2 p = uv * scale + vec2(seed * 4.1 + layerIndex * 17.3, -t * (layerIndex < 0.5 ? 1.0 : 0.6));
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec3 acc = vec3(0.0);
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 offset = vec2(float(dx), float(dy));
        vec2 id = cell + offset;
        float r1 = hash21(id + vec2(seed, 0.0));
        float r2 = hash21(id + vec2(9.7, seed));
        if (r1 < 0.55) continue;
        vec2 centre = offset + vec2(r1, r2);
        float dist = length(f - centre);
        float radius = 0.10 + r2 * 0.16;
        float pulse = 0.82 + 0.18 * sin(uTime * 0.35 + r1 * 12.0);
        float glow = exp(-pow(dist / (radius * pulse), 2.0) * 3.2);
        vec3 tint = r2 > 0.5 ? near : far;
        acc += tint * glow * (layerIndex < 0.5 ? 0.55 : 0.85) * (1.0 - calm * 0.6);
      }
    }
    return acc;
  }
  void main() {
    vec2 pos = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
    vec2 uv = pos / max(uSize, vec2(1.0));
    float aspect = uSize.x / max(uSize.y, 1.0);
    uv.x *= aspect;
    float t = uTime * 0.035 * (1.0 - uCalm * 0.7);
    vec3 colour = uBase;
    colour += layer(uv, aspect, t, 0.0, uDensity, uSeed, uNear, uFar, uCalm);
    colour += layer(uv, aspect, t, 1.0, uDensity, uSeed, uNear, uFar, uCalm);
    colour = min(colour, vec3(1.0));
    gl_FragColor = vec4(colour, 1.0);
  }
`;
