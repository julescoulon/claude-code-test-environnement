// Graine 0 — moteur de rendu. window.renderFrame(t) ne dépend que de t.
import { initGL, rt, pass, additive, renderer, W, H, THREE, clearRT } from './gl.js';
import { initPost, clearAccum, addToAccum, finish, paperTexture } from './post.js';
import { beatAt, beatTime, pulse, hit, T } from './tempo.js';
import { clamp, remap, smooth, easeOut, easeIn, easeInOut, bell, win, lerp, expoOut, spring } from './anim.js';
import { noise1 } from './rng.js';
import { initVector, renderVector, circleR } from './layers/vector.js';
import { createParticles, tauOf } from './layers/particles.js';
import { createCore, createNebula } from './layers/core.js';
import { createMatter } from './layers/matter.js';
import { createStructures } from './layers/structures.js';
import { createComplexity, STYLE } from './layers/complexity.js';

// les polices doivent être chargées avant de dessiner l'atlas de glyphes
await Promise.all(['700 64px JB', '400 64px JB', '700 64px Caveat'].map((f) => document.fonts.load(f, '0A∅')));

const params = new URLSearchParams(location.search);
const w = +(params.get('w') || 1920), h = +(params.get('h') || 1080);
const MODE = params.get('mode') || 'film';
const ROOTD = params.get('root') || 'render'; // 'feed' : l'univers vu de l'intérieur de la bille
const canvas = document.getElementById('c');
canvas.width = w; canvas.height = h;
initGL(canvas, w, h);
initPost();

const S = { sceneRT: rt(W, H, { depth: true }), worldRT: rt(W, H, { depth: true }), seedRT: rt(W, H, { depth: true }) };
const vecTex = initVector();
const particles = createParticles();
const core = createCore();
const nebula = createNebula();
const matter = createMatter();
const structures = createStructures(matter.atlas);
S.img3RT = rt(W, H); S.img3Frozen = rt(W, H);
S.dataFrozen = rt(160, 90, { filter: THREE.NearestFilter, type: THREE.FloatType });
const pCopy = pass(`uniform sampler2D uTex; void main(){ fragColor=texture(uTex,vUv); }`, { uTex: { value: null } });
let frozenReady = false;
const complexity = createComplexity(matter.atlas);
S.s4RT = rt(W, H); S.s5RT = rt(W, H);
// Portail : la faille lumineuse découpe l'écran et laisse voir le monde fractal.
const pPortal = pass(/* glsl */`
  uniform sampler2D uA, uB; uniform vec2 uC; uniform float uR, uAng, uT;
  void main(){
    float asp=uRes.x/uRes.y;
    vec2 q=(vUv*2.-1.)*vec2(asp,1.)-uC*vec2(asp,1.);
    float c=cos(-uAng), s=sin(-uAng); q=mat2(c,-s,s,c)*q;
    // fente en amande le long de la faille : elle s'ouvre comme une paupière
    float L=.08+uR*1.6;
    float x=q.x/L;
    float hgt=uR*.55*max(1.-x*x,0.);
    float jag=.012*snoise(vec3(q.x*30.,uT*.7,1.))+.006*snoise(vec3(q.x*90.,2.,uT));
    float d=abs(q.y+jag)-hgt;
    float m=smoothstep(.004,-.004,d);
    vec3 a=texture(uA,vUv).rgb, b=texture(uB,vUv).rgb;
    vec3 col=mix(a,b,m);
    float rim=exp(-pow(d/.012,2.))*step(-1.,1.-x*x)*(1.-smoothstep(1.2,2.4,uR));
    col+=vec3(3.,2.3,1.4)*rim*step(.001,uR);
    fragColor=vec4(col,1.);
  }`, { uA: { value: null }, uB: { value: null }, uC: { value: new THREE.Vector2() }, uR: { value: 0 }, uAng: { value: 0 }, uT: { value: 0 } });
const STYLES_AT = [[61, STYLE.CEL], [62, STYLE.GLYPH], [63, STYLE.PIXEL], [64, STYLE.PARTICLE], [65, STYLE.PENCIL], [66, STYLE.FRACTAL]];
function fracCam(t) {
  // arrivée par la faille, orbite, puis vue de dessus (l'iris)
  const a0 = new THREE.Vector3(0.55, -0.62, 0.56).normalize();
  const dist = lerp(5.6, 4.7, easeOut(remap(t, T.dive + 0.8, T.fractal + 0.6), 2.2)) - 0.3 * easeInOut(remap(t, T.fractal + 0.6, beatTime(66)), 2);
  const orbit = 0.9 * easeInOut(remap(t, T.fractal, beatTime(66)), 1.6);
  let pos = a0.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), orbit).multiplyScalar(dist);
  const top = easeInOut(remap(t, beatTime(66), beatTime(69) - 0.1), 2.4);
  const topPos = new THREE.Vector3(0, 0, 3.1 - 0.35 * easeInOut(remap(t, beatTime(69), T.pullback), 2));
  pos = pos.lerp(topPos, top);
  const roll = Math.max(0, t - T.pullback) * 0.12; // l'œil de chat tourne lentement dans la bille
  const up = new THREE.Vector3(0, 0, 1).lerp(new THREE.Vector3(-Math.sin(roll), Math.cos(roll), 0), top).normalize();
  return { pos, up, fov: 40, target: new THREE.Vector3(0, 0, 0) };
}
const pVector = pass(`uniform sampler2D uTex; uniform float uI; void main(){ vec4 c=texture(uTex,vUv); fragColor=vec4(c.rgb*c.a*uI,1.); }`,
  { uTex: { value: vecTex }, uI: { value: 1 } }, additive);

const D = 1 / Math.tan((35 / 2) * Math.PI / 180);
const cam = new THREE.PerspectiveCamera(35, W / H, 0.01, 200);
const pScene = new THREE.Scene(); pScene.add(particles.group);

// --------------------------------------------------------------------------
// Direction : tous les paramètres du film en fonction de t.
// --------------------------------------------------------------------------
function motionK(t) {
  if (t < T.bang - 0.08) return 1;
  if (t < T.bang + 1.4) return 8;
  if (t < 7.2) return 5;
  if (t < T.cool) return 3;
  if (t > T.dive + 0.5 && t < T.fractal) return 3;
  if (t > T.planets && t < T.planetsDone) return 3;
  return 1;
}

function camAt(t) {
  const tb = t - T.bang;
  let z = D, x = 0, y = 0;
  if (tb > 0) {
    z = D - 0.42 * easeInOut(remap(t, T.bang + 0.3, 8.8), 2.4);
    const drift = 1 - smooth(remap(t, 8.0, 9.3)); // la caméra se pose avant le refroidissement
    x = (noise1(t * 0.35, 3) - 0.5) * 0.16 * drift;
    y = (noise1(t * 0.3, 4) - 0.5) * 0.1 * drift;
    const shake = Math.exp(-tb / 0.35) * 0.05 + (hit(t, 9, 0.2) + hit(t, 13, 0.2)) * 0.012;
    x += (noise1(t * 40, 5) - 0.5) * shake; y += (noise1(t * 40, 6) - 0.5) * shake;
  }
  return { x, y, z };
}

// Monde des phases 1–3 : nébuleuse + particules + caméra
function setWorld(t) {
  const tb = t - T.bang, tau = tauOf(tb);
  nebula.u.uT.value = t;
  nebula.u.uR.value = tb > 0 ? 3.2 * (1 - Math.exp(-tau * 0.7)) : 0;
  nebula.u.uI.value = tb > 0 ? 0.26 * smooth(remap(tau, 0.1, 1.2)) * (1 - 0.6 * smooth(remap(t, 7, 10))) : 0;
  const u = particles.uniforms;
  u.uT.value = t; u.uBang.value = T.bang; u.uCircleR.value = circleR(T.bang - 0.01);
  u.uCondense.value.set(5.6, 9.2);
  u.uCool.value.set(T.cool, T.frozen, 2.25);
  u.uCell.value = H / 90;
  u.uLagDt.value = 0.045 * (1 + 2.5 * Math.exp(-Math.max(tau, 0) * 1.2));
  u.uKick.value = 0.18 * (smooth(remap(t, beatTime(9), beatTime(9) + 0.5)) + smooth(remap(t, beatTime(13), beatTime(13) + 0.5)));
  u.uShow.value = tb > 0 ? 1 : 0;
  u.uLineI.value = 1 - 0.85 * smooth(remap(t, 5.2, 7.6));
  const c = camAt(t);
  cam.position.set(c.x, c.y, c.z); cam.lookAt(c.x * 0.3, c.y * 0.3, 0); cam.updateMatrixWorld();
  nebula.u.uCam.value.set(c.x, c.y);
}

function direct(t) {
  const P = {
    corePos: new THREE.Vector2(0, 0), shocks: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    ca: 0.0015, bloomTh: 0.7, bloom: 0.7, streak: 0.25, streakTint: new THREE.Vector3(0.55, 0.6, 1),
    exposure: 1, vignette: 0.4, grain: 0.025, sat: 1, lift: new THREE.Vector3(0.0015, 0, 0.005), gain: new THREE.Vector3(1, 1, 1),
    paperI: 0, paperTex: null,
  };
  const tb = t - T.bang, tau = tauOf(tb);
  // --- le cœur, personnage ---
  const breathe = pulse(t, 5) * (t < T.bang ? 1 : 0.4);
  const blink = bell(t, T.anticip - 0.02, T.anticip + 0.2);           // il cligne
  const inhale = smooth(remap(t, T.anticip + 0.15, T.bang));           // il inspire toute l'énergie
  let size = 0.06 * (1 + 0.25 * breathe) * (1 - 0.55 * inhale) * (1 + 0.15 * smooth(remap(t, 0, 1.5)));
  let I = (0.6 + 0.9 * smooth(remap(t, 0, 1.2))) * (1 + 3.5 * inhale * inhale) * (1 + 0.35 * breathe);
  const coreCol = new THREE.Vector3(0.75, 0.62, 1);
  if (tb > 0) {
    size = 0.05 + 0.05 * Math.exp(-tb * 2) + 0.012 * pulse(t, 5);
    I = 1.8 + 6 * Math.exp(-tb * 3);
    coreCol.set(1, 0.72, 0.45);
  }
  core.u.uSize.value = size; core.u.uI.value = I; core.u.uBlink.value = blink;
  core.u.uCol.value.copy(coreCol);
  core.u.uFlash.value = tb > 0 ? 9 * Math.exp(-tb / 0.035) : 0;
  core.u.uT.value = t; core.u.uFoam.value = smooth(remap(t, 0.2, 1.2)) * (1 - smooth(remap(t, T.anticip, T.anticip + 0.3)));
  // --- ondes de choc ---
  if (tb > 0) {
    P.shocks[0].set(0.02 + 3.4 * (1 - Math.exp(-tau * 1.1)), 2.2 * Math.exp(-tau * 0.9), 0.05 + 0.25 * tau);
    for (const [k, n] of [[1, 9], [2, 13]]) {
      const d = t - beatTime(n);
      if (d > 0) P.shocks[k].set(0.15 + 3.2 * easeOut(d * 0.7, 2.2), 0.55 * Math.exp(-d * 1.4) * smooth(d / 0.08), 0.03 + 0.08 * d);
    }
  }
  core.u.uShock.value.forEach((v, i) => v.copy(P.shocks[i]));
  P.ca = 0.0015 + (tb > 0 ? 0.02 * Math.exp(-tau * 1.5) : 0) + 0.004 * (hit(t, 9, 0.3) + hit(t, 13, 0.3));
  // --- étalonnage ---
  if (tb > 0) {
    P.lift.set(0.01, 0.0, 0.006); P.gain.set(1.02, 0.97, 0.95);
    P.streakTint.set(1, 0.55, 0.35); P.streak = 0.35 + 0.8 * Math.exp(-tb * 1.5);
    P.exposure = 1 - 0.7 * Math.exp(-Math.max(tb - 0.04, 0) / 0.6); // adaptation de l'œil après le flash
    P.bloomTh = 1.0;
  }
  // --- phase 3 : matière ---
  const cool = smooth(remap(t, T.cool, T.frozen));
  if (t > T.cool) {
    P.lift.set(0.0, 0.004, 0.01); P.gain.set(lerp(1.02, 0.95, cool), lerp(0.97, 1.02, cool), lerp(0.95, 1.05, cool));
    P.streakTint.set(lerp(1, 0.4, cool), lerp(0.55, 0.9, cool), lerp(0.35, 1, cool));
    P.streak = 0.3; P.bloom = 0.55; P.bloomTh = 0.9;
    core.u.uCol.value.set(lerp(1, 0.55, cool), lerp(0.72, 0.95, cool), lerp(0.45, 1, cool));
    core.u.uI.value = 1.6 + 0.8 * pulse(t, 5);
    core.u.uSize.value = 0.045 + 0.01 * pulse(t, 5);
  }
  P.rdI = smooth(remap(t, T.chem, T.chem + 1.2));
  P.cycle = smooth(remap(t, T.frozen + 0.2, T.frozen + 1.2));
  P.glyphMix = t > T.glyph - 0.1 ? 1 : 0;
  P.bgDim = 0.75 * smooth(remap(t, T.glyph + 0.8, T.glyphDone));
  P.rings = smooth(remap(t, T.glyphDone - 0.3, T.glyphDone + 0.9));
  const zt = t - T.zero;
  P.zero = zt < 0 ? 0 : Math.max(0, spring(zt * 1.4, 2.2, 5) - smooth(remap(t, T.zero + 0.7, T.tilt - 0.15)));
  P.ringRot = t * 0.035;
  P.heat = 1;
  // --- phase 4 : structures ---
  const g4 = smooth(remap(t, T.tilt + 1.2, T.wireFlat + 0.5));
  P.bgTop = new THREE.Vector3(lerp(0.001, 0.02, g4), lerp(0.002, 0.055, g4), lerp(0.006, 0.035, g4));
  P.bgBot = new THREE.Vector3(lerp(0.001, 0.002, g4), lerp(0.002, 0.008, g4), lerp(0.006, 0.006, g4));
  P.stars = smooth(remap(t, T.tilt + 1, T.tilt + 3));
  P.coreLight = 1.6 + 0.6 * pulse(t, 5);
  P.key = smooth(remap(t, T.planets, T.planetsDone));
  P.crack = smooth(remap(t, T.life, T.dive)) * 0.45;
  P.coreSize = 0.045 + 0.01 * pulse(t, 5);
  P.coreI = 1.6 + 0.8 * pulse(t, 5);
  P.coreCol = new THREE.Vector3(lerp(0.55, 0.85, g4), lerp(0.95, 1.0, g4), lerp(1, 0.6, g4));
  P.ink = t > T.cel - 0.2 ? 1 : 0;
  if (t > T.dive) P.streak = 0.12;
  P.inkFront = 0.2 + 2.6 * easeOut(remap(t, T.cel - 0.1, T.cel + 0.9), 2);
  P.inkWidth = 1.6;
  P.boil = Math.floor(t * 12) * 0.37;
  // --- phase 5 : complexité ---
  const stop = t >= T.fractal;
  P.tq = stop ? Math.floor(t * 12 + 1e-6) / 12 : t;
  P.fcam = fracCam(P.tq);
  P.style = STYLE.FRACTAL; P.pop = 0;
  for (const [n, st] of STYLES_AT) if (P.tq >= beatTime(n) - 1e-6) { P.style = st; P.pop = Math.exp(-(P.tq - beatTime(n)) * 7); }
  P.power = 8 + 0.7 * Math.sin(P.tq * 0.9);
  P.fCoreI = 2.4 + 0.8 * pulse(t, 4);
  P.glyphI = 0.7 * smooth(remap(t, T.fractal + 0.3, T.fractal + 1.5));
  P.phys = smooth(remap(t, T.fractal, T.fractal + 2.2)) * (1 - 0.6 * smooth(remap(t, T.contract - 0.3, T.pullback)));
  P.physT0 = T.fractal - 0.8;
  P.attrDraw = easeInOut(remap(t, T.fractal + 0.4, beatTime(66)), 1.6);
  P.attrI = smooth(remap(t, T.fractal + 0.3, T.fractal + 0.8)) * (1 - smooth(remap(t, beatTime(68), beatTime(70))));
  P.spores = smooth(remap(t, T.fractal + 0.6, T.fractal + 1.6));
  P.iris = smooth(remap(t, beatTime(67), beatTime(69)));
  P.contract = easeInOut(remap(t, T.contract, T.pullback), 2);
  P.fInk = 1; P.bgI = 1 - 0.7 * P.contract;
  if (t > T.pullback) {
    // dans la bille : l'univers continue de vivre, la pupille se détend, le papier disparaît
    P.contract = 1 - 0.4 * smooth(remap(t, T.pullback + 0.4, 41));
    P.iris = 1; P.attrI = 0; P.bgI = 0.3;
  }
  P.coreOff = 1.4;
  P.beat = beatAt(P.tq);
  P.rift = smooth(remap(t, T.dive - 0.2, T.dive + 1.0));
  if (t > T.tilt) {
    P.lift.set(lerp(0, 0.004, g4), lerp(0.004, 0.012, g4), lerp(0.01, 0.006, g4));
    P.gain.set(lerp(0.95, 1.0, g4), lerp(1.02, 1.04, g4), lerp(1.05, 0.9, g4));
    P.streakTint.set(lerp(0.4, 0.8, g4), lerp(0.9, 1.0, g4), lerp(1, 0.5, g4));
    P.ca = 0.0009;
  }
  if (t > T.fractal - 0.3) {
    const g5 = smooth(remap(t, T.fractal - 0.3, T.fractal + 0.5));
    P.lift.set(lerp(0.004, 0.012, g5), lerp(0.012, 0.0, g5), lerp(0.006, 0.012, g5));
    P.gain.set(lerp(1, 1.04, g5), lerp(1.04, 0.95, g5), lerp(0.9, 0.98, g5));
    P.streakTint.set(1, 0.6, 0.8);
  }
  if (stop) {
    // faux stop-motion : 12 i/s, tremblement de la caméra « posée à la main », papier
    const k = Math.floor(t * 12 + 1e-6);
    P.jit = new THREE.Vector3((noise1(k * 1.7, 81) - 0.5) * 0.004, (noise1(k * 1.3, 82) - 0.5) * 0.004, (noise1(k * 0.9, 83) - 0.5) * 0.004);
    P.paperI = 0.4 * smooth(remap(t, T.fractal, T.fractal + 0.25)) * (1 - smooth(remap(t, T.pullback, T.pullback + 0.5)));
    P.vignette = 0.4 + 0.8 * smooth(remap(t, T.contract - 0.2, T.pullback));
    if (t > T.pullback) P.jit.multiplyScalar(1 - smooth(remap(t, T.pullback, T.pullback + 0.5)));
    P.paperTex = paperTexture();
    P.grain = 0.035;
  }
  return P;
}

function renderWorld(t, target) {
  setWorld(t);
  clearRT(target);
  nebula.render(target, false);
  renderer.setRenderTarget(target);
  renderer.render(pScene, cam);
}

export const Z3 = (t) => 1 + 0.5 * easeInOut(remap(t, T.frozen + 0.3, T.tilt), 1.8);
function renderPhase3(t, target, P, zoom = 1) {
  let seed = null;
  if (t >= T.chem) {
    if (!matter.seeded) { renderWorld(T.chem, S.seedRT); matter.cellFrom(S.seedRT.texture); }
    seed = matter.seedTex;
  }
  renderWorld(t, S.worldRT);
  matter.render(t, P, S.worldRT.texture, target, seed, zoom);
}

function renderScene(t) {
  const P = direct(t);
  if (t < T.cool - 0.05) {
    renderWorld(t, S.sceneRT);
    renderVector(t);
    pVector.render(S.sceneRT, false);
  } else if (t >= T.fractal) {
    const r5 = complexity.render(t, P, S.sceneRT);
    P.corePos.set(r5.coreNdc.x, r5.coreNdc.y);
  } else if (t >= T.tilt) {
    // phase 4 : l'image de la phase 3 devient la face supérieure des colonnes
    let img3, data;
    if (t < T.planets) {
      renderPhase3(t, S.img3RT, P);
      img3 = S.img3RT.texture; data = matter.dataRT.texture;
    } else {
      if (!frozenReady) {
        renderPhase3(T.planets, S.img3Frozen, direct(T.planets));
        pCopy.u.uTex.value = matter.dataRT.texture; pCopy.render(S.dataFrozen);
        frozenReady = true; direct(t);
      }
      img3 = S.img3Frozen.texture; data = S.dataFrozen.texture;
    }
    if (t < T.dive + 0.4) { structures.render(t, P, img3, data, S.sceneRT); return P; }
    // plongée : la faille devient un portail sur le monde fractal
    const r4 = structures.render(t, P, img3, data, S.s4RT);
    complexity.render(t, P, S.s5RT);
    const pr = pPortal.u;
    pr.uA.value = S.s4RT.texture; pr.uB.value = S.s5RT.texture;
    pr.uC.value.set(r4.riftNdc.x, r4.riftNdc.y);
    pr.uR.value = 0.01 + 0.08 * smooth(remap(t, T.dive + 0.4, T.fractal - 0.5)) + 2.6 * easeIn(remap(t, T.fractal - 0.62, T.fractal - 0.04), 2.2);
    pr.uAng.value = r4.riftAng; pr.uT.value = t;
    pPortal.render(S.sceneRT);
    return P;
  } else {
    renderPhase3(t, S.sceneRT, P, Z3(t));
    core.u.uSize.value *= Z3(t);
  }
  if (t >= T.fractal) {
    core.u.uPos.value.copy(P.corePos); core.u.uSize.value = 0.05 * (1 - 0.4 * P.contract) + 0.012 * pulse(t, 4);
    core.u.uI.value = 2.2 + 3 * P.contract; core.u.uCol.value.set(1, 0.75, 0.85); core.u.uFlash.value = 0; core.u.uBlink.value = 0; core.u.uFoam.value = 0;
    core.u.uShock.value.forEach((v) => v.set(0, 0, 0));
  }
  if (t < T.tilt || t >= T.fractal) core.render(S.sceneRT, false);
  return P;
}

// ---------------------------------------------------------------- phase 6 : Lumière (images Cycles)
const pLumiere = pass(/* glsl */`
  uniform sampler2D uBl, uFeed; uniform float uW, uFrame, uBloom, uGrain; uniform vec2 uBlRes;
  // échantillonnage bicubique (Catmull-Rom) : l'image Cycles est agrandie proprement
  vec3 bicubic(sampler2D tex, vec2 uv, vec2 res){
    vec2 p=uv*res-.5, f=fract(p), i=floor(p);
    vec2 w0=f*(-.5+f*(1.-.5*f)), w1=1.+f*f*(-2.5+1.5*f), w2=f*(.5+f*(2.-1.5*f)), w3=f*f*(-.5+.5*f);
    vec2 w12=w1+w2, t0=(i-.5)/res, t3=(i+2.5)/res, t12=(i+.5+w2/w12)/res;
    vec3 c=(texture(tex,vec2(t12.x,t0.y)).rgb*w12.x)*w0.y
      +(texture(tex,vec2(t0.x,t12.y)).rgb*w0.x+texture(tex,t12).rgb*w12.x+texture(tex,vec2(t3.x,t12.y)).rgb*w3.x)*w12.y
      +(texture(tex,vec2(t12.x,t3.y)).rgb*w12.x)*w3.y;
    float s=w12.x*w0.y+(w0.x+w12.x+w3.x)*w12.y+w12.x*w3.y;
    return c/s;
  }
  void main(){
    vec3 bl=bicubic(uBl,vUv,uBlRes);
    // halo optique doux sur les hautes lumières (le verre et le cœur)
    vec3 b=vec3(0.);
    for(int i=0;i<12;i++){ float a=float(i)*2.39996; for(int k=1;k<=3;k++){ vec2 o=vec2(cos(a),sin(a))*float(k)*.012*vec2(uRes.y/uRes.x,1.); vec3 s=texture(uBl,vUv+o).rgb; b+=max(s-.75,0.); } }
    bl+=b/36.*uBloom;
    vec3 fd=texture(uFeed,vUv).rgb;
    vec3 c=mix(fd,bl,uW);
    c+=(hash13(vec3(gl_FragCoord.xy,uFrame))-.5)*uGrain;
    fragColor=vec4(c,1.);
  }`, { uBl: { value: null }, uFeed: { value: null }, uW: { value: 0 }, uFrame: { value: 0 }, uBloom: { value: 1.2 }, uGrain: { value: 0.018 }, uBlRes: { value: new THREE.Vector2(1920, 1080) } });
const texCache = {};
async function loadTex(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('image manquante : ' + url);
  const bmp = await createImageBitmap(await r.blob(), { imageOrientation: 'flipY' });
  const tx = new THREE.Texture(bmp); tx.flipY = false; tx.colorSpace = THREE.NoColorSpace;
  tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false; tx.needsUpdate = true;
  return tx;
}
async function renderLumiere(t, fps) {
  const n = Math.round(t * fps), f5 = String(n).padStart(5, '0');
  const bl = await loadTex(`../${ROOTD}/blender/${f5}.png`);
  const fd = await loadTex(`../${ROOTD}/07_interieur/${f5}.png`);
  const u = pLumiere.u;
  u.uBl.value = bl; u.uFeed.value = fd; u.uBlRes.value.set(bl.image.width, bl.image.height);
  u.uW.value = smooth(remap(t, T.pullback, T.pullback + 0.2)); u.uFrame.value = n;
  u.uBloom.value = 1.2 * smooth(remap(t, T.pullback, T.pullback + 0.6));
  pLumiere.render(null);
  bl.dispose(); fd.dispose(); bl.image.close(); fd.image.close();
}

window.renderFrame = async function (t, fps = 24) {
  if (MODE === 'film' && t >= T.pullback) { await renderLumiere(t, fps); return true; }
  const K = motionK(t);
  const shutter = 0.5 / fps; // obturateur à 180°
  clearAccum();
  let P;
  for (let k = 0; k < K; k++) {
    const ts = K === 1 ? t : t + (k / (K - 1) - 0.5) * shutter;
    P = renderScene(Math.max(ts, 0));
    addToAccum(S.sceneRT.texture, 1 / K);
  }
  P = direct(t);
  finish(P, Math.round(t * fps));
  return true;
};

document.fonts.ready.then(() => { window.ready = true; });
