/**
 * GHOST SHADOW SHADER - TSL (Three.js Shading Language)
 *
 * An ethereal darkness effect for Specter's attack.
 * Features:
 *   - Wispy smoke-like tendrils
 *   - Pulsing void core with event horizon
 *   - Ghostly face silhouette emerging from darkness
 *   - Inverse light - darkness that "glows"
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
  min,
  max,
  atan2
} from 'three/tsl';

// ============================================
// UNIFORMS
// ============================================

export const ghostUniforms = {
  uIntensity: uniform(1.0),
  uSpeed: uniform(0.8),
  uVoidColor: uniform(vec3(0.02, 0.0, 0.05)),     // Near-black purple
  uGhostColor: uniform(vec3(0.4, 0.3, 0.6)),      // Spectral purple
  uEyeGlow: uniform(vec3(0.9, 0.1, 0.3)),         // Menacing red eyes
  uTendrilCount: uniform(8.0),                     // Number of shadow tendrils
};

// ============================================
// NOISE FUNCTIONS
// ============================================

/**
 * Simplex-like 2D noise
 */
const hash = (p) => {
  return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
};

const smoothNoise = (p) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

  const a = hash(i);
  const b = hash(i.add(vec2(1.0, 0.0)));
  const c = hash(i.add(vec2(0.0, 1.0)));
  const d = hash(i.add(vec2(1.0, 1.0)));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
};

/**
 * Layered noise for wispy smoke effect
 */
const smokeNoise = (p, t, octaves = 4) => {
  let value = float(0.0);
  let amplitude = float(0.5);
  let frequency = float(1.0);

  for (let i = 0; i < octaves; i++) {
    // Rotate each octave for more organic look
    const angle = float(i).mul(0.5);
    const rotatedP = vec2(
      p.x.mul(cos(angle)).sub(p.y.mul(sin(angle))),
      p.x.mul(sin(angle)).add(p.y.mul(cos(angle)))
    );

    value = value.add(
      smoothNoise(rotatedP.mul(frequency).add(t.mul(0.3).mul(float(i).add(1.0)))).mul(amplitude)
    );
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
  }

  return value;
};

// ============================================
// MAIN SHADER
// ============================================

/**
 * Creates the ghost shadow fragment shader
 * @returns {Node} TSL color output node
 */
export const ghostShader = () => {
  const { uIntensity, uSpeed, uVoidColor, uGhostColor, uEyeGlow, uTendrilCount } = ghostUniforms;

  const pos = uv();
  const centeredUV = pos.sub(0.5);
  const dist = length(centeredUV);
  const angle = atan2(centeredUV.y, centeredUV.x);
  const t = time.mul(uSpeed);

  // ----------------------------------------
  // Layer 1: Central void
  // A pulsing dark core that absorbs light
  // ----------------------------------------
  const voidPulse = sin(t.mul(2.0)).mul(0.1).add(0.9);
  const voidRadius = float(0.15).mul(voidPulse);
  const voidCore = smoothstep(voidRadius, voidRadius.mul(0.3), dist);

  // Event horizon - bright ring around the void
  const horizonWidth = float(0.02);
  const eventHorizon = smoothstep(horizonWidth, float(0.0), abs(dist.sub(voidRadius)));

  // ----------------------------------------
  // Layer 2: Shadow tendrils
  // Wispy darkness reaching outward
  // ----------------------------------------
  const tendrilAngle = angle.mul(uTendrilCount);
  const tendrilWave = sin(tendrilAngle.add(t.mul(2.0)));

  // Tendrils pulse and writhe
  const tendrilLength = float(0.3).add(tendrilWave.mul(0.1)).add(sin(t.mul(3.0).add(angle)).mul(0.05));
  const tendrilDist = smoothstep(tendrilLength.add(0.1), tendrilLength, dist);

  // Add noise to tendrils for organic look
  const tendrilNoise = smokeNoise(centeredUV.mul(5.0), t, 4);
  const noisyTendrils = tendrilDist.mul(tendrilNoise.add(0.5));

  // ----------------------------------------
  // Layer 3: Smoke wisps
  // Ambient darkness floating around
  // ----------------------------------------
  const smokeScale = float(3.0);
  const smoke1 = smokeNoise(centeredUV.mul(smokeScale), t, 5);
  const smoke2 = smokeNoise(centeredUV.mul(smokeScale.mul(1.5)).add(vec2(100.0, 0.0)), t.mul(1.3), 4);
  const combinedSmoke = smoke1.mul(0.6).add(smoke2.mul(0.4));

  // Smoke fades with distance
  const smokeMask = smoothstep(0.6, 0.2, dist);
  const smokeLayer = combinedSmoke.mul(smokeMask);

  // ----------------------------------------
  // Layer 4: Ghostly face silhouette
  // Subtle face emerging from the darkness
  // ----------------------------------------
  // Eye positions (relative to center)
  const leftEyePos = vec2(-0.08, 0.02);
  const rightEyePos = vec2(0.08, 0.02);
  const eyeSize = float(0.025);

  const leftEyeDist = length(centeredUV.sub(leftEyePos));
  const rightEyeDist = length(centeredUV.sub(rightEyePos));

  // Eyes pulse menacingly
  const eyePulse = sin(t.mul(4.0)).mul(0.3).add(0.7);
  const leftEye = smoothstep(eyeSize, eyeSize.mul(0.3), leftEyeDist).mul(eyePulse);
  const rightEye = smoothstep(eyeSize, eyeSize.mul(0.3), rightEyeDist).mul(eyePulse);
  const eyes = max(leftEye, rightEye);

  // Mouth - a dark grin
  const mouthY = float(-0.08);
  const mouthWidth = float(0.12);
  const mouthHeight = float(0.02);
  const mouthDist = vec2(abs(centeredUV.x), centeredUV.y.sub(mouthY));
  const mouthCurve = mouthDist.y.add(pow(mouthDist.x, float(2.0)).mul(2.0)); // Curved smile
  const mouth = smoothstep(mouthHeight, float(0.0), mouthCurve).mul(
    step(mouthDist.x, mouthWidth)
  );

  // Face only visible near center
  const faceMask = smoothstep(0.25, 0.1, dist);

  // ----------------------------------------
  // Layer 5: Inverse glow
  // Darkness that paradoxically "illuminates"
  // ----------------------------------------
  const inverseGlow = pow(float(1.0).sub(dist), float(3.0));
  const glowPulse = sin(t.mul(1.5)).mul(0.2).add(0.8);
  const darkGlow = inverseGlow.mul(glowPulse);

  // ----------------------------------------
  // Final composition
  // ----------------------------------------

  // Base darkness layer
  const darkness = voidCore.mul(smokeLayer.add(noisyTendrils));

  // Color gradient from deep void to ghostly purple
  const baseColor = mix(uVoidColor, uGhostColor, darkness.mul(0.5).add(darkGlow.mul(0.3)));

  // Add event horizon (white-purple ring)
  const horizonColor = mix(uGhostColor, vec3(1.0), float(0.5));
  const withHorizon = mix(baseColor, horizonColor, eventHorizon.mul(0.8));

  // Add glowing eyes
  const withEyes = mix(withHorizon, uEyeGlow, eyes.mul(faceMask));

  // Darken mouth area
  const finalColor = mix(withEyes, uVoidColor, mouth.mul(faceMask).mul(0.8));

  // Alpha: combines all elements
  const alpha = max(
    max(voidCore, smokeLayer.mul(0.7)),
    max(noisyTendrils.mul(0.5), eventHorizon)
  ).mul(uIntensity);

  return vec4(finalColor, alpha);
};

// ============================================
// EXPORT FOR THREE.JS INTEGRATION
// ============================================

export default {
  name: 'GhostShadow',
  shader: ghostShader,
  uniforms: ghostUniforms,
  description: 'Ethereal darkness with void core, tendrils, and ghostly face silhouette'
};
