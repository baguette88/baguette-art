/**
 * ICE CRYSTAL SHADER - TSL (Three.js Shading Language)
 *
 * A procedural frost/ice effect for Crystowl's attack.
 * Features:
 *   - Voronoi-based ice crystal patterns
 *   - Animated frost expansion from center
 *   - Refraction-like color shifting
 *   - Sparkling highlights
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

export const iceUniforms = {
  uIntensity: uniform(1.0),
  uSpeed: uniform(1.0),
  uFrostColor: uniform(vec3(0.7, 0.9, 1.0)),     // Light ice blue
  uDeepColor: uniform(vec3(0.2, 0.4, 0.7)),       // Deep frozen blue
  uCrystalSize: uniform(8.0),                      // Voronoi cell size
  uFrostExpand: uniform(0.0),                      // Animation progress 0-1
};

// ============================================
// NOISE & PATTERN FUNCTIONS
// ============================================

/**
 * 2D Random for Voronoi seeds
 */
const random2 = (p) => {
  const k = vec2(127.1, 311.7);
  return fract(sin(dot(p, k)).mul(43758.5453).add(vec2(
    fract(sin(dot(p, vec2(269.5, 183.3))).mul(43758.5453)),
    fract(sin(dot(p, vec2(419.2, 371.9))).mul(43758.5453))
  )));
};

/**
 * Voronoi distance field
 * Creates crystalline cell patterns
 * Returns: vec3(distance to closest, distance to second closest, cell id)
 */
const voronoi = (p) => {
  const cellPos = floor(p);
  const localPos = fract(p);

  let minDist = float(8.0);
  let minDist2 = float(8.0);
  let closestCell = vec2(0.0);

  // Check 3x3 neighborhood
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const neighbor = vec2(float(i), float(j));
      const cellOffset = cellPos.add(neighbor);

      // Randomize point position within cell
      const randOffset = random2(cellOffset);
      const point = neighbor.add(randOffset).sub(localPos);
      const dist = length(point);

      // Track two closest distances (for edge detection)
      const isCloser = step(dist, minDist);
      minDist2 = mix(minDist2, min(minDist, dist), isCloser);
      minDist = min(minDist, dist);
      closestCell = mix(closestCell, cellOffset, vec2(isCloser));
    }
  }

  return vec3(minDist, minDist2, hash21(closestCell));
};

/**
 * Simple 2D hash
 */
const hash21 = (p) => {
  return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
};

// ============================================
// MAIN SHADER
// ============================================

/**
 * Creates the ice crystal fragment shader
 * @returns {Node} TSL color output node
 */
export const iceShader = () => {
  const { uIntensity, uSpeed, uFrostColor, uDeepColor, uCrystalSize, uFrostExpand } = iceUniforms;

  const pos = uv();
  const centeredUV = pos.sub(0.5);
  const dist = length(centeredUV);
  const t = time.mul(uSpeed);

  // ----------------------------------------
  // Layer 1: Voronoi crystal pattern
  // Creates the faceted ice look
  // ----------------------------------------
  const voronoiUV = pos.mul(uCrystalSize);
  const voronoiResult = voronoi(voronoiUV);
  const cellDist = voronoiResult.x;      // Distance to cell center
  const edgeDist = voronoiResult.y;      // Distance to edge
  const cellId = voronoiResult.z;        // Random per cell

  // Edge highlight - the crystalline facet borders
  const edgeWidth = float(0.05);
  const edge = smoothstep(edgeWidth, edgeWidth.mul(2.0), edgeDist.sub(cellDist));

  // ----------------------------------------
  // Layer 2: Frost expansion animation
  // Ice creeps outward from center
  // ----------------------------------------
  const expandProgress = uFrostExpand.add(sin(t).mul(0.1).add(0.5)); // Pulse slightly
  const frostMask = smoothstep(expandProgress.add(0.2), expandProgress.sub(0.1), dist);

  // Leading edge glow - bright frost line
  const frostEdge = smoothstep(0.02, 0.0, abs(dist.sub(expandProgress)));

  // ----------------------------------------
  // Layer 3: Color variation per crystal
  // Each facet has slightly different hue
  // ----------------------------------------
  const cellHueShift = cellId.mul(0.3).sub(0.15);
  const baseCrystalColor = mix(uDeepColor, uFrostColor, cellDist.add(cellHueShift));

  // ----------------------------------------
  // Layer 4: Internal refraction
  // Simulates light bending through ice
  // ----------------------------------------
  const refractionOffset = sin(cellDist.mul(10.0).add(t)).mul(0.1);
  const refractedColor = mix(
    baseCrystalColor,
    uFrostColor.mul(1.2), // Brighter highlight
    refractionOffset.add(0.5)
  );

  // ----------------------------------------
  // Layer 5: Sparkling highlights
  // Random bright spots that animate
  // ----------------------------------------
  const sparkleGrid = floor(pos.mul(50.0));
  const sparkleRand = hash21(sparkleGrid);
  const sparklePhase = t.mul(sparkleRand.mul(5.0).add(2.0));
  const sparkle = pow(sin(sparklePhase).mul(0.5).add(0.5), float(8.0));
  const sparkleVisible = step(0.92, sparkleRand).mul(sparkle).mul(frostMask);

  // ----------------------------------------
  // Layer 6: Rim frost effect
  // Icy outline around the effect
  // ----------------------------------------
  const rimStart = float(0.4);
  const rimEnd = float(0.6);
  const rimFrost = smoothstep(rimStart, rimEnd, dist).mul(
    smoothstep(rimEnd.add(0.1), rimEnd, dist)
  );
  const rimPattern = sin(centeredUV.y.atan2(centeredUV.x).mul(20.0).add(t)).mul(0.5).add(0.5);

  // ----------------------------------------
  // Final composition
  // ----------------------------------------

  // Combine crystal facet color with edge highlights
  const crystalColor = mix(refractedColor, vec3(1.0), edge.mul(0.5));

  // Add sparkles
  const withSparkles = crystalColor.add(vec3(sparkleVisible));

  // Add frost edge glow
  const withFrostEdge = mix(withSparkles, vec3(1.0, 1.0, 1.0), frostEdge.mul(0.8));

  // Add rim frost
  const finalColor = mix(withFrostEdge, uFrostColor, rimFrost.mul(rimPattern).mul(0.5));

  // Alpha: visible within frost mask with crystal variation
  const alpha = frostMask.mul(float(0.7).add(edge.mul(0.3))).mul(uIntensity);

  return vec4(finalColor, alpha);
};

// ============================================
// EXPORT FOR THREE.JS INTEGRATION
// ============================================

export default {
  name: 'IceCrystal',
  shader: iceShader,
  uniforms: iceUniforms,
  description: 'Voronoi-based ice crystals with animated frost expansion and sparkles'
};
