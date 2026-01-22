/**
 * SLIME SLUDGE SHADER - TSL (Three.js Shading Language)
 *
 * A gooey, viscous liquid effect for Slime's attack.
 * Features:
 *   - Metaball-like blob merging
 *   - Surface tension simulation
 *   - Bubbles popping at surface
 *   - Dripping/stretching animation
 *   - Toxic green with iridescent sheen
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
  max
} from 'three/tsl';

// ============================================
// UNIFORMS
// ============================================

export const slimeUniforms = {
  uIntensity: uniform(1.0),
  uSpeed: uniform(1.0),
  uSlimeColor: uniform(vec3(0.2, 0.7, 0.3)),      // Toxic green
  uHighlightColor: uniform(vec3(0.5, 0.9, 0.4)),  // Bright green highlight
  uDarkColor: uniform(vec3(0.1, 0.3, 0.1)),       // Dark green depth
  uBlobCount: uniform(5.0),                        // Number of metaballs
  uViscosity: uniform(0.7),                        // How gooey (affects merge threshold)
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Hash for randomization
 */
const hash = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const hash2 = (p) => vec2(hash(p), hash(p.add(vec2(37.0, 17.0))));

/**
 * Metaball field function
 * Returns distance field contribution from a single blob
 */
const metaball = (p, center, radius) => {
  const d = length(p.sub(center));
  // Inverse square falloff for smooth blending
  return radius.mul(radius).div(d.mul(d).add(0.001));
};

/**
 * Smooth minimum for metaball blending
 * Creates the "gooey" merging effect
 */
const smin = (a, b, k) => {
  const h = clamp(float(0.5).add(float(0.5).mul(b.sub(a)).div(k)), float(0.0), float(1.0));
  return mix(b, a, h).sub(k.mul(h).mul(float(1.0).sub(h)));
};

// ============================================
// MAIN SHADER
// ============================================

/**
 * Creates the slime sludge fragment shader
 * @returns {Node} TSL color output node
 */
export const slimeShader = () => {
  const { uIntensity, uSpeed, uSlimeColor, uHighlightColor, uDarkColor, uBlobCount, uViscosity } = slimeUniforms;

  const pos = uv();
  const centeredUV = pos.sub(0.5);
  const t = time.mul(uSpeed);

  // ----------------------------------------
  // Layer 1: Metaball field
  // Multiple blobs that merge together
  // ----------------------------------------

  // Generate animated blob positions
  let totalField = float(0.0);

  // Central blob (largest, anchors the slime)
  const centerBlob = metaball(centeredUV, vec2(0.0, 0.0), float(0.15));
  totalField = totalField.add(centerBlob);

  // Orbiting blobs
  for (let i = 0; i < 5; i++) {
    const idx = float(i);
    const orbitSpeed = float(0.5).add(idx.mul(0.1));
    const orbitRadius = float(0.15).add(idx.mul(0.03));
    const phase = idx.mul(1.2566); // 2*PI/5 offset

    const blobX = cos(t.mul(orbitSpeed).add(phase)).mul(orbitRadius);
    const blobY = sin(t.mul(orbitSpeed.mul(1.3)).add(phase)).mul(orbitRadius.mul(0.8));
    const blobSize = float(0.08).add(sin(t.add(idx)).mul(0.02));

    const blob = metaball(centeredUV, vec2(blobX, blobY), blobSize);
    totalField = totalField.add(blob);
  }

  // Dripping blobs (moving downward)
  for (let i = 0; i < 3; i++) {
    const idx = float(i);
    const dripX = sin(idx.mul(2.1)).mul(0.1);
    const dripPhase = fract(t.mul(0.3).add(idx.mul(0.33)));
    const dripY = float(0.0).sub(dripPhase.mul(0.4));

    // Blobs stretch as they drip
    const stretch = float(1.0).add(dripPhase.mul(0.5));
    const dripSize = float(0.05).mul(float(1.0).sub(dripPhase.mul(0.5)));

    const dripBlob = metaball(
      vec2(centeredUV.x, centeredUV.y.mul(stretch)),
      vec2(dripX, dripY),
      dripSize
    );
    totalField = totalField.add(dripBlob.mul(float(1.0).sub(dripPhase)));
  }

  // ----------------------------------------
  // Layer 2: Slime surface threshold
  // Convert field to sharp surface with soft edge
  // ----------------------------------------
  const threshold = uViscosity;
  const surface = smoothstep(threshold.sub(0.2), threshold.add(0.1), totalField);
  const surfaceEdge = smoothstep(threshold.sub(0.05), threshold.add(0.05), totalField).mul(
    smoothstep(threshold.add(0.15), threshold, totalField)
  );

  // ----------------------------------------
  // Layer 3: Surface normals (fake)
  // For specular highlights
  // ----------------------------------------
  const eps = float(0.01);
  const fieldGradX = metaball(centeredUV.add(vec2(eps, 0.0)), vec2(0.0), float(0.15))
    .sub(metaball(centeredUV.sub(vec2(eps, 0.0)), vec2(0.0), float(0.15)));
  const fieldGradY = metaball(centeredUV.add(vec2(0.0, eps)), vec2(0.0), float(0.15))
    .sub(metaball(centeredUV.sub(vec2(0.0, eps)), vec2(0.0), float(0.15)));

  // Fake normal from gradient
  const normalStrength = length(vec2(fieldGradX, fieldGradY));

  // ----------------------------------------
  // Layer 4: Depth and color
  // Darker in the center (deeper), lighter at edges
  // ----------------------------------------
  const depth = totalField.mul(0.3);
  const baseColor = mix(uSlimeColor, uDarkColor, depth);

  // ----------------------------------------
  // Layer 5: Specular highlight
  // Shiny goo reflection
  // ----------------------------------------
  const lightDir = normalize(vec2(0.5, 0.7));
  const specAngle = dot(normalize(vec2(fieldGradX, fieldGradY)), lightDir);
  const specular = pow(max(specAngle, float(0.0)), float(16.0));

  // Rim lighting effect
  const rimLight = surfaceEdge.mul(0.5);

  const highlightedColor = mix(baseColor, uHighlightColor, specular.mul(0.6).add(rimLight));

  // ----------------------------------------
  // Layer 6: Bubbles
  // Small bubbles that rise and pop
  // ----------------------------------------
  const bubbleGrid = pos.mul(30.0);
  const bubbleCell = floor(bubbleGrid);
  const bubbleFract = fract(bubbleGrid);
  const bubbleRand = hash(bubbleCell);

  // Bubble rises over time
  const bubblePhase = fract(t.mul(bubbleRand.mul(0.3).add(0.1)).add(bubbleRand));
  const bubbleY = fract(bubbleFract.y.add(bubblePhase));

  // Bubble position
  const bubblePos = vec2(bubbleFract.x, bubbleY);
  const bubbleDist = length(bubblePos.sub(0.5));

  // Bubble size decreases as it rises (about to pop)
  const bubbleSize = float(0.1).mul(float(1.0).sub(bubblePhase.mul(0.7)));
  const bubble = smoothstep(bubbleSize, bubbleSize.mul(0.5), bubbleDist);

  // Only show bubbles within slime and some cells
  const hasBubble = step(0.7, bubbleRand);
  const bubbleVisible = bubble.mul(surface).mul(hasBubble).mul(float(1.0).sub(bubblePhase));

  // Bubble highlight (shiny)
  const bubbleHighlight = smoothstep(bubbleSize.mul(0.7), bubbleSize.mul(0.3), bubbleDist)
    .mul(smoothstep(bubbleSize.mul(0.3), bubbleSize.mul(0.5), bubbleDist));

  // ----------------------------------------
  // Layer 7: Iridescent sheen
  // Rainbow-ish oil slick effect at glancing angles
  // ----------------------------------------
  const iridescenceAngle = surfaceEdge.mul(sin(t.mul(2.0).add(pos.y.mul(10.0))));
  const iridescence = vec3(
    sin(iridescenceAngle.mul(3.0)).mul(0.5).add(0.5),
    sin(iridescenceAngle.mul(3.0).add(2.094)).mul(0.5).add(0.5),
    sin(iridescenceAngle.mul(3.0).add(4.189)).mul(0.5).add(0.5)
  ).mul(0.15);

  // ----------------------------------------
  // Final composition
  // ----------------------------------------
  const withBubbles = mix(highlightedColor, uHighlightColor, bubbleHighlight.mul(bubbleVisible));
  const withIridescence = withBubbles.add(iridescence.mul(surfaceEdge));
  const finalColor = withIridescence;

  // Alpha: slime surface with soft edge
  const alpha = surface.mul(uIntensity);

  return vec4(finalColor, alpha);
};

// ============================================
// EXPORT FOR THREE.JS INTEGRATION
// ============================================

export default {
  name: 'SlimeSludge',
  shader: slimeShader,
  uniforms: slimeUniforms,
  description: 'Gooey metaball slime with bubbles, drips, and iridescent sheen'
};
