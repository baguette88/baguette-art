/**
 * TOXIC SPORE SHADER - TSL (Three.js Shading Language)
 *
 * A procedural poison cloud effect for Moldspore's attack.
 * Features:
 *   - Animated toxic swirl using layered noise
 *   - Color gradient from purple to sickly green
 *   - Pulsating glow with time-based intensity
 *   - Particle-like spore dots floating in the cloud
 *
 * @author baguette.art
 * @license MIT
 */

import {
  uniform,
  uv,
  time,
  sin,
  cos,
  mix,
  smoothstep,
  vec2,
  vec3,
  vec4,
  float,
  abs,
  fract,
  floor,
  dot,
  length,
  normalize,
  clamp,
  pow,
  step,
  mod
} from 'three/tsl';

// ============================================
// UNIFORMS
// ============================================

export const toxicUniforms = {
  uIntensity: uniform(1.0),      // Overall effect strength
  uSpeed: uniform(1.0),          // Animation speed multiplier
  uPoisonColor: uniform(vec3(0.67, 0.4, 0.8)),   // Primary purple #aa66cc
  uToxicColor: uniform(vec3(0.4, 0.8, 0.3)),     // Secondary green
  uGlowStrength: uniform(0.5),   // Glow intensity
};

// ============================================
// NOISE FUNCTIONS
// ============================================

/**
 * 2D Hash function for pseudo-random values
 * Based on: https://www.shadertoy.com/view/4djSRW
 */
const hash21 = (p) => {
  const p3 = fract(p.mul(vec2(443.897, 441.423)));
  return fract(dot(p3, p3.add(19.19)).mul(p3.x.add(p3.y)));
};

/**
 * Value noise with smooth interpolation
 */
const valueNoise = (p) => {
  const i = floor(p);
  const f = fract(p);

  // Cubic interpolation for smoothness
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

  // Sample corners
  const a = hash21(i);
  const b = hash21(i.add(vec2(1.0, 0.0)));
  const c = hash21(i.add(vec2(0.0, 1.0)));
  const d = hash21(i.add(vec2(1.0, 1.0)));

  // Bilinear interpolation
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
};

/**
 * Fractal Brownian Motion - layered noise for organic look
 * @param {vec2} p - Position
 * @param {float} octaves - Number of noise layers
 */
const fbm = (p, octaves = 4) => {
  let value = float(0.0);
  let amplitude = float(0.5);
  let frequency = float(1.0);

  for (let i = 0; i < octaves; i++) {
    value = value.add(valueNoise(p.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
  }

  return value;
};

// ============================================
// MAIN SHADER
// ============================================

/**
 * Creates the toxic cloud fragment shader
 * @returns {Node} TSL color output node
 */
export const toxicShader = () => {
  const { uIntensity, uSpeed, uPoisonColor, uToxicColor, uGlowStrength } = toxicUniforms;

  // Get UV coordinates centered at (0.5, 0.5)
  const centeredUV = uv().sub(0.5);
  const dist = length(centeredUV);
  const angle = centeredUV.y.atan2(centeredUV.x);

  // Animated time
  const t = time.mul(uSpeed);

  // ----------------------------------------
  // Layer 1: Base swirl
  // Create spiral distortion using polar coordinates
  // ----------------------------------------
  const swirlAmount = float(3.0);
  const swirlUV = vec2(
    centeredUV.x.mul(cos(dist.mul(swirlAmount).add(t))).sub(centeredUV.y.mul(sin(dist.mul(swirlAmount).add(t)))),
    centeredUV.x.mul(sin(dist.mul(swirlAmount).add(t))).add(centeredUV.y.mul(cos(dist.mul(swirlAmount).add(t))))
  );

  // ----------------------------------------
  // Layer 2: Noise-based cloud density
  // Multiple octaves for organic turbulence
  // ----------------------------------------
  const noiseScale = float(4.0);
  const noiseOffset = vec2(t.mul(0.3), t.mul(0.2));
  const cloudNoise = fbm(swirlUV.mul(noiseScale).add(noiseOffset), 5);

  // ----------------------------------------
  // Layer 3: Radial falloff
  // Soft circular mask with noise distortion
  // ----------------------------------------
  const distortedDist = dist.add(cloudNoise.mul(0.1));
  const falloff = smoothstep(0.6, 0.1, distortedDist);

  // ----------------------------------------
  // Layer 4: Color mixing
  // Blend between poison purple and toxic green
  // ----------------------------------------
  const colorMix = cloudNoise.mul(sin(t.mul(2.0)).mul(0.5).add(0.5));
  const baseColor = mix(uPoisonColor, uToxicColor, colorMix);

  // ----------------------------------------
  // Layer 5: Pulsating glow
  // Adds ethereal outer glow
  // ----------------------------------------
  const pulse = sin(t.mul(3.0)).mul(0.5).add(0.5);
  const glow = pow(float(1.0).sub(dist), float(2.0)).mul(uGlowStrength).mul(pulse);
  const glowColor = baseColor.add(glow);

  // ----------------------------------------
  // Layer 6: Spore particles
  // Floating dots within the cloud
  // ----------------------------------------
  const sporeGrid = uv().mul(20.0);
  const sporeCell = floor(sporeGrid);
  const sporeFract = fract(sporeGrid);
  const sporeRand = hash21(sporeCell);

  // Animate spores floating upward
  const sporeY = fract(sporeFract.y.add(t.mul(sporeRand.mul(0.5).add(0.2))));
  const sporeDist = length(sporeFract.sub(vec2(0.5, sporeY)));
  const sporeSize = sporeRand.mul(0.1).add(0.05);
  const spore = smoothstep(sporeSize, sporeSize.mul(0.5), sporeDist);

  // Only show spores within the cloud
  const sporeVisible = spore.mul(falloff).mul(step(0.3, sporeRand));
  const sporeColor = vec3(1.0, 0.9, 1.0); // Bright white-pink

  // ----------------------------------------
  // Final composition
  // ----------------------------------------
  const finalColor = mix(glowColor, sporeColor, sporeVisible);
  const alpha = falloff.mul(cloudNoise.mul(0.5).add(0.5)).mul(uIntensity);

  return vec4(finalColor, alpha);
};

// ============================================
// EXPORT FOR THREE.JS INTEGRATION
// ============================================

export default {
  name: 'ToxicSpore',
  shader: toxicShader,
  uniforms: toxicUniforms,
  description: 'Procedural poison cloud with animated swirl and floating spores'
};
