/**
 * SHADER MANAGER - TSL Battle Effects Integration
 *
 * Manages WebGPU/WebGL shader rendering for battle attack effects.
 * Each attack type has a corresponding TSL shader that renders
 * to a canvas overlay during combat.
 *
 * @author baguette.art
 */

import * as THREE from 'three';
import {
  uniform,
  uv,
  time,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  cos,
  mix,
  smoothstep,
  length,
  normalize,
  dot,
  fract,
  floor,
  abs,
  pow,
  min,
  max,
  clamp,
  step
} from 'three/tsl';

// Import our custom shaders
import { createToxicMaterial, TOXIC_SHADER_INFO } from './toxic.tsl.js';
import { createIceMaterial, ICE_SHADER_INFO } from './ice.tsl.js';
import { createFireMaterial, FIRE_SHADER_INFO } from './fire.tsl.js';

/**
 * ShaderManager - Handles all TSL shader effects for the battle system
 */
export class ShaderManager {
  constructor(container) {
    this.container = container;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = new THREE.Clock();
    this.activeEffect = null;
    this.materials = {};
    this.isInitialized = false;
    this.animationId = null;

    // Shader registry
    this.shaderRegistry = {
      toxic: { create: createToxicMaterial, info: TOXIC_SHADER_INFO },
      ice: { create: createIceMaterial, info: ICE_SHADER_INFO },
      fire: { create: createFireMaterial, info: FIRE_SHADER_INFO }
    };
  }

  /**
   * Initialize the Three.js renderer with WebGPU fallback to WebGL
   */
  async init() {
    if (this.isInitialized) return;

    // Create canvas for shader effects
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'shader-overlay';
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      z-index: 100;
      mix-blend-mode: screen;
    `;
    this.container.appendChild(this.canvas);

    // Get container dimensions
    const rect = this.container.getBoundingClientRect();
    const width = rect.width || 160;
    const height = rect.height || 144;

    // Try WebGPU first, fallback to WebGL
    try {
      const { WebGPURenderer } = await import('three/addons/renderers/webgpu/WebGPURenderer.js');
      this.renderer = new WebGPURenderer({
        canvas: this.canvas,
        antialias: false, // Pixel art aesthetic
        alpha: true
      });
      this.renderer.setPixelRatio(1); // Keep it crispy
      console.log('[ShaderManager] WebGPU renderer initialized');
    } catch (e) {
      // Fallback to WebGL
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: false,
        alpha: true
      });
      this.renderer.setPixelRatio(1);
      console.log('[ShaderManager] WebGL renderer initialized (fallback)');
    }

    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);

    // Orthographic camera for 2D effects
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    // Scene with fullscreen quad
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      null
    );
    this.scene.add(this.quad);

    // Pre-create all shader materials
    await this.preloadMaterials();

    this.isInitialized = true;
    console.log('[ShaderManager] Initialization complete');
  }

  /**
   * Preload all shader materials for instant switching
   */
  async preloadMaterials() {
    for (const [name, shader] of Object.entries(this.shaderRegistry)) {
      try {
        this.materials[name] = shader.create();
        console.log(`[ShaderManager] Loaded ${name} shader`);
      } catch (e) {
        console.warn(`[ShaderManager] Failed to load ${name} shader:`, e);
      }
    }
  }

  /**
   * Play a shader effect
   * @param {string} effectName - Name of the effect (toxic, ice, fire)
   * @param {number} duration - Duration in milliseconds
   * @param {object} options - Additional options (intensity, color overrides, etc.)
   */
  async play(effectName, duration = 1500, options = {}) {
    if (!this.isInitialized) {
      await this.init();
    }

    const material = this.materials[effectName];
    if (!material) {
      console.warn(`[ShaderManager] Unknown effect: ${effectName}`);
      return;
    }

    // Stop any running effect
    this.stop();

    // Set material and show canvas
    this.quad.material = material;
    this.activeEffect = effectName;
    this.canvas.style.opacity = '1';

    // Reset uniforms
    if (material.uniforms) {
      if (material.uniforms.uTime) material.uniforms.uTime.value = 0;
      if (material.uniforms.uIntensity) {
        material.uniforms.uIntensity.value = options.intensity || 1.0;
      }
      if (material.uniforms.uProgress) material.uniforms.uProgress.value = 0;
    }

    // Start render loop
    this.clock.start();
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Update time uniform
      if (material.uniforms) {
        if (material.uniforms.uTime) {
          material.uniforms.uTime.value = elapsed / 1000;
        }
        if (material.uniforms.uProgress) {
          material.uniforms.uProgress.value = progress;
        }
      }

      this.renderer.render(this.scene, this.camera);

      if (progress < 1.0) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.stop();
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Stop the current effect
   */
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.activeEffect = null;
    if (this.canvas) {
      this.canvas.style.opacity = '0';
    }
  }

  /**
   * Get shader info for gallery/documentation
   */
  getShaderInfo(name) {
    const shader = this.shaderRegistry[name];
    return shader ? shader.info : null;
  }

  /**
   * Get all available shader names
   */
  getAvailableShaders() {
    return Object.keys(this.shaderRegistry);
  }

  /**
   * Resize the renderer
   */
  resize(width, height) {
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop();

    for (const material of Object.values(this.materials)) {
      material.dispose();
    }

    if (this.quad) {
      this.quad.geometry.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.isInitialized = false;
  }
}

// Export singleton for easy access
let shaderManagerInstance = null;

export function getShaderManager(container) {
  if (!shaderManagerInstance && container) {
    shaderManagerInstance = new ShaderManager(container);
  }
  return shaderManagerInstance;
}

export default ShaderManager;
