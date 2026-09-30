// Petits outils autour de Three.js : cibles de rendu, passes plein écran.
import * as THREE from 'three';
import { NOISE, COLOR } from './glsl.js';

export let renderer, W, H, ASPECT;
const quadGeo = new THREE.BufferGeometry();
quadGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function initGL(canvas, w, h) {
  W = w; H = h; ASPECT = w / h;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  return renderer;
}

export function rt(w = W, h = H, opts = {}) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: opts.type ?? THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: opts.filter ?? THREE.LinearFilter,
    magFilter: opts.filter ?? THREE.LinearFilter,
    depthBuffer: !!opts.depth,
    wrapS: opts.wrap ?? THREE.ClampToEdgeWrapping,
    wrapT: opts.wrap ?? THREE.ClampToEdgeWrapping,
    generateMipmaps: false,
  });
}

// Passe plein écran : pass(frag, uniforms) → { u, render(target, {blend}) }
export function pass(frag, uniforms = {}, { blending = THREE.NoBlending, transparent = false, depth = false } = {}) {
  const u = { uRes: { value: new THREE.Vector2(W, H) }, ...uniforms };
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: `out vec2 vUv; void main(){ vUv = position.xy*.5+.5; gl_Position = vec4(position.xy,0.,1.); }`,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 fragColor; uniform vec2 uRes;\n${NOISE}\n${COLOR}\n${frag}`,
    depthTest: depth, depthWrite: false, blending, transparent,
  });
  const mesh = new THREE.Mesh(quadGeo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return {
    u, mat,
    render(target = null, clear = true) {
      renderer.setRenderTarget(target);
      if (clear) { renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); }
      renderer.render(scene, orthoCam);
    },
  };
}

export function clearRT(target, r = 0, g = 0, b = 0, a = 0) {
  renderer.setRenderTarget(target);
  renderer.setClearColor(new THREE.Color(r, g, b), a);
  renderer.clear(true, true, false);
}

export const additive = { blending: THREE.AdditiveBlending, transparent: true };
export const over = { blending: THREE.NormalBlending, transparent: true };
export const premult = { blending: THREE.CustomBlending, transparent: true };
export { THREE };
