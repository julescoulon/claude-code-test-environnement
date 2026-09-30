// Phase 4 — Structures : la grille de glyphes bascule, s'extrude, puis s'enroule en planètes.
// Fil de fer → faces plates → ombrage lisse → cel-shading + encre + trame BD. L-systems, essaims.
import { THREE, W, H, rt, pass, renderer } from '../gl.js';
import { NOISE, COLOR } from '../glsl.js';
import { GX, GY } from './matter.js';
import { rng, gauss } from '../rng.js';

const ASP = 16 / 9;
export const CELL = 2 / GY; // taille d'une cellule en unités monde (plan z=0 vu à distance D = hauteur 2)

// Planètes : 0 = planète centrale (enveloppe le cœur), 1..5 = lunes
export const PLANETS = [
  { r: 0.30, orbit: 0, phase: 0, speed: 0, tilt: 0 },
  { r: 0.12, orbit: 0.78, phase: 0.9, speed: 0.22, tilt: 0.06 },
  { r: 0.16, orbit: 1.02, phase: 2.7, speed: 0.15, tilt: -0.05 },
  { r: 0.10, orbit: 1.24, phase: 4.3, speed: 0.12, tilt: 0.1 },
  { r: 0.19, orbit: 1.5, phase: 5.5, speed: 0.08, tilt: -0.04 },
  { r: 0.09, orbit: 1.76, phase: 1.6, speed: 0.06, tilt: 0.08 },
];
const RING_R = [0.3, 0.46, 0.64, 0.86];

export function planetPos(j, t, t0) {
  const p = PLANETS[j];
  if (j === 0) return new THREE.Vector3(0, 0, 0);
  const a = p.phase + p.speed * (t - t0) * 2.2;
  return new THREE.Vector3(Math.cos(a) * p.orbit, Math.sin(a) * p.orbit, Math.sin(a * 1.3) * p.tilt * p.orbit);
}

const COMMON_VS = /* glsl */`
  ${NOISE}
  uniform float uT, uHmax, uMorphT, uMorphDur, uExtT, uFoot, uShrink;
  uniform sampler2D uData;
  uniform vec4 uPl[6]; // centre xyz, rayon
  uniform float uSpin[6];
  uniform float uRingRot;
  uniform vec3 uRift; uniform float uRiftOpen;
  in vec2 aCell; in vec4 aTgt; in float aDelay;
  out vec3 vW; out vec3 vN; out vec2 vUv; out float vTop; out vec2 vCellUv; out float vDist; out float vPal; out float vH; out float vLum; out float vRing;
  vec3 rotZ(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x-s*p.y, s*p.x+c*p.y, p.z); }
  void main(){
    vec4 dat=texelFetch(uData, ivec2(aCell), 0);
    float lum=dat.b, show=dat.a;
    float ring = aTgt.w < -.5 ? 1. : 0.;
    vec2 g2=((aCell+.5)/vec2(${GX}.,${GY}.)*2.-1.)*vec2(${ASP.toFixed(6)},1.);
    vec3 g=vec3(g2,0.);
    float dist=length(g2);
    // extrusion : onde depuis le cœur, ressort amorti
    float te=(uT-(uExtT+dist*.55+aDelay*.25))/.9;
    float ext = te<=0. ? 0. : 1.-exp(-5.*te)*cos(7.*te);
    float h0 = ring>.5 ? .4 : smoothstep(.12,.9,lum);
    float h = uHmax*h0*ext + .0005;
    float alive = (ring>.5 || lum>.1) ? 1. : 0.;
    // cible sur la planète (ou dans l'anneau de la planète centrale)
    int pj=int(max(aTgt.w,0.));
    vec3 pc=uPl[pj].xyz; float pr=uPl[pj].w;
    vec3 n; vec3 tgt;
    if(ring>.5){
      float a=aTgt.x+uRingRot*(mod(aTgt.y,2.)<.5?1.:-1.);
      float rr=.48+aTgt.y*.07;
      vec3 rp=vec3(cos(a)*rr, sin(a)*rr*.92, sin(a)*rr*.12);
      tgt=rp; n=normalize(vec3(0.,-.12,1.));
    } else {
      vec3 dl=normalize(aTgt.xyz);
      dl=rotZ(dl,uSpin[pj]);
      n=dl; tgt=pc+dl*pr;
      // la faille s'ouvre : les tours proches basculent vers l'extérieur et s'effacent
      if(pj==0 && uRiftOpen>0.){
        float rd=dot(dl,uRift);
        float k=smoothstep(.55,.95,rd)*uRiftOpen;
        n=normalize(n+normalize(dl-uRift*rd+1e-4)*k*2.);
        pr*=1.+k*.3; tgt=pc+dl*pr;
        alive*=1.-smoothstep(.6,.95,k);
      }
    }
    float m=clamp((uT-(uMorphT+aDelay*.9))/uMorphDur,0.,1.);
    float me=m*m*(3.-2.*m);
    // trajectoire en arc
    float dd=length(tgt-g);
    vec3 ctrl=mix(g,tgt,.5)+vec3(0.,0.,.25+.35*dd)+normalize(vec3(-g.y,g.x,0.)+1e-4)*.2*dd;
    vec3 base=mix(mix(g,ctrl,me),mix(ctrl,tgt,me),me);
    vec3 up=normalize(mix(vec3(0.,0.,1.),n,me));
    vec3 tx=normalize(cross(up, abs(up.z)<.95?vec3(0.,0.,1.):vec3(1.,0.,0.)));
    if(me<.001) tx=vec3(1.,0.,0.);
    vec3 ty=cross(up,tx);
    // étirement en vol, écrasement à l'atterrissage
    float fly=sin(3.14159*me);
    float land=m>=1.? exp(-(uT-(uMorphT+aDelay*.9+uMorphDur))*6.)*sin((uT-(uMorphT+aDelay*.9+uMorphDur))*25.) : 0.;
    float foot=${CELL.toFixed(6)}*mix(1.,uFoot,smoothstep(0.,.3,ext))*(1.-.35*fly)*(1.+.25*land)*mix(1.,uShrink,me);
    float hh=h*mix(1.,.22,me)*(1.+1.2*fly)*(1.-.4*land);
    if(ring>.5) hh=mix(h,.035,me);
    vec3 lp=position+vec3(0.,0.,.5); // boîte 1×1×1 posée sur z=0
    vec3 wp=base + tx*lp.x*foot + ty*lp.y*foot + up*lp.z*hh;
    wp*=alive;
    vW=wp;
    vN=normalize(tx*normal.x+ty*normal.y+up*normal.z);
    vUv=uv; vTop=normal.z>.5?1.:0.;
    vCellUv=(aCell+.5)/vec2(${GX}.,${GY}.);
    vDist=dist; vPal=dat.g; vH=lp.z; vLum=lum; vRing=ring;
    gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
  }`;

// Étapes de style (temps, étalées selon la distance au cœur)
const STYLE_FS = /* glsl */`
  ${COLOR}
  uniform vec4 uStage; // fil→plat, plat→lisse, lisse→cel, vert
  uniform vec3 uCorePos;
  uniform float uCoreI;
  uniform vec3 uKey;
  uniform vec3 uGreen[5]; // ombre, moyen, clair, crème, encre
  float stageK(float t0, float d){ return smoothstep(0.,.18, uT-(t0+d*.5)); }
  vec3 cyanPal(float i){ return uPal[int(clamp(i,0.,7.))]*1.2; }
  // ombrage selon l'étape : 0 fil de fer, 1 plat, 2 lisse, 3 cel
  vec3 shade(vec3 base, vec3 N, vec3 P, float sW, float sF, float sS, float sC, float ao, vec3 wireCol, float edge){
    vec3 L=normalize(uCorePos-P); float dl=length(uCorePos-P);
    float att=uCoreI/(1.+dl*dl*1.2);
    vec3 V=normalize(cameraPosition-P);
    float ndl=max(dot(N,L),0.)*att + max(dot(N,uKey),0.)*.85;
    att=1.;
    vec3 amb=vec3(.05,.07,.09);
    vec3 flat_=base*(amb+ndl*att*1.3);
    vec3 H=normalize(L+V);
    vec3 smooth_=base*(amb+ndl*att*1.2)*ao + pow(max(dot(N,H),0.),40.)*att*.6 + base*pow(1.-max(dot(N,V),0.),3.)*.25;
    // cel : 3 bandes + trame de points dans l'ombre
    float lt=ndl;
    vec3 cel = lt>.55 ? uGreen[2] : (lt>.18 ? uGreen[1] : uGreen[0]);
    float dots=0.;
    if(lt<=.18){ vec2 q=gl_FragCoord.xy/(uRes.y/135.); vec2 f=fract(mat2(.707,-.707,.707,.707)*q)-.5; dots=step(length(f),.28*(1.-lt/.18)+.12); cel=mix(cel,uGreen[4],dots*.8); }
    float rim=pow(1.-max(dot(N,V),0.),4.); cel=mix(cel,uGreen[3],step(.55,rim)*.7);
    vec3 wire=mix(base*.04, wireCol, edge);
    vec3 c=wire;
    c=mix(c,flat_+wireCol*edge*.25,sF);
    c=mix(c,smooth_,sS);
    c=mix(c,cel,sC);
    return c;
  }`;

export function createWorld3D(atlasTex, palUniform) {
  const r = rng(21);
  // --- attribution des cellules : anneaux → anneaux de la planète centrale, le reste → planète la plus proche
  const N = GX * GY;
  const aCell = new Float32Array(N * 2), aTgt = new Float32Array(N * 4), aDelay = new Float32Array(N);
  const buckets = PLANETS.map(() => []);
  const t0pos = PLANETS.map((_, j) => planetPos(j, 0, 0));
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    const i = y * GX + x;
    aCell[i * 2] = x; aCell[i * 2 + 1] = y;
    const gx = ((x + 0.5) / GX * 2 - 1) * ASP, gy = (y + 0.5) / GY * 2 - 1;
    const rr = Math.hypot(gx, gy);
    let ringK = -1;
    RING_R.forEach((R, k) => { if (Math.abs(rr - R) < (2 / GY) * 0.55) ringK = k; });
    if (ringK >= 0) {
      aTgt.set([Math.atan2(gy, gx), ringK, 0, -1], i * 4);
      aDelay[i] = 0.15 + ringK * 0.12 + r() * 0.1;
    } else {
      // planète la plus proche du point de la grille (distance pondérée par la taille)
      let best = 0, bd = 1e9;
      t0pos.forEach((p, j) => { const d = Math.hypot(gx - p.x * 1.0, gy - p.y * 1.0) / (0.4 + PLANETS[j].r * 2.5); if (d < bd) { bd = d; best = j; } });
      buckets[best].push(i);
      aDelay[i] = Math.min(bd * 0.35, 1.0) + r() * 0.25;
    }
  }
  // points de Fibonacci sur chaque planète
  buckets.forEach((cells, j) => {
    const n = cells.length;
    cells.forEach((i, k) => {
      const yy = 1 - (k + 0.5) / n * 2, rad = Math.sqrt(1 - yy * yy), th = k * 2.399963 + j;
      aTgt.set([Math.cos(th) * rad, Math.sin(th) * rad, yy, j], i * 4);
    });
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index;
  geo.setAttribute('position', box.getAttribute('position'));
  geo.setAttribute('normal', box.getAttribute('normal'));
  geo.setAttribute('uv', box.getAttribute('uv'));
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2));
  geo.setAttribute('aTgt', new THREE.InstancedBufferAttribute(aTgt, 4));
  geo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(aDelay, 1));
  geo.instanceCount = N;

  const u = {
    uT: { value: 0 }, uHmax: { value: 0.32 }, uMorphT: { value: 0 }, uMorphDur: { value: 1.1 }, uExtT: { value: 0 },
    uFoot: { value: 0.86 }, uShrink: { value: 0.8 }, uData: { value: null }, uImg: { value: null },
    uPl: { value: PLANETS.map(() => new THREE.Vector4()) }, uSpin: { value: PLANETS.map(() => 0) }, uRingRot: { value: 0 },
    uStage: { value: new THREE.Vector4(1e9, 1e9, 1e9, 1e9) }, uCorePos: { value: new THREE.Vector3() }, uCoreI: { value: 1.5 }, uKey: { value: new THREE.Vector3(0, 0, 0) },
    uGreen: { value: [new THREE.Vector3(0.012, 0.05, 0.035), new THREE.Vector3(0.09, 0.42, 0.12), new THREE.Vector3(0.55, 0.95, 0.18), new THREE.Vector3(0.95, 0.92, 0.7), new THREE.Vector3(0.004, 0.012, 0.01)] },
    uPal: palUniform, uRes: { value: new THREE.Vector2(W, H) }, uAtlas: { value: atlasTex }, uCrack: { value: 0 }, uRift: { value: new THREE.Vector3(0, 0, 1) }, uRiftOpen: { value: 0 },
  };

  const colFS = (normalPass) => /* glsl */`
    precision highp float;
    uniform vec3 uPal[8]; uniform vec2 uRes; uniform float uT; uniform sampler2D uImg;
    ${STYLE_FS}
    in vec3 vW; in vec3 vN; in vec2 vUv; in float vTop; in vec2 vCellUv; in float vDist; in float vPal; in float vH; in float vLum; in float vRing;
    layout(location=0) out vec4 o;
    void main(){
      ${normalPass ? `o=vec4(normalize(vN)*.5+.5, gl_FragCoord.z); return;` : ''}
      float sW=1.;
      float sF=stageK(uStage.x,vDist), sS=stageK(uStage.y,vDist), sC=stageK(uStage.z,vDist), gr=stageK(uStage.w,vDist*.6);
      vec2 e2=min(vUv,1.-vUv); float ed=min(e2.x,e2.y);
      float edge=1.-smoothstep(0.,fwidth(ed)*1.6,ed);
      vec3 base=cyanPal(vPal+1.);
      vec3 greenBase=mix(uGreen[1],uGreen[2],clamp(vLum*1.2,0.,1.));
      base=mix(base,greenBase,gr);
      vec3 wireCol=mix(vec3(.3,1.,1.2)*1.4, vec3(.7,1.3,.3), gr);
      float ao=mix(.35,1.,smoothstep(0.,1.,vH));
      vec3 c=shade(base, normalize(vN), vW, sW,sF,sS,sC, ao, wireCol, edge);
      if(vTop>.5){
        // face supérieure : le glyphe de la phase précédente, recoloré en vert
        vec2 cuv=vCellUv+(vUv-.5)/vec2(${GX}.,${GY}.);
        vec3 img=texture(uImg,cuv).rgb;
        float l=luma(img);
        vec3 gimg=mix(uGreen[0]*.6, uGreen[3]*1.3, smoothstep(.05,.5,l));
        vec3 top=mix(img, gimg, gr);
        c=mix(top, mix(top,c,.35), sS*(1.-sC)) ;
        c=mix(c, mix(uGreen[4], uGreen[3], smoothstep(.1,.45,l)), sC);
      }
      if(vRing>.5 && vTop<.5) c=mix(c, c*1.3+vec3(.02,.05,.04), .5);
      o=vec4(c,1.);
    }`;

  const vsCols = COMMON_VS;
  const matCols = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: u, vertexShader: vsCols, fragmentShader: colFS(false) });
  const matColsN = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: u, vertexShader: vsCols, fragmentShader: colFS(true) });
  const cols = new THREE.Mesh(geo, matCols); cols.frustumCulled = false;

  // --- planètes : icosphères dont le nombre de faces augmente sur les temps
  const planetGeos = [0, 1, 2, 3, 5].map((d) => new THREE.IcosahedronGeometry(1, d).toNonIndexed());
  planetGeos.forEach((g) => {
    // barycentriques pour le fil de fer
    const n = g.getAttribute('position').count, b = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) b[i * 3 + (i % 3)] = 1;
    g.setAttribute('bary', new THREE.BufferAttribute(b, 3));
  });
  const plU = { ...u, uCenter: { value: new THREE.Vector3() }, uRad: { value: 1 }, uGrow: { value: 0 }, uIdx: { value: 0 }, uFlatN: { value: 1 } };
  const plVS = /* glsl */`
    ${NOISE}
    uniform vec3 uCenter; uniform float uRad, uGrow, uT, uIdx;
    in vec3 bary; out vec3 vW; out vec3 vN; out vec3 vB; out vec3 vL;
    void main(){
      vec3 p=position*uRad*uGrow + uCenter;
      vW=p; vN=normalize(position); vB=bary; vL=position;
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
    }`;
  const plFS = (normalPass) => /* glsl */`
    precision highp float;
    uniform vec3 uPal[8]; uniform vec2 uRes; uniform float uT, uFlatN, uCrack, uIdx; uniform vec3 uRift; uniform float uRiftOpen;
    ${NOISE}
    ${STYLE_FS}
    in vec3 vW; in vec3 vN; in vec3 vB; in vec3 vL;
    layout(location=0) out vec4 o;
    void main(){
      vec3 fn=normalize(cross(dFdx(vW),dFdy(vW)));
      vec3 N=normalize(mix(vN, fn, uFlatN));
      ${normalPass ? `o=vec4(N*.5+.5, gl_FragCoord.z); return;` : ''}
      float sF=stageK(uStage.x,0.), sS=stageK(uStage.y,0.), sC=stageK(uStage.z,0.);
      float bm=min(vB.x,min(vB.y,vB.z)); float edge=1.-smoothstep(0.,fwidth(bm)*1.5,bm);
      float n=fbm(vL*3.+uIdx*7.);
      vec3 base=mix(uGreen[1],uGreen[2],smoothstep(-.3,.5,n));
      if(uIdx>.5) base=mix(base, vec3(.2,.6,.45), .5*fract(uIdx*.37));
      vec3 c=shade(base, N, vW, 1., sF, sS, sC, 1., vec3(.7,1.3,.3), edge);
      // continents dessinés (cel) : une deuxième teinte
      c=mix(c, c*vec3(.75,.9,.6), step(.15,n)*sC*.6);
      // fissure lumineuse de la planète centrale : la lumière du cœur fuit
      if(uIdx<.5 && uCrack>0.){
        float cr=abs(snoise(vL*vec3(2.2,5.,2.2)+vec3(0.,0.,1.3)));
        float w=.02+.08*uCrack;
        float k=smoothstep(w,0.,cr)*smoothstep(-.4,.2,vL.z+vL.x*.5);
        c=mix(c, vec3(2.2,1.8,1.2)*(1.+uCrack), k*min(uCrack*3.,1.));
      }
      // la grande faille (cible de la plongée)
      if(uIdx<.5 && uRiftOpen>0.){
        vec3 nl=normalize(vL);
        vec3 tv=normalize(cross(uRift,vec3(0.,0.,1.)));
        vec3 nr=normalize(cross(uRift,tv));
        float jag=snoise(nl*14.)*.035+snoise(nl*40.)*.012;
        float dpl=abs(dot(nl,nr)+jag);
        float along=dot(nl,uRift);
        float w=.01+.05*uRiftOpen*uRiftOpen;
        float k=smoothstep(w,w*.3,dpl)*smoothstep(.55,.85,along);
        c=mix(c, vec3(5.,3.8,2.4)*(1.+uRiftOpen), k);
      }
      o=vec4(c,1.);
    }`;
  const planets = PLANETS.map((p, j) => {
    const pu = { ...plU, uStage: { value: new THREE.Vector4(1e9, 1e9, 1e9, 1e9) }, uCenter: { value: new THREE.Vector3() }, uRad: { value: p.r * (j === 0 ? 0.93 : 0.9) }, uGrow: { value: 0 }, uIdx: { value: j }, uFlatN: { value: 1 } };
    const m = new THREE.Mesh(planetGeos[0], new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: pu, vertexShader: plVS, fragmentShader: plFS(false) }));
    m.userData.matN = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: pu, vertexShader: plVS, fragmentShader: plFS(true) });
    m.userData.u = pu; m.frustumCulled = false;
    return m;
  });

  // --- orbites en pointillés (dessin technique), tracées progressivement
  const orbitMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uDraw: { value: 0 }, uT: { value: 0 }, uI: { value: 1 } },
    vertexShader: `in float aS; out float vS; void main(){ vS=aS; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
    fragmentShader: `precision highp float; in float vS; uniform float uDraw, uT, uI; out vec4 o; void main(){
      if(vS>uDraw) discard; float dash=step(.45,fract(vS*60.-uT*.5)); o=vec4(vec3(.8,1.,.55)*.5*dash*uI,1.); }`,
  });
  const orbits = PLANETS.slice(1).map((p, k) => {
    const pts = [], s = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      pts.push(Math.cos(a) * p.orbit, Math.sin(a) * p.orbit, Math.sin(a * 1.3) * p.tilt * p.orbit); s.push(i / 256);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(s, 1));
    const l = new THREE.Line(g, orbitMat); l.frustumCulled = false; return l;
  });

  // --- L-systems : arbres qui poussent sur la planète centrale
  const trees = buildTrees(rng(33));
  const treeMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: { uGrow: { value: 0 } },
    vertexShader: `in float aG; out float vG; void main(){ vG=aG; gl_Position=projectionMatrix*viewMatrix*vec4(position,1.); }`,
    fragmentShader: `precision highp float; in float vG; uniform float uGrow; layout(location=0) out vec4 o; void main(){ if(vG>uGrow) discard; o=vec4(vec3(.01,.02,.015),1.); }`,
  });
  const treeMatN = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: treeMat.uniforms,
    vertexShader: treeMat.vertexShader,
    fragmentShader: `precision highp float; in float vG; uniform float uGrow; layout(location=0) out vec4 o; void main(){ if(vG>uGrow) discard; o=vec4(.5,.5,1.,gl_FragCoord.z); }`,
  });
  const treeLines = new THREE.LineSegments(trees.geo, treeMat); treeLines.frustumCulled = false;
  treeLines.userData.matN = treeMatN;
  const leafMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: { uGrow: treeMat.uniforms.uGrow, uRes: { value: new THREE.Vector2(W, H) } }, transparent: false,
    vertexShader: `in float aG; out float vG; uniform vec2 uRes; void main(){ vG=aG; vec4 c=projectionMatrix*viewMatrix*vec4(position,1.); gl_Position=c; gl_PointSize=uRes.y/1080.*9./c.w; }`,
    fragmentShader: `precision highp float; in float vG; uniform float uGrow; layout(location=0) out vec4 o; void main(){ if(vG>uGrow) discard; vec2 q=gl_PointCoord*2.-1.; if(dot(q,q)>1.) discard; o=vec4(dot(q,q)>.55?vec3(.01,.03,.01):vec3(.7,1.,.2),1.); }`,
  });
  const leaves = new THREE.Points(trees.leafGeo, leafMat); leaves.frustumCulled = false;

  // --- essaims (boids) : petits tétraèdres encrés
  const boids = createBoids();

  const scene = new THREE.Scene();
  scene.add(cols, ...planets, ...orbits, treeLines, leaves, boids.mesh);

  return { scene, cols, matCols, matColsN, planets, planetGeos, orbits, orbitMat, treeLines, treeMat, leaves, boids, u };
}

// Arbres par L-system 3D (tortue), posés sur la planète centrale et orientés vers l'extérieur.
function buildTrees(r) {
  const rules = { F: 'FF', X: 'F[+X][-X][&X][^X]FX' };
  let s = 'X';
  for (let i = 0; i < 4; i++) s = [...s].map((c) => rules[c] || c).join('');
  const pos = [], grow = [], leafPos = [], leafG = [];
  const R0 = PLANETS[0].r * 0.93;
  const spots = 9;
  for (let k = 0; k < spots; k++) {
    // points du côté de la caméra (hémisphère +z / -y)
    const th = (k / spots) * Math.PI * 2 + r() * 0.4, ph = 0.35 + r() * 0.9;
    const n = new THREE.Vector3(Math.cos(th) * Math.sin(ph), Math.sin(th) * Math.sin(ph) - 0.3, Math.cos(ph)).normalize();
    let p = n.clone().multiplyScalar(R0);
    let dir = n.clone();
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0.3, 0.2, 0.9).normalize()).normalize();
    const stack = [];
    const len = 0.0065 * (0.8 + r() * 0.4);
    let depth = 0, maxDepth = 1;
    const segs = [];
    let st = { p, dir, side, depth: 0, dist: 0 };
    for (const c of s) {
      if (c === 'F') {
        const np = st.p.clone().addScaledVector(st.dir, len);
        segs.push([st.p, np, st.dist]); st = { ...st, p: np, dist: st.dist + 1 };
        maxDepth = Math.max(maxDepth, st.dist);
      } else if (c === '[') stack.push({ ...st, dir: st.dir.clone(), side: st.side.clone() });
      else if (c === ']') { leafPos.push(st.p.x, st.p.y, st.p.z); leafG.push(st.dist); st = stack.pop(); }
      else {
        const ang = 0.45 + r() * 0.25;
        const axis = (c === '+' || c === '-') ? st.side : new THREE.Vector3().crossVectors(st.dir, st.side).normalize();
        st.dir = st.dir.clone().applyAxisAngle(axis, (c === '+' || c === '&') ? ang : -ang).normalize();
        st.dir.lerp(n, 0.12).normalize(); // phototropisme : les branches cherchent la lumière
      }
    }
    segs.forEach(([a, b, d]) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z); grow.push(d / maxDepth, (d + 1) / maxDepth); });
    for (let i = leafG.length - (leafPos.length / 3 - leafG.length); i < leafG.length; i++); // (compatibilité)
    for (let i = 0; i < leafG.length; i++) if (leafG[i] > 1) leafG[i] = leafG[i] / maxDepth;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aG', new THREE.Float32BufferAttribute(grow, 1));
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafPos, 3));
  leafGeo.setAttribute('aG', new THREE.Float32BufferAttribute(leafG.map((g) => Math.min(g, 1)), 1));
  return { geo, leafGeo };
}

// Essaims : simulation déterministe à pas fixe, rejouée depuis son début si besoin.
function createBoids() {
  const NB = 240;
  const geo = new THREE.ConeGeometry(0.012, 0.04, 3); geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x030805 });
  const mesh = new THREE.InstancedMesh(geo, mat, NB); mesh.frustumCulled = false;
  const matN = new THREE.MeshNormalMaterial();
  mesh.userData.matN = null; // les essaims n'entrent pas dans le trait d'encre (déjà noirs)
  let state = null, time = -1;
  const DT = 1 / 48;
  function reset(t0) {
    const r = rng(44);
    state = [];
    for (let i = 0; i < NB; i++) {
      const a = r() * Math.PI * 2, d = 0.55 + r() * 0.5;
      state.push({ p: new THREE.Vector3(Math.cos(a) * d, Math.sin(a) * d, (r() - 0.5) * 0.3), v: new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).multiplyScalar(0.5) });
    }
    time = t0;
  }
  function step(t) {
    const f = new THREE.Vector3(), c = new THREE.Vector3(), al = new THREE.Vector3(), sep = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (let i = 0; i < NB; i++) {
      const b = state[i];
      c.set(0, 0, 0); al.set(0, 0, 0); sep.set(0, 0, 0); let n = 0;
      for (let j = 0; j < NB; j++) {
        if (i === j) continue; const o = state[j];
        const d = b.p.distanceTo(o.p);
        if (d < 0.18) { c.add(o.p); al.add(o.v); n++; if (d < 0.05) sep.add(tmp.subVectors(b.p, o.p).multiplyScalar(1 / (d * d + 1e-4))); }
      }
      f.set(0, 0, 0);
      if (n) { c.multiplyScalar(1 / n).sub(b.p).multiplyScalar(1.2); al.multiplyScalar(1 / n).sub(b.v).multiplyScalar(1.5); f.add(c).add(al); }
      f.addScaledVector(sep, 0.0006);
      // orbite autour du cœur + évitement des planètes
      const r = b.p.length();
      f.add(tmp.set(-b.p.y, b.p.x, 0).normalize().multiplyScalar(0.6));
      f.addScaledVector(b.p, (0.75 - r) * 2.2 / Math.max(r, 0.1));
      f.z += -b.p.z * 2;
      if (r < 0.4) f.addScaledVector(b.p, (0.4 - r) * 30);
      b.v.addScaledVector(f, DT);
      const sp = b.v.length(); if (sp > 0.9) b.v.multiplyScalar(0.9 / sp); if (sp < 0.35) b.v.multiplyScalar(0.35 / Math.max(sp, 1e-4));
    }
    for (const b of state) b.p.addScaledVector(b.v, DT);
    time += DT;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, 1);
  function update(t, t0, show) {
    if (t < t0 || !show) { mesh.visible = false; return; }
    mesh.visible = true;
    if (!state || t < time - 1e-6) reset(t0);
    while (time + DT <= t + 1e-9) step(time);
    for (let i = 0; i < NB; i++) {
      const b = state[i];
      q.setFromUnitVectors(fwd, b.v.clone().normalize());
      const s = Math.min(1, (t - t0) * 2) * show;
      sc.set(s, s, s);
      m4.compose(b.p, q, sc); mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
}
