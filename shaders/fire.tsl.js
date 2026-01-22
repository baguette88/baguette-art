/**
 * FIRE BURST SHADER - TSL (Three.js Shading Language)
 *
 * A procedural flame effect for Inferno's attack.
 * Features:
 *   - Multi-layered noise for realistic fire turbulence
 *   - Temperature-based color gradient (red -> orange -> yellow -> white)
 *   - Heat distortion/shimmer effect
 *   - Ember particles rising from flames
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
  max
} from 'three/tsl';

// ============================================
// UNIFORMS
// ============================================

export const fireUniforms = {
  uIntensity: uniform(1.0),
  uSpeed: uniform(1.5),
  uCoreColor: uniform(vec3(1.0, 1.0, 0.9)),       // White-hot core
  uMidColor: uniform(vec3(1.0, 0.6, 0.1)),        // Orange flames
  uOuterColor: uniform(vec3(0.8, 0.2, 0.05)),     // Red outer
  uTurbulence: uniform(3.0),                       // Fire chaos amount
  uFlameHeight: uniform(1.5),                      // Vertical stretch
};

// ============================================
// NOISE FUNCTIONS
// ============================================

/**
 * Gradient noise (Perlin-style)
 * Smoother than value noise, better for fire
 */
const grad2 = (p) => {
  const h = fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  const angle = h.mul(6.28318);
  return vec2(cos(angle), sin(angle));
};

const gradientNoise = (p) => {
  const i = floor(p);
  const f = fract(p);

  // Quintic interpolation for smoothness
  const u = f.mul(f).mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));

  // Gradient dots at corners
  const g00 = dot(grad2(i), f);
  const g10 = dot(grad2(i.add(vec2(1.0, 0.0))), f.sub(vec2(1.0, 0.0)));
  const g01 = dot(grad2(i.add(vec2(0.0, 1.0))), f.sub(vec2(0.0, 1.0)));
  const g11 = dot(grad2(i.add(vec2(1.0, 1.0))), f.sub(vec2(1.0, 1.0)));

  return mix(mix(g00, g10, u.x), mix(g01, g11, u.x), u.y).mul(0.5).add(0.5);
};

/**
 * Turbulent FBM - absolute value creates sharp ridges like flames
 */
const turbulentFBM = (p, octaves = 5) => {
  let value = float(0.0);
  let amplitude = float(0.5);
  let frequency = float(1.0);
  let maxVal = float(0.0);

  for (let i = 0; i < octaves; i++) {
    // Abs creates the sharp "flame tongue" look
    value = value.add(abs(gradientNoise(p.mul(frequency)).mul(2.0).sub(1.0)).mul(amplitude));
    maxVal = maxVal.add(amplitude);
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
  }

  return value.div(maxVal);
};

/**
 * Simple hash for ember particles
 */
const hash21 = (p) => {
  return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
};

// ============================================
// MAIN SHADER
// ============================================

/**
 * Creates the fire burst fragment shader
 * @returns {Node} TSL color output node
 */
export const fireShader = () => {
  const { uIntensity, uSpeed, uCoreColor, uMidColor, uOuterColor, uTurbulence, uFlameHeight } = fireUniforms;

  const pos = uv();
  const t = time.mul(uSpeed);

  // Transform UV for flame shape
  // Center horizontally, flames rise from bottom
  const flameUV = vec2(
    pos.x.sub(0.5).mul(2.0),
    pos.y.mul(uFlameHeight)
  );

  // ----------------------------------------
  // Layer 1: Base flame shape
  // Parabolic falloff - narrow at top, wide at bottom
  // ----------------------------------------
  const baseWidth = float(1.0).sub(pos.y.mul(0.8)); // Narrower as we go up
  const horizontalFalloff = smoothstep(baseWidth, baseWidth.mul(0.3), abs(flameUV.x));

  // ----------------------------------------
  // Layer 2: Animated turbulence
  // Noise that moves upward to simulate rising heat
  // ----------------------------------------
  const noiseScale = uTurbulence;
  const noiseOffset = vec2(0.0, t.mul(-2.0)); // Moves upward

  // Primary turbulence layer
  const turbulence1 = turbulentFBM(
    flameUV.mul(noiseScale).add(noiseOffset),
    5
  );

  // Secondary layer with different scale for detail
  const turbulence2 = turbulentFBM(
    flameUV.mul(noiseScale.mul(2.0)).add(noiseOffset.mul(1.5)),
    4
  );

  // Combined turbulence
  const turbulence = turbulence1.mul(0.7).add(turbulence2.mul(0.3));

  // ----------------------------------------
  // Layer 3: Flame density
  // Combines shape with turbulence for final fire mask
  // ----------------------------------------
  const verticalFalloff = smoothstep(1.0, 0.0, pos.y); // Stronger at bottom
  const turbulentShape = turbulence.mul(horizontalFalloff).mul(verticalFalloff);

  // Add some flicker
  const flicker = sin(t.mul(15.0)).mul(0.1).add(sin(t.mul(23.0)).mul(0.05)).add(1.0);
  const flameDensity = turbulentShape.mul(flicker);

  // ----------------------------------------
  // Layer 4: Temperature-based coloring
  // Hotter (higher density) = brighter/whiter
  // ----------------------------------------
  const temperature = pow(flameDensity, float(0.8)); // Gamma for color response

  // Three-point color gradient
  const coldToMid = smoothstep(0.0, 0.4, temperature);
  const midToHot = smoothstep(0.4, 0.8, temperature);

  const color1 = mix(uOuterColor, uMidColor, coldToMid);
  const fireColor = mix(color1, uCoreColor, midToHot);

  // ----------------------------------------
  // Layer 5: Ember particles
  // Small bright dots rising with the heat
  // ----------------------------------------
  const emberGrid = vec2(pos.x.mul(15.0), pos.y.mul(30.0).sub(t.mul(8.0)));
  const emberCell = floor(emberGrid);
  const emberFract = fract(emberGrid);
  const emberRand = hash21(emberCell);

  // Ember position randomization
  const emberX = fract(emberFract.x.add(sin(emberRand.mul(100.0)).mul(0.3)));
  const emberY = fract(emberFract.y);
  const emberDist = length(vec2(emberX, emberY).sub(0.5));

  // Only some cells have embers
  const hasEmber = step(0.85, emberRand);

  // Ember size varies
  const emberSize = emberRand.mul(0.1).add(0.02);
  const ember = smoothstep(emberSize, float(0.0), emberDist).mul(hasEmber);

  // Embers fade as they rise
  const emberFade = float(1.0).sub(pos.y);
  const emberVisible = ember.mul(emberFade).mul(horizontalFalloff.mul(1.5));

  // Ember color (bright orange-yellow)
  const emberColor = vec3(1.0, 0.8, 0.3);

  // ----------------------------------------
  // Layer 6: Heat distortion indicator
  // Subtle wave at the edges (visual only, actual distortion in post)
  // ----------------------------------------
  const heatWave = sin(pos.y.mul(20.0).sub(t.mul(5.0))).mul(0.5).add(0.5);
  const heatEdge = smoothstep(0.3, 0.5, horizontalFalloff).mul(
    smoothstep(0.5, 0.3, horizontalFalloff)
  );
  const heatRim = heatEdge.mul(heatWave).mul(0.3);

  // ----------------------------------------
  // Final composition
  // ----------------------------------------
  const finalColor = fireColor.add(emberColor.mul(emberVisible)).add(vec3(heatRim));

  // Alpha based on flame density with soft edge
  const alpha = smoothstep(0.05, 0.3, flameDensity).mul(uIntensity);

  return vec4(clamp(finalColor, vec3(0.0), vec3(1.0)), alpha);
};

// ============================================
// EXPORT FOR THREE.JS INTEGRATION
// ============================================

export default {
  name: 'FireBurst',
  shader: fireShader,
  uniforms: fireUniforms,
  description: 'Turbulent fire effect with temperature-based coloring and ember particles'
};
