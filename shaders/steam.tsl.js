/**
 * STEAM SHADER - TSL (Three.js Shading Language)
 *
 * A volumetric steam/smoke effect for rising vapor.
 * Features:
 *   - FBM noise for organic turbulent movement
 *   - Life-based fade (particles fade as they rise)
 *   - Wispy edge distortion
 *   - Warm white/gray color variation
 *   - Soft circular falloff with noise-distorted edges
 *
 * Used for: Coffee steam, hot beverages, atmospheric effects
 *
 * @author baguette.art
 */

// ===========================================
// GLSL IMPLEMENTATION
// ===========================================

export const steamShader = {
  vertexShader: `
    varying vec2 vUv;
    varying float vHeight;
    uniform float uTime;

    void main() {
      vUv = uv;
      vHeight = position.y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uLife;
    varying vec2 vUv;

    // ===========================================
    // NOISE FUNCTIONS
    // ===========================================

    // Hash function for procedural randomness
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    // Value noise
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      // Smooth interpolation
      vec2 u = f * f * (3.0 - 2.0 * f);

      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    // Fractal Brownian Motion - layered noise
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;

      // 4 octaves of noise
      for (int i = 0; i < 4; i++) {
        value += noise(p) * amplitude;
        p *= 2.0;           // Double frequency
        amplitude *= 0.5;   // Halve amplitude
      }

      return value;
    }

    // ===========================================
    // MAIN SHADER
    // ===========================================

    void main() {
      vec2 uv = vUv - 0.5;
      float dist = length(uv);

      // Wispy turbulent shape using FBM
      float turbulence = fbm(uv * 4.0 + uTime * 0.5);
      float wisp = fbm(uv * 3.0 - vec2(0.0, uTime * 0.8));

      // Soft circular falloff with noise-distorted edge
      // The turbulence adds organic wispy edges
      float edge = smoothstep(0.5, 0.1 + turbulence * 0.15, dist);

      // Vary density across the steam particle
      float density = edge * (0.6 + wisp * 0.4);

      // Color: warm white to light gray
      // Varies based on wisp noise for subtle color variation
      vec3 steamColor = mix(
        vec3(0.95, 0.95, 0.98),  // Warm white
        vec3(0.85, 0.88, 0.92),  // Light cool gray
        wisp
      );

      // Life-based fade
      // uLife goes from 0 (just spawned) to 1 (fully risen)
      // Steam fades out as it rises and dissipates
      float lifeFade = smoothstep(1.0, 0.0, uLife);

      // Final alpha combines all factors
      float alpha = density * uOpacity * lifeFade * 0.5;

      gl_FragColor = vec4(steamColor, alpha);
    }
  `,

  // Default uniforms
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0.7 },
    uLife: { value: 0 }
  }
};

// ===========================================
// USAGE EXAMPLE
// ===========================================

/*
// Create steam particle
const steamGeo = new THREE.PlaneGeometry(0.15, 0.25);
const steamMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0.7 },
    uLife: { value: 0 }
  },
  vertexShader: steamShader.vertexShader,
  fragmentShader: steamShader.fragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false
});

const steam = new THREE.Mesh(steamGeo, steamMat);
scene.add(steam);

// In animation loop:
steam.material.uniforms.uTime.value = elapsedTime;
steam.material.uniforms.uLife.value = particleLife; // 0-1
steam.lookAt(camera.position); // Billboard effect
*/

export default steamShader;
