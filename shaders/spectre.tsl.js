/**
 * SPECTRE SHADER - TSL (Three.js Shading Language)
 *
 * A procedural ghost/phantom effect for Spectre's attack.
 * Features:
 *   - Ethereal wispy trails using directional noise
 *   - Ghostly fade with transparency gradient
 *   - Floating soul particle orbs
 *   - Haunting color palette (pale blues and purples)
 *
 * @author baguette.art
 * @version 1.0.0
 */

import {
  uniform,
  uv,
  time,
  sin,
  cos,
  vec2,
  vec3,
  vec4,
  float,
  floor,
  fract,
  mix,
  smoothstep,
  step,
  dot,
  length,
  abs,
  max,
  min,
  clamp,
  mod,
  MeshBasicNodeMaterial,
  positionLocal
} from 'three/tsl';

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Hash function for procedural randomness
 * Based on the classic Dave Hoskins hash
 */
function hash(n) {
  return fract(sin(n).mul(43758.5453123));
}

function hash2(p) {
  const d = dot(p, vec2(127.1, 311.7));
  return fract(sin(d).mul(43758.5453123));
}

function hash22(p) {
  const px = dot(p, vec2(127.1, 311.7));
  const py = dot(p, vec2(269.5, 183.3));
  return vec2(
    fract(sin(px).mul(43758.5453123)),
    fract(sin(py).mul(43758.5453123))
  );
}

// ===========================================
// NOISE FUNCTIONS
// ===========================================

/**
 * Smooth 2D value noise
 */
function noise2D(p) {
  const i = floor(p);
  const f = fract(p);

  // Four corners
  const a = hash2(i);
  const b = hash2(i.add(vec2(1, 0)));
  const c = hash2(i.add(vec2(0, 1)));
  const d = hash2(i.add(vec2(1, 1)));

  // Smooth interpolation
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/**
 * Fractal Brownian Motion - layered noise for organic patterns
 */
function fbm(p, octaves = 4) {
  let value = float(0);
  let amplitude = float(0.5);
  let frequency = float(1);
  let pos = p;

  for (let i = 0; i < octaves; i++) {
    value = value.add(noise2D(pos.mul(frequency)).mul(amplitude));
    amplitude = amplitude.mul(0.5);
    frequency = frequency.mul(2);
  }

  return value;
}

/**
 * Directional noise for wispy trails
 */
function directionalNoise(p, direction, stretch = 3) {
  // Stretch noise in one direction for wispy effect
  const stretchedP = vec2(
    p.x.mul(stretch),
    p.y
  );

  // Rotate based on direction
  const angle = direction;
  const rotatedP = vec2(
    stretchedP.x.mul(cos(angle)).sub(stretchedP.y.mul(sin(angle))),
    stretchedP.x.mul(sin(angle)).add(stretchedP.y.mul(cos(angle)))
  );

  return fbm(rotatedP, 3);
}

// ===========================================
// SPECTRE EFFECT FUNCTIONS
// ===========================================

/**
 * Create wispy ghost trails
 */
function createWisps(vUv, t) {
  // Multiple wisp layers at different angles
  const wisp1 = directionalNoise(vUv.add(vec2(t.mul(0.1), t.mul(0.2))), float(-0.3), 4);
  const wisp2 = directionalNoise(vUv.add(vec2(t.mul(-0.15), t.mul(0.25))), float(0.5), 3);
  const wisp3 = directionalNoise(vUv.add(vec2(t.mul(0.08), t.mul(-0.1))), float(0.1), 5);

  // Combine wisps with different weights
  return wisp1.mul(0.4).add(wisp2.mul(0.35)).add(wisp3.mul(0.25));
}

/**
 * Soul orb particles floating around
 */
function soulOrbs(vUv, t) {
  let orbs = float(0);

  // Create multiple floating orbs
  for (let i = 0; i < 5; i++) {
    const seed = float(i * 17.31);

    // Circular floating path
    const orbCenter = vec2(
      float(0.5).add(sin(t.mul(0.5 + i * 0.1).add(seed)).mul(0.3)),
      float(0.5).add(cos(t.mul(0.4 + i * 0.15).add(seed.mul(2))).mul(0.3))
    );

    const dist = length(vUv.sub(orbCenter));
    const orbGlow = smoothstep(float(0.08), float(0), dist);

    // Pulsing intensity
    const pulse = sin(t.mul(2 + i * 0.5).add(seed)).mul(0.3).add(0.7);

    orbs = orbs.add(orbGlow.mul(pulse));
  }

  return clamp(orbs, float(0), float(1));
}

/**
 * Ethereal glow gradient
 */
function etherealGlow(vUv, t) {
  const centered = vUv.sub(0.5).mul(2);
  const dist = length(centered);

  // Breathing/hovering effect
  const hover = sin(t.mul(1.5)).mul(0.05);

  // Base glow falloff
  const glow = smoothstep(float(1.2), float(0).add(hover), dist);

  // Add some waviness to the edge
  const waveAngle = centered.y.div(centered.x.add(0.001)).atan();
  const wave = sin(waveAngle.mul(3).add(t)).mul(0.1);

  return smoothstep(float(1).add(wave), float(0), dist);
}

// ===========================================
// MAIN SHADER FUNCTION
// ===========================================

/**
 * Creates the complete Spectre shader material
 * @returns {MeshBasicNodeMaterial} The TSL material
 */
export function createSpectreMaterial() {
  const vUv = uv();
  const t = time;

  // ===== EFFECT LAYERS =====

  // Wispy ghost trails
  const wisps = createWisps(vUv, t);

  // Soul orbs
  const orbs = soulOrbs(vUv, t);

  // Base glow
  const glow = etherealGlow(vUv, t);

  // ===== COLOR PALETTE =====

  // Ghostly colors: pale blue -> purple -> white
  const paleBlue = vec3(0.7, 0.8, 0.95);
  const ghostPurple = vec3(0.6, 0.5, 0.85);
  const spectralWhite = vec3(0.95, 0.95, 1.0);
  const voidDark = vec3(0.1, 0.1, 0.2);

  // ===== COLOR MIXING =====

  // Base color from wisps
  let baseColor = mix(voidDark, paleBlue, wisps);
  baseColor = mix(baseColor, ghostPurple, wisps.mul(0.5).add(0.2));

  // Add orb highlights
  baseColor = mix(baseColor, spectralWhite, orbs.mul(0.8));

  // ===== FINAL COMPOSITE =====

  // Pulsating overall intensity
  const pulse = sin(t.mul(0.8)).mul(0.15).add(0.85);

  // Final color
  const finalColor = baseColor.mul(glow).mul(pulse);

  // Alpha: more transparent at edges, solid at center
  const alpha = glow.mul(wisps.add(0.3)).mul(0.9).add(orbs.mul(0.3));

  return new MeshBasicNodeMaterial({
    colorNode: vec4(finalColor, clamp(alpha, float(0), float(1))),
    transparent: true,
    depthWrite: false
  });
}

// ===========================================
// EXPORTS
// ===========================================

export default createSpectreMaterial;

/**
 * Shader metadata for tooling/documentation
 */
export const metadata = {
  name: 'Spectre',
  type: 'attack-effect',
  element: 'ghost',
  techniques: [
    'directional-noise',
    'wisp-trails',
    'soul-particles',
    'ethereal-glow'
  ],
  performance: {
    complexity: 'medium',
    fps60Target: true,
    noiseOctaves: 3,
    particleCount: 5
  }
};
