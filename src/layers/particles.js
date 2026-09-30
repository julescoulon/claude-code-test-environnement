// Particules analytiques : explosion, turbulence, toile cosmique, gel sur la grille.
// La position de chaque particule est une fonction pure de t (aucune simulation à rejouer).
import { THREE, W, H } from '../gl.js';
import { NOISE, COLOR } from '../glsl.js';
import { rng, gauss } from '../rng.js';

export const N = 40000;
const LAGS = 6;
const NL = 14000; // seules ces particules portent une traînée (lisibilité)
export const TAU_GLSL = /* glsl */`
// temps local de l'explosion (ralenti « bullet time » puis pleine vitesse), identique à tauOf() en JS
float tauOf(float s){
  if(s<=0.) return 0.;
  float a=.12;
  if(s<.3) return a*s;
  float x=min((s-.3)/.5,1.);
  float v=a*s + .88*.5*(x*x*x - x*x*x*x*.5);
  if(s>.8) v += .88*(s-.8);
  return v;
}`;
export function tauOf(s) {
  if (s <= 0) return 0;
  const a = 0.12;
  if (s < 0.3) return a * s;
  const x = Math.min((s - 0.3) / 0.5, 1);
  let v = a * s + 0.88 * 0.5 * (x ** 3 - x ** 4 * 0.5);
  if (s > 0.8) v += 0.88 * (s - 0.8);
  return v;
}

// Toile cosmique : nœuds + filaments, sur laquelle la matière se condense.
function cosmicWeb(r) {
  const nodes = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * 2.35;
    nodes.push([Math.cos(a) * d * 1.05, Math.sin(a) * d * 0.62, (r() - 0.5) * 1.4]);
  }
  nodes.push([0, 0, 0]); // le cœur est un nœud
  const edges = [];
  nodes.forEach((p, i) => {
    const near = nodes.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2])
      .filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3);
    near.forEach(([j]) => { if (i < j || !edges.some(e => e[0] === j && e[1] === i)) edges.push([i, j]); });
  });
  return { nodes, edges };
}

export function createParticles() {
  const r = rng(11);
  const web = cosmicWeb(rng(12));
  const seg = NL * LAGS * 2;
  const aSeed = new Float32Array(seg * 4), aDir = new Float32Array(seg * 4), aWeb = new Float32Array(seg * 3), aLag = new Float32Array(seg);
  const pSeed = new Float32Array(N * 4), pDir = new Float32Array(N * 4), pWeb = new Float32Array(N * 3), pLag = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const circle = i < 3000 ? 1 : 0; // nées du cercle au crayon
    let dx, dy, dz, theta = r() * Math.PI * 2;
    if (circle) { dx = Math.cos(theta); dy = Math.sin(theta); dz = (r() - 0.5) * 0.15; }
    else { dz = r() * 2 - 1; const q = Math.sqrt(1 - dz * dz); dx = Math.cos(theta) * q; dy = Math.sin(theta) * q; dz *= 0.55; }
    const sp = Math.exp(gauss(r) * 0.45) * (circle ? 0.9 : 0.75);
    // cible sur la toile : filament (70 %) ou nœud (30 %)
    let w;
    if (r() < 0.7) {
      const e = web.edges[Math.floor(r() * web.edges.length)];
      const A = web.nodes[e[0]], Bn = web.nodes[e[1]], u = r();
      const sc = 0.012 + 0.03 * r() * r();
      w = [A[0] + (Bn[0] - A[0]) * u + gauss(r) * sc, A[1] + (Bn[1] - A[1]) * u + gauss(r) * sc, A[2] + (Bn[2] - A[2]) * u + gauss(r) * sc];
    } else {
      const nd = web.nodes[Math.floor(r() * web.nodes.length)];
      const sc = 0.03 + 0.07 * r() * r();
      w = [nd[0] + gauss(r) * sc, nd[1] + gauss(r) * sc, nd[2] + gauss(r) * sc];
    }
    const s4 = [r(), r(), r(), circle];
    const d4 = [dx, dy, dz, sp];
    pSeed.set(s4, i * 4); pDir.set(d4, i * 4); pWeb.set(w, i * 3);
    if (i < NL) for (let j = 0; j < LAGS; j++) for (let e = 0; e < 2; e++) {
      const v = (i * LAGS + j) * 2 + e;
      aSeed.set(s4, v * 4); aDir.set(d4, v * 4); aWeb.set(w, v * 3); aLag[v] = j + e;
    }
  }
  const mk = (s, d, w, l) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(l.length * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s, 4));
    g.setAttribute('aDir', new THREE.BufferAttribute(d, 4));
    g.setAttribute('aWeb', new THREE.BufferAttribute(w, 3));
    g.setAttribute('aLag', new THREE.BufferAttribute(l, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
  };
  const uniforms = {
    uT: { value: 0 }, uBang: { value: 0 }, uCircleR: { value: 0.46 },
    uCondense: { value: new THREE.Vector2(6, 9.4) },
    uCool: { value: new THREE.Vector3(9.7, 11.8, 2.2) }, // début, fin, rayon max du front
    uCell: { value: 12 }, uRes: { value: new THREE.Vector2(W, H) },
    uLagDt: { value: 0.03 }, uBright: { value: 1 }, uKick: { value: 0 },
    uAspect: { value: W / H }, uShow: { value: 0 }, uLineI: { value: 1 },
  };
  const vs = (isLine) => /* glsl */`
    ${NOISE}
    ${COLOR}
    ${TAU_GLSL}
    in vec4 aSeed; in vec4 aDir; in vec3 aWeb; in float aLag;
    uniform float uT, uBang, uCircleR, uCell, uLagDt, uAspect, uKick, uShow, uLineI;
    uniform vec2 uCondense, uRes; uniform vec3 uCool;
    out vec3 vCol; out float vA;
    vec3 posAt(float t){
      float tau=tauOf(t-uBang);
      vec3 d=aDir.xyz; float sp=aDir.w;
      vec3 p0 = aSeed.w>.5 ? vec3(d.xy*uCircleR, 0.) : vec3(0.);
      float rE = sp*2.4*(1.-exp(-tau*1.25));
      vec3 p = p0 + d*rE;
      // tourbillon autour de l'axe de vue
      float ph=(aSeed.x-.5)*.5+.3; float ang=ph*log(1.+tau*2.);
      float c=cos(ang), s=sin(ang); p.xy=mat2(c,-s,s,c)*p.xy;
      // turbulence
      p += snoise3(p*1.1+aSeed.xyz*7.+vec3(0.,0.,tau*.22))*.2*smoothstep(.8,3.,tau);
      p += d*uKick*(.2+sp*.4);
      // condensation sur la toile cosmique, en arc (gravité)
      float k=smoothstep(uCondense.x,uCondense.y,t + aSeed.y*.8);
      vec3 w = aWeb + snoise3(aWeb*2.+vec3(t*.15))*.03;
      vec3 perp = normalize(cross(w-p+vec3(1e-4), vec3(0.,0.,1.)));
      p = mix(p, w, k) + perp*sin(3.14159*k)*.18*(aSeed.z-.3);
      return p;
    }
    void main(){
      // gel : le front de refroidissement passe à la distance écran de la particule
      float lag = ${isLine ? 'aLag' : '0.'};
      vec3 p = posAt(uT);
      vec4 clip = projectionMatrix*viewMatrix*vec4(p,1.);
      vec2 ndc = clip.xy/clip.w;
      float dist = length(vec2(ndc.x*uAspect, ndc.y));
      float pf = 1.-sqrt(clamp(dist/uCool.z,0.,1.));
      float tFreeze = mix(uCool.x, uCool.y, pf);
      float teff = uT;
      // ralentissement avant le gel (le temps s'épaissit)
      float over = uT - (tFreeze-.6);
      if(over>0.) teff = (tFreeze-.6) + .6*(1.-exp(-over/.6));
      float frozen = smoothstep(tFreeze-.35, tFreeze+.05, uT);
      float lagDt = uLagDt*(1.-frozen);
      float tl = teff - lag*lagDt*(1.+aSeed.z);
      p = posAt(tl);
      clip = projectionMatrix*viewMatrix*vec4(p,1.);
      // accroche sur la grille de pixels
      vec2 sp2 = (clip.xy/clip.w*.5+.5)*uRes;
      vec2 cell = (floor(sp2/uCell)+.5)*uCell;
      sp2 = mix(sp2, cell, smoothstep(.2,1.,frozen));
      clip.xy = ((sp2/uRes)*2.-1.)*clip.w;
      gl_Position = clip;
      float tau = tauOf(teff-uBang);
      float hot = exp(-tau*.55);
      float temp = clamp(1.-hot + aSeed.x*.25 - .1, 0., 1.);
      vCol = heat(temp*.85 + .05);
      vCol = mix(vCol, vec3(1.,.25,.6), smoothstep(6.5,9.5,uT)*.45);
      float head = 1.-lag/${LAGS}.;
      vA = uShow * (${isLine ? 'head*head*.3*uLineI' : '.8'}) * (.3+.55*hot) * (1.+1.2*smoothstep(7.,9.2,uT)) * (.6+.8*aSeed.y);
      vA *= mix(1., 1.6, frozen);
      float spread = length(posAt(teff).xy);
      vA *= mix(.04, 1., smoothstep(0.,.9,spread));
      ${isLine ? '' : 'gl_PointSize = (1.4+3.*hot+ frozen*uCell*.35)*uRes.y/1080.;'}
      if(uT<uBang) vA=0.;
    }`;
  const fs = (isLine) => /* glsl */`
    precision highp float; in vec3 vCol; in float vA; out vec4 o;
    void main(){
      ${isLine ? 'float m=1.;' : 'vec2 q=gl_PointCoord*2.-1.; float m=smoothstep(1.,.2,dot(q,q));'}
      o = vec4(vCol*vA*m, 1.);
    }`;
  const mat = (isLine) => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms, vertexShader: vs(isLine), fragmentShader: fs(isLine),
    blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
  });
  const lines = new THREE.LineSegments(mk(aSeed, aDir, aWeb, aLag), mat(true));
  const pts = new THREE.Points(mk(pSeed, pDir, pWeb, pLag), mat(false));
  lines.frustumCulled = pts.frustumCulled = false;
  const group = new THREE.Group(); group.add(lines, pts);
  return { group, uniforms, web };
}
