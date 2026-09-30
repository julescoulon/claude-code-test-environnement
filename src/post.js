// Post-production : accumulation (flou de mouvement), optique, bloom, reflet anamorphique, étalonnage, grain.
import { pass, rt, W, H, THREE, additive, renderer } from './gl.js';

let accum, lensRT, bright, blurA = [], blurB = [], streakA, streakB;
let pAccum, pCopy, pLens, pBright, pBlurH, pBlurV, pFinal, pStreak;

export function initPost() {
  accum = rt(W, H, { type: THREE.FloatType });
  lensRT = rt(W, H);
  const lv = [2, 4, 8, 16, 32];
  lv.forEach((d) => { blurA.push(rt(Math.ceil(W / d), Math.ceil(H / d))); blurB.push(rt(Math.ceil(W / d), Math.ceil(H / d))); });
  streakA = rt(Math.ceil(W / 4), Math.ceil(H / 8)); streakB = rt(Math.ceil(W / 4), Math.ceil(H / 8));
  pAccum = pass(`uniform sampler2D uTex; uniform float uW; void main(){ fragColor=vec4(texture(uTex,vUv).rgb*uW,1.); }`,
    { uTex: { value: null }, uW: { value: 1 } }, additive);
  pLens = pass(/* glsl */`
    uniform sampler2D uTex; uniform vec2 uPos; uniform vec3 uShock[3]; uniform float uCA, uShockRefr; uniform vec3 uJit;
    void main(){
      float asp=uRes.x/uRes.y;
      vec2 q=(vUv*2.-1.)*vec2(asp,1.)-uPos*vec2(asp,1.);
      float r=length(q); vec2 dir=q/max(r,1e-4);
      float off=0.;
      for(int i=0;i<3;i++){ vec3 s=uShock[i]; if(s.y<=0.) continue; float d=r-s.x; off+= -d*exp(-d*d/(s.z*s.z*.3))*s.y*uShockRefr; }
      vec2 uv=vUv + dir*off/vec2(asp,1.)*.5;
      // tremblement stop-motion : décalage + micro-rotation par image
      vec2 cq=(uv-.5)*vec2(asp,1.); float cr=cos(uJit.z), sr=sin(uJit.z);
      cq=mat2(cr,-sr,sr,cr)*cq/(1.+abs(uJit.z)*1.5+length(uJit.xy)*2.2); uv=cq/vec2(asp,1.)+.5+uJit.xy;
      vec2 ca=dir*uCA*(r*r*.5+.15)/vec2(asp,1.);
      vec3 c=vec3(texture(uTex,uv+ca).r, texture(uTex,uv).g, texture(uTex,uv-ca).b);
      fragColor=vec4(c,1.);
    }`, { uTex: { value: null }, uPos: { value: new THREE.Vector2() }, uShock: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, uCA: { value: 0 }, uShockRefr: { value: 0.3 }, uJit: { value: new THREE.Vector3() } });
  pBright = pass(`uniform sampler2D uTex; uniform float uTh; void main(){ vec3 c=vec3(0.); vec2 px=1./uRes;
      for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++) c+=texture(uTex,vUv+vec2(i,j)*px*1.5).rgb; c/=9.;
      float l=max(max(c.r,c.g),c.b); fragColor=vec4(c*smoothstep(uTh,uTh+.8,l),1.); }`, { uTex: { value: null }, uTh: { value: 0.8 } });
  const blur = (dir) => pass(`uniform sampler2D uTex; uniform vec2 uDir; void main(){
      vec2 px=uDir/vec2(textureSize(uTex,0)); vec3 c=texture(uTex,vUv).rgb*.227;
      c+=(texture(uTex,vUv+px*1.38).rgb+texture(uTex,vUv-px*1.38).rgb)*.316;
      c+=(texture(uTex,vUv+px*3.23).rgb+texture(uTex,vUv-px*3.23).rgb)*.070;
      fragColor=vec4(c,1.); }`, { uTex: { value: null }, uDir: { value: new THREE.Vector2(dir === 'h' ? 1 : 0, dir === 'h' ? 0 : 1) } });
  pBlurH = blur('h'); pBlurV = blur('v');
  pStreak = pass(`uniform sampler2D uTex; uniform float uStep; void main(){
      vec2 px=vec2(uStep/float(textureSize(uTex,0).x),0.); vec3 c=vec3(0.); float ws=0.;
      for(int i=-8;i<=8;i++){ float w=exp(-float(i*i)/28.); c+=texture(uTex,vUv+px*float(i)).rgb*w; ws+=w; }
      fragColor=vec4(c/ws,1.); }`, { uTex: { value: null }, uStep: { value: 1 } });
  pCopy = pass(`uniform sampler2D uTex; void main(){ fragColor=vec4(texture(uTex,vUv).rgb,1.); }`, { uTex: { value: null } });
  pFinal = pass(/* glsl */`
    uniform sampler2D uTex, uB0, uB1, uB2, uB3, uB4, uStreak, uPaper;
    uniform float uBloom, uStreakI, uExposure, uVignette, uGrain, uFrame, uPaperI, uSat;
    uniform vec3 uStreakTint, uLift, uGain;
    void main(){
      vec3 c=texture(uTex,vUv).rgb;
      vec3 b=texture(uB0,vUv).rgb*.35+texture(uB1,vUv).rgb*.3+texture(uB2,vUv).rgb*.25+texture(uB3,vUv).rgb*.25+texture(uB4,vUv).rgb*.3;
      c+=b*uBloom;
      c+=texture(uStreak,vUv).rgb*uStreakTint*uStreakI;
      c*=uExposure;
      c=aces(c);
      float l=luma(c); c=mix(vec3(l),c,uSat);
      c=uLift+c*(uGain-uLift);
      vec2 q=vUv*2.-1.; q.x*=uRes.x/uRes.y*.8;
      c*=1.-uVignette*smoothstep(.4,1.6,dot(q,q));
      // papier (stop-motion) : grain fibreux multiplié
      if(uPaperI>0.){ vec3 pp=texture(uPaper,vUv).rgb; c=mix(c, c*pp*1.05 + (1.-pp)*.02, uPaperI); }
      c=pow(max(c,0.),vec3(1./2.2));
      float g=hash13(vec3(gl_FragCoord.xy,uFrame))-.5;
      c+=g*uGrain + (hash13(vec3(gl_FragCoord.xy,uFrame+7.))-.5)/255.;
      fragColor=vec4(c,1.);
    }`, {
    uTex: { value: null }, uB0: { value: null }, uB1: { value: null }, uB2: { value: null }, uB3: { value: null }, uB4: { value: null },
    uStreak: { value: null }, uPaper: { value: null }, uBloom: { value: 0.6 }, uStreakI: { value: 0.3 }, uExposure: { value: 1 },
    uVignette: { value: 0.35 }, uGrain: { value: 0.03 }, uFrame: { value: 0 }, uPaperI: { value: 0 }, uSat: { value: 1 },
    uStreakTint: { value: new THREE.Vector3(0.6, 0.7, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
  });
  return { accum };
}

// Texture papier procédurale (fibres, grain, légère teinte chaude) : générée une fois.
let paperRT = null;
export function paperTexture() {
  if (paperRT) return paperRT.texture;
  paperRT = rt(W, H);
  const p = pass(`void main(){
      vec2 q=vUv*vec2(uRes.x/uRes.y,1.);
      float f=fbm(vec3(q*vec2(40.,6.),1.))*.5+fbm(vec3(q*vec2(8.,60.),2.))*.3+fbm(vec3(q*3.,3.))*.4;
      float g=hash12(gl_FragCoord.xy)*.5+hash12(floor(gl_FragCoord.xy/2.))*.5;
      float v=.9+f*.06+(g-.5)*.07;
      fragColor=vec4(v*vec3(1.,.97,.9),1.); }`, {});
  p.render(paperRT);
  return paperRT.texture;
}

export function clearAccum() { renderer.setRenderTarget(accum); renderer.setClearColor(0x000000, 0); renderer.clear(); }
export function addToAccum(tex, w) { pAccum.u.uTex.value = tex; pAccum.u.uW.value = w; pAccum.render(accum, false); }

export function finish(P, frame) {
  pLens.u.uTex.value = accum.texture;
  pLens.u.uPos.value.copy(P.corePos);
  for (let i = 0; i < 3; i++) pLens.u.uShock.value[i].copy(P.shocks[i]);
  pLens.u.uCA.value = P.ca; pLens.u.uJit.value.copy(P.jit || new THREE.Vector3()); pLens.render(lensRT);
  // bloom
  pBright.u.uTex.value = lensRT.texture; pBright.u.uTh.value = P.bloomTh; pBright.render(blurA[0]);
  for (let i = 0; i < blurA.length; i++) {
    if (i > 0) { pCopy.u.uTex.value = blurA[i - 1].texture; pCopy.render(blurA[i]); }
    pBlurH.u.uTex.value = blurA[i].texture; pBlurH.render(blurB[i]);
    pBlurV.u.uTex.value = blurB[i].texture; pBlurV.render(blurA[i]);
  }
  // reflet anamorphique : flou horizontal très large des hautes lumières
  pCopy.u.uTex.value = blurA[1].texture; pCopy.render(streakA);
  let src = streakA, dst = streakB;
  for (let i = 0; i < 4; i++) { pStreak.u.uTex.value = src.texture; pStreak.u.uStep.value = Math.pow(3, i); pStreak.render(dst); [src, dst] = [dst, src]; }
  const u = pFinal.u;
  u.uTex.value = lensRT.texture;
  [u.uB0, u.uB1, u.uB2, u.uB3, u.uB4].forEach((x, i) => (x.value = blurA[i].texture));
  u.uStreak.value = src.texture;
  u.uBloom.value = P.bloom; u.uStreakI.value = P.streak; u.uStreakTint.value.copy(P.streakTint);
  u.uExposure.value = P.exposure; u.uVignette.value = P.vignette; u.uGrain.value = P.grain; u.uFrame.value = frame;
  u.uSat.value = P.sat; u.uLift.value.copy(P.lift); u.uGain.value.copy(P.gain);
  u.uPaperI.value = P.paperI; u.uPaper.value = P.paperTex;
  pFinal.render(null);
}
