/**
 * CRT POST-PROCESSING SHADER - TSL (Three.js Shading Language)
 *
 * A retro CRT monitor effect for the Game Boy aesthetic.
 * Features:
 *   - RGB subpixel simulation
 *   - Scanlines with variable intensity
 *   - Screen curvature distortion
 *   - Chromatic aberration at edges
 *   - Vignette darkening
 *   - Static noise and flicker
 *   - Phosphor glow persistence
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
  clamp,
  pow,
  step,
  mod,
  texture
} from 'three/tsl';

// ============================================
// UNIFORMS
// ============================================

export const crtUniforms = {
  uIntensity: uniform(1.0),           // Master effect strength
  uScanlineIntensity: uniform(0.3),   // Scanline darkness
  uScanlineCount: uniform(240.0),     // Number of scanlines
  uCurvature: uniform(0.03),          // Screen bend amount
  uVignette: uniform(0.4),            // Edge darkening
  uChromaShift: uniform(0.002),       // RGB separation amount
  uNoiseAmount: uniform(0.05),        // Static noise strength
  uFlickerSpeed: uniform(0.0),        // Screen flicker (0 = off)
  uBrightness: uniform(1.0),          // Overall brightness
  uContrast: uniform(1.1),            // Contrast boost
  uSaturation: uniform(1.0),          // Color saturation
  uRGBOffset: uniform(vec3(1.0, 1.0, 1.0)), // Per-channel multiplier
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Random hash for noise
 */
const hash12 = (p) => {
  const p3 = fract(p.mul(vec2(5.3983, 5.4427)));
  const p4 = p3.add(dot(p3.yx, p3.xy.add(21.5351)));
  return fract(p4.x.mul(p4.y));
};

/**
 * Screen curvature distortion
 * Bends UVs like a curved CRT screen
 */
const curveUV = (uv, curvature) => {
  const centered = uv.mul(2.0).sub(1.0);
  const offset = centered.yx.div(curvature);
  const curved = centered.add(centered.mul(offset.mul(offset)));
  return curved.mul(0.5).add(0.5);
};

/**
 * Check if UV is outside [0,1] bounds
 */
const isOutOfBounds = (uv) => {
  return step(1.0, max(
    max(step(uv.x, 0.0), step(1.0, uv.x)),
    max(step(uv.y, 0.0), step(1.0, uv.y))
  ));
};

// ============================================
// MAIN SHADER (for custom material use)
// ============================================

/**
 * Creates the CRT post-processing fragment shader
 * Note: This needs a texture sampler in practice
 * @returns {Function} Shader function that takes texture sample function
 */
export const crtShader = (sampleTexture) => {
  const {
    uIntensity, uScanlineIntensity, uScanlineCount, uCurvature,
    uVignette, uChromaShift, uNoiseAmount, uFlickerSpeed,
    uBrightness, uContrast, uSaturation, uRGBOffset
  } = crtUniforms;

  const pos = uv();
  const t = time;

  // ----------------------------------------
  // Layer 1: Screen curvature
  // Distort UVs to simulate curved glass
  // ----------------------------------------
  const curvedUV = curveUV(pos, float(1.0).div(uCurvature.add(0.0001)));

  // Black outside screen bounds
  const outOfBounds = isOutOfBounds(curvedUV);

  // ----------------------------------------
  // Layer 2: Chromatic aberration
  // Separate RGB channels slightly at edges
  // ----------------------------------------
  const distFromCenter = length(curvedUV.sub(0.5));
  const chromaAmount = uChromaShift.mul(distFromCenter);

  // Sample each color channel at slightly offset positions
  const uvR = curvedUV.add(vec2(chromaAmount, 0.0));
  const uvG = curvedUV;
  const uvB = curvedUV.sub(vec2(chromaAmount, 0.0));

  // Get color samples (in real use, these would sample a texture)
  const colorR = sampleTexture(uvR).r;
  const colorG = sampleTexture(uvG).g;
  const colorB = sampleTexture(uvB).b;

  let color = vec3(colorR, colorG, colorB);

  // ----------------------------------------
  // Layer 3: RGB subpixel simulation
  // Each pixel has RGB stripes like real CRT
  // ----------------------------------------
  const subpixelX = mod(curvedUV.x.mul(uScanlineCount.mul(3.0)), float(3.0));
  const subpixelMask = vec3(
    smoothstep(0.0, 0.5, subpixelX).mul(smoothstep(1.5, 1.0, subpixelX)),
    smoothstep(1.0, 1.5, subpixelX).mul(smoothstep(2.5, 2.0, subpixelX)),
    smoothstep(2.0, 2.5, subpixelX).mul(step(subpixelX, 3.0).add(smoothstep(0.5, 0.0, subpixelX)))
  );

  // Subtle subpixel effect (not too strong)
  color = mix(color, color.mul(subpixelMask.add(0.5)), float(0.3));

  // ----------------------------------------
  // Layer 4: Scanlines
  // Horizontal dark bands
  // ----------------------------------------
  const scanlineY = curvedUV.y.mul(uScanlineCount);
  const scanline = sin(scanlineY.mul(3.14159)).mul(0.5).add(0.5);
  const scanlineMask = float(1.0).sub(scanline.mul(uScanlineIntensity));

  color = color.mul(scanlineMask);

  // ----------------------------------------
  // Layer 5: Vignette
  // Darken edges of screen
  // ----------------------------------------
  const vignetteDist = length(curvedUV.sub(0.5)).mul(1.4);
  const vignetteMask = smoothstep(0.5, 0.2, vignetteDist.mul(uVignette));
  color = color.mul(vignetteMask);

  // ----------------------------------------
  // Layer 6: Static noise
  // Random flickering dots
  // ----------------------------------------
  const noiseCoord = curvedUV.mul(vec2(uScanlineCount, uScanlineCount.mul(0.5)));
  const noise = hash12(noiseCoord.add(t.mul(100.0)));
  color = color.add(noise.sub(0.5).mul(uNoiseAmount));

  // ----------------------------------------
  // Layer 7: Screen flicker
  // Whole screen brightness variation
  // ----------------------------------------
  const flicker = sin(t.mul(uFlickerSpeed.mul(60.0))).mul(0.02).add(1.0);
  color = color.mul(mix(float(1.0), flicker, step(0.01, uFlickerSpeed)));

  // ----------------------------------------
  // Layer 8: Color adjustments
  // Brightness, contrast, saturation
  // ----------------------------------------

  // Brightness
  color = color.mul(uBrightness);

  // Contrast
  color = color.sub(0.5).mul(uContrast).add(0.5);

  // Saturation
  const luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, uSaturation);

  // Per-channel adjustment
  color = color.mul(uRGBOffset);

  // ----------------------------------------
  // Layer 9: Phosphor glow
  // Bloom around bright areas
  // ----------------------------------------
  const brightness = dot(color, vec3(0.333));
  const glow = pow(brightness, float(2.0)).mul(0.1);
  color = color.add(glow);

  // ----------------------------------------
  // Final composition
  // ----------------------------------------

  // Clamp colors
  color = clamp(color, vec3(0.0), vec3(1.0));

  // Black outside screen
  color = mix(color, vec3(0.0), outOfBounds);

  // Mix with original based on intensity
  const finalColor = mix(sampleTexture(pos).rgb, color, uIntensity);

  return vec4(finalColor, float(1.0));
};

// ============================================
// STANDALONE DEMO VERSION
// (Works without texture, shows effect pattern)
// ============================================

export const crtDemoShader = () => {
  const pos = uv();
  const t = time;

  // Demo pattern - colored gradient
  const demoColor = vec3(
    pos.x,
    pos.y,
    sin(t).mul(0.5).add(0.5)
  );

  // Apply CRT effects to demo pattern
  const { uScanlineIntensity, uScanlineCount, uVignette, uNoiseAmount } = crtUniforms;

  // Scanlines
  const scanlineY = pos.y.mul(uScanlineCount);
  const scanline = sin(scanlineY.mul(3.14159)).mul(0.5).add(0.5);
  const scanlineMask = float(1.0).sub(scanline.mul(uScanlineIntensity));

  // Vignette
  const vignetteDist = length(pos.sub(0.5)).mul(1.4);
  const vignetteMask = smoothstep(0.5, 0.2, vignetteDist.mul(uVignette));

  // Noise
  const noiseCoord = pos.mul(vec2(uScanlineCount, uScanlineCount.mul(0.5)));
  const noise = fract(sin(dot(noiseCoord.add(t.mul(100.0)), vec2(12.9898, 78.233))).mul(43758.5453));

  let color = demoColor;
  color = color.mul(scanlineMask);
  color = color.mul(vignetteMask);
  color = color.add(noise.sub(0.5).mul(uNoiseAmount));

  return vec4(clamp(color, vec3(0.0), vec3(1.0)), float(1.0));
};

// ============================================
// EXPORT FOR THREE.JS INTEGRATION
// ============================================

export default {
  name: 'CRTPostProcess',
  shader: crtShader,
  demoShader: crtDemoShader,
  uniforms: crtUniforms,
  description: 'Retro CRT monitor effect with scanlines, curvature, and chromatic aberration'
};
