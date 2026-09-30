// Phase 3 — Matière : refroidissement, quantification, tramage, pixel-sort, réaction-diffusion, glyphes, anneaux de texte.
import { pass, rt, W, H, THREE, renderer, clearRT } from '../gl.js';
import { T, beatTime } from '../tempo.js';

export const GX = 160, GY = 90; // grille de cellules (12 px en 1080p)

// Palette cyan à 8 couleurs (du plus sombre au plus clair)
export const PALETTE = ['#02040c', '#06142a', '#0a2a4a', '#0b4f73', '#0c7fa0', '#22b8d0', '#7ae8f0', '#e8ffff'];
export const palVec = PALETTE.map((h) => { const c = new THREE.Color(h); return new THREE.Vector3(Math.pow(c.r, 2.2), Math.pow(c.g, 2.2), Math.pow(c.b, 2.2)); });
// linéarisation approximative (les couleurs hex sont pensées en sRGB)
export const PAL_GLSL = /* glsl */`
uniform vec3 uPal[8];
vec3 pal(float i){ int k=int(clamp(floor(i+.5),0.,7.)); return uPal[k]*1.25; }`;

// Glyphes : rampe de densité (index 0..9), orientations (10..13), texte et symboles.
export const GLYPHS = ' .·:+*10#@-/|\\GRAINE0123456789ABCDEFx∅<>{}[]()=;%$&!?~^_';
const ATLAS_N = 8; // 8×8 = 64 cases

function makeAtlas() {
  const s = 96, cv = document.createElement('canvas');
  cv.width = cv.height = s * ATLAS_N;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${s * 0.86}px JB`;
  [...GLYPHS].forEach((ch, i) => {
    const x = (i % ATLAS_N) * s + s / 2, y = Math.floor(i / ATLAS_N) * s + s / 2 + s * 0.04;
    if (ch === '·') { g.beginPath(); g.arc(x, y, s * 0.09, 0, 7); g.fill(); return; }
    g.fillText(ch, x, y);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}
export const gi = (ch) => [...GLYPHS].indexOf(ch);

export function createMatter() {
  const atlas = makeAtlas();
  const cellRT = rt(GX, GY, { filter: THREE.NearestFilter, type: THREE.FloatType });
  const dataRT = rt(GX, GY, { filter: THREE.NearestFilter, type: THREE.FloatType });
  const rdA = rt(GX, GY, { filter: THREE.NearestFilter, type: THREE.FloatType });
  const rdB = rt(GX, GY, { filter: THREE.NearestFilter, type: THREE.FloatType });
  const COOL = /* glsl */`
    uniform vec3 uCool; uniform float uT; uniform vec2 uCore;
    float distCore(vec2 uv){ float a=uRes.x/uRes.y; vec2 q=(uv*2.-1.)*vec2(a,1.)-uCore*vec2(a,1.); return length(q); }
    float frontAt(float t){ float p=clamp((t-uCool.x)/(uCool.y-uCool.x),0.,1.); float e=1.-(1.-p)*(1.-p); return uCool.z*(1.-e); }
    // 0 = chaud, 1 = complètement refroidi (depuis un moment)
    float coolness(float d){ if(uT<uCool.x) return 0.; float f=frontAt(uT); return clamp((d-f)/.35,0.,1.); }
  `;
  const common = { uCool: { value: new THREE.Vector3() }, uT: { value: 0 }, uCore: { value: new THREE.Vector2() }, uPal: { value: palVec } };

  // 1. moyenne du monde par cellule (160×90)
  const pCell = pass(`uniform sampler2D uTex; void main(){
      vec2 cs=1./vec2(${GX}.,${GY}.); vec3 c=vec3(0.);
      for(int i=0;i<4;i++)for(int j=0;j<4;j++) c+=texture(uTex,vUv+(vec2(i,j)-1.5)/4.*cs).rgb;
      fragColor=vec4(c/16.,1.); }`, { uTex: { value: null } });

  // 2. réaction-diffusion (Gray-Scott) sur la grille de cellules
  const pRDSeed = pass(`uniform sampler2D uCell; void main(){
      float l=luma(texture(uCell,vUv).rgb);
      float s=step(.55,l)*step(.5,hash12(floor(vUv*vec2(${GX}.,${GY}.))));
      fragColor=vec4(1.,s,0.,1.); }`, { uCell: { value: null } });
  const pRD = pass(`uniform sampler2D uS; uniform float uF, uK; void main(){
      vec2 px=1./vec2(${GX}.,${GY}.);
      vec2 c=texture(uS,vUv).rg;
      vec2 lap=-c + .2*(texture(uS,vUv+vec2(px.x,0)).rg+texture(uS,vUv-vec2(px.x,0)).rg+texture(uS,vUv+vec2(0,px.y)).rg+texture(uS,vUv-vec2(0,px.y)).rg)
        + .05*(texture(uS,vUv+px).rg+texture(uS,vUv-px).rg+texture(uS,vUv+vec2(px.x,-px.y)).rg+texture(uS,vUv+vec2(-px.x,px.y)).rg);
      float r=c.r*c.g*c.g;
      float u=c.r+(1.*lap.r - r + uF*(1.-c.r));
      float v=c.g+(.5*lap.g + r - (uK+uF)*c.g);
      fragColor=vec4(clamp(u,0.,1.),clamp(v,0.,1.),0.,1.); }`, { uS: { value: null }, uF: { value: 0.0367 }, uK: { value: 0.0649 } });

  // 3. sélection des glyphes et de la couleur par cellule → dataRT (glyphe, palette, lum, papillonnement)
  const pData = pass(COOL + PAL_GLSL + /* glsl */`
    uniform sampler2D uCell, uRD; uniform float uRDI, uGlyphT0, uGlyphT1, uCycle, uRings, uZero, uRingRot, uTime24;
    uniform float uRingStr[4]; uniform float uRingLen[4];
    uniform sampler2D uRingTxt;
    float lumAt(vec2 uv){ vec3 c=texture(uCell,uv).rgb; float l=luma(c); float rd=texture(uRD,uv).g; return l*1.3 + min(rd*uRDI*1.4,.55); }
    void main(){
      vec2 g=vec2(${GX}.,${GY}.); vec2 id=floor(vUv*g); vec2 px=1./g;
      float l=lumAt(vUv);
      // indice de palette (tramage Bayer 4×4 au niveau des cellules)
      int bx=int(mod(id.x,4.)), by=int(mod(id.y,4.));
      int bayer[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
      float th=(float(bayer[by*4+bx])+.5)/16.;
      float lv=pow(clamp(l*1.6,0.,1.2),.5)*7.;
      float pi=floor(lv+th-.5+.5);
      // cycle de palette (façon démoscène) sur les tons moyens, par vagues
      // les tons moyens (3..5) tournent entre eux, en vagues qui s'écoulent (pas de scintillement global)
      float ph = (sin(id.x*.21+id.y*.13)*.5+.5)*3. + (sin(id.x*.07-id.y*.11)*.5+.5)*2.;
      if(uCycle>.01 && pi>=3. && pi<=5.) pi = 3.+mod(pi-3.+floor(uT*4.+ph),3.);
      pi=clamp(pi,0.,7.);
      // gradient local → orientation du glyphe
      float gx=lumAt(vUv+vec2(px.x,0))-lumAt(vUv-vec2(px.x,0));
      float gy=lumAt(vUv+vec2(0,px.y))-lumAt(vUv-vec2(0,px.y));
      float gm=length(vec2(gx,gy));
      float glyph;
      float dens=clamp(l*1.25,0.,.999);
      glyph=floor(dens*10.); // 0..9 : ' .·:+*10#@'
      if(gm>.22 && l>.12){
        float a=mod(atan(gy,gx)+3.14159*.125,3.14159); // orientation du bord ; le glyphe suit la tangente
        float o=floor(a/(3.14159*.25));
        glyph = o<.5 ? 12. : (o<1.5 ? 13. : (o<2.5 ? 10. : 11.)); // | \\ - / (tangente au bord)
      }
      // onde de papillonnement depuis le cœur
      float d=distCore(vUv);
      float tf=mix(uGlyphT0,uGlyphT1,clamp(d/1.9,0.,1.));
      float flip=clamp((uT-tf)/.3,0.,1.);
      if(uT>tf-.05 && flip<1.){ glyph=floor(hash13(vec3(id,uTime24))*40.)+14.; }
      float show=step(tf-.05,uT);
      // anneaux de texte autour du cœur
      if(uRings>0.){
        float asp=uRes.x/uRes.y; // uRes = taille de la grille ici, on travaille en unités écran
        vec2 q=(((id+.5)/g)*2.-1.)*vec2(16./9.,1.)-uCore*vec2(16./9.,1.);
        vec2 qz=q; qz.y/=1.+.42*uZero; qz.x*=1.-.08*uZero; // l'anneau s'étire en « 0 »
        float r=length(qz), th2=atan(qz.y,qz.x);
        for(int k=0;k<4;k++){
          float R=uRingStr[k]; float cw=2./${GY}.;
          float band=abs(r-R);
          if(band<cw*.55 && uRings>float(k)*.25){
            float dir = mod(float(k),2.)<.5 ? 1. : -1.;
            float u=fract((th2/6.28318)+dir*uRingRot*(.6+.25*float(k)));
            float len=uRingLen[k];
            float ci=floor(u*len);
            glyph=texture(uRingTxt,vec2((ci+.5)/256.,(float(k)+.5)/4.)).r*255.;
            pi=7.-float(k)*.5; show=1.; l=max(l,.9);
          }
        }
        // barre oblique du zéro barré (∅)
        if(uZero>.01){
          vec2 qq=q; float s=abs(qq.x*.8-qq.y*.6+0.)/1.;
          float ext=length(qq);
          if(s<1.2/${GY}. && ext<uRingStr[1]*1.1*uZero){ glyph=float(${gi('/')}); pi=7.; show=1.; l=1.; }
        }
      }
      fragColor=vec4(glyph, pi, l, show>.5 ? 1.+(1.-flip)*step(tf-.05,uT) : 0.);
    }`, {
    ...common, uCell: { value: cellRT.texture }, uRD: { value: rdA.texture }, uRDI: { value: 0 },
    uGlyphT0: { value: 0 }, uGlyphT1: { value: 0 }, uCycle: { value: 0 }, uRings: { value: 0 }, uZero: { value: 0 },
    uRingRot: { value: 0 }, uTime24: { value: 0 }, uRingStr: { value: [0.3, 0.46, 0.64, 0.86] }, uRingLen: { value: [24, 36, 48, 60] },
    uRingTxt: { value: null },
  });
  pData.u.uRes.value.set(GX, GY);

  // 4. image finale de la phase : monde lisse → blocs → palette → glyphes
  const pCompose = pass(COOL + PAL_GLSL + /* glsl */`
    uniform sampler2D uWorld, uCell, uData, uAtlas; uniform float uGlyphMix, uBgDim, uSortI, uCellPx, uHeat, uZoom;
    vec3 blockAvg(vec2 uv, float b){
      vec2 fc=uv*uRes; vec2 c0=(floor(fc/b))*b; vec3 s=vec3(0.);
      for(int i=0;i<3;i++)for(int j=0;j<3;j++) s+=texture(uWorld,(c0+(vec2(i,j)+.5)/3.*b)/uRes).rgb;
      return s/9.;
    }
    void main(){
      vec2 uvz=.5+(vUv-.5)/uZoom; // lente poussée caméra dans la matière
      float d=distCore(uvz);
      float k=coolness(d);
      vec3 hot=texture(uWorld,uvz).rgb;
      // pixel-sort sur le front : traînées radiales des pixels les plus lumineux
      float f=frontAt(uT);
      float band=smoothstep(.16,0.,abs(d-f))*step(uCool.x,uT)*step(uT,uCool.y+.3)*uSortI;
      if(band>0.){
        float asp=uRes.x/uRes.y; vec2 dir=normalize((uvz*2.-1.)*vec2(asp,1.)-uCore*vec2(asp,1.)+1e-5)/vec2(asp,1.)*.5;
        vec2 cell=floor(uvz*uRes/uCellPx);
        float len=(.03+.1*hash12(cell.yy+floor(uT*12.)))*band;
        vec3 m=hot;
        for(int i=1;i<14;i++){ vec3 s=texture(uWorld,uvz-dir*len*float(i)/13.).rgb; if(luma(s)>luma(m)) m=s; }
        hot=mix(hot,m,band);
      }
      // quantification progressive de la résolution : 1 → 2 → 3 → 4 → 6 → 12 px (grilles emboîtées)
      float lv=floor(k*5.999);
      float b = lv<1.?1.:(lv<2.?2.:(lv<3.?3.:(lv<4.?4.:(lv<5.?6.:12.))));
      b*=uCellPx/12.;
      vec3 blk = b<=1. ? hot : blockAvg(uvz,b);
      // palette : 256 niveaux → 8 couleurs cyan, avec tramage
      vec4 dat=texture(uData,uvz);
      float lum=luma(blk);
      vec2 pxid=floor(uvz*uRes/max(b,1.));
      int bx=int(mod(pxid.x,4.)), by=int(mod(pxid.y,4.));
      int bayer[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
      float th=(float(bayer[by*4+bx])+.5)/16.;
      float levels=mix(64.,7.,smoothstep(.3,1.,k));
      float q=floor(pow(clamp(lum*1.6,0.,1.2),.5)*levels+th)/levels*7.;
      vec3 cold = k>=.999 ? pal(dat.g) : pal(q);
      // le chaud vire au froid : décalage de teinte avant la quantification
      vec3 col = mix(hot*uHeat, cold, smoothstep(0.,.35,k));
      // glyphes
      if(uGlyphMix>0. && dat.a>.5){
        vec2 cuv=fract(uvz*vec2(${GX}.,${GY}.));
        float gidx=dat.r;
        vec2 auv=(vec2(mod(gidx,8.),floor(gidx/8.))+vec2(cuv.x*.78+.11,1.-(cuv.y*.9+.05)))/8.;
        auv.y=1.-auv.y;
        float a=texture(uAtlas,auv).r;
        vec3 fg=pal(min(dat.g+1.,7.))*1.4*(1.+2.5*max(dat.a-1.,0.));
        vec3 bg=pal(dat.g)*(1.-uBgDim)*mix(.9,.35,step(5.5,dat.g));
        col=mix(col, mix(bg,fg,a), uGlyphMix);
      }
      float ring=exp(-pow((d-f)/.006,2.))*step(uCool.x,uT)*(1.-smoothstep(uCool.y-.2,uCool.y+.2,uT));
      col+=vec3(.5,1.,1.2)*ring*1.6;
      fragColor=vec4(col,1.);
    }`, { ...common, uWorld: { value: null }, uCell: { value: cellRT.texture }, uData: { value: dataRT.texture }, uAtlas: { value: atlas },
    uGlyphMix: { value: 0 }, uBgDim: { value: 0 }, uSortI: { value: 1 }, uCellPx: { value: H / GY }, uHeat: { value: 1 }, uZoom: { value: 1 } });

  // texte des anneaux → texture 64×4 (indices de glyphes)
  const RINGS = ['GRAINE 0 · ', '01000111 01010010 0 · ', 'SEED=0x00 · f(t) · ∅ · ', '0123456789ABCDEF · {∅} · <0> · '];
  const ringData = new Uint8Array(256 * 4 * 4);
  const lens = [];
  RINGS.forEach((str, k) => {
    const R = [0.3, 0.46, 0.64, 0.86][k];
    const full = [...str.repeat(20)].slice(0, Math.round(2 * Math.PI * R * GY / 2)); // un caractère par cellule
    lens.push(full.length);
    full.forEach((ch, i) => { const id = Math.max(gi(ch === ' ' ? ' ' : ch), 0); ringData[(k * 256 + i) * 4] = id; ringData[(k * 256 + i) * 4 + 3] = 255; });
  });
  const ringTex = new THREE.DataTexture(ringData, 256, 4, THREE.RGBAFormat);
  ringTex.minFilter = ringTex.magFilter = THREE.NearestFilter; ringTex.needsUpdate = true;
  pData.u.uRingTxt.value = ringTex;
  pData.u.uRingLen.value = lens;

  // --- réaction-diffusion : état rejoué de façon déterministe ---
  let rdSteps = -1, rdSrc = rdA, rdDst = rdB;
  const STEPS_PER_FRAME = 10;
  function advanceRD(t, seedWorldTex) {
    const target = t < T.chem ? -1 : Math.floor((Math.min(t, T.glyphDone) - T.chem) * 24) * STEPS_PER_FRAME;
    if (target < 0) { rdSteps = -1; clearRT(rdA, 1, 0, 0, 1); pData.u.uRD.value = rdA.texture; rdSrc = rdA; rdDst = rdB; return; }
    if (rdSteps < 0 || target < rdSteps) {
      // semis à partir de la matière figée (état au début de la chimie)
      pRDSeed.u.uCell.value = seedWorldTex; pRDSeed.render(rdA); rdSrc = rdA; rdDst = rdB; rdSteps = 0;
    }
    while (rdSteps < target) {
      pRD.u.uS.value = rdSrc.texture; pRD.render(rdDst); [rdSrc, rdDst] = [rdDst, rdSrc]; rdSteps++;
    }
    pData.u.uRD.value = rdSrc.texture;
  }

  function setCommon(P, t) {
    for (const p of [pData, pCompose]) {
      p.u.uT.value = t; p.u.uCool.value.set(T.cool, T.frozen, 2.25); p.u.uCore.value.copy(P.corePos);
    }
  }

  // worldTex : image HDR du monde (nébuleuse + particules). Écrit le résultat dans target.
  function render(t, P, worldTex, target, seedCell, zoom = 1) {
    setCommon(P, t);
    pCell.u.uTex.value = worldTex; pCell.render(cellRT);
    advanceRD(t, seedCell || cellRT.texture);
    const d = pData.u;
    d.uRDI.value = P.rdI; d.uGlyphT0.value = T.glyph; d.uGlyphT1.value = T.glyph + 1.6;
    d.uCycle.value = P.cycle; d.uRings.value = P.rings; d.uZero.value = P.zero; d.uRingRot.value = P.ringRot;
    d.uTime24.value = Math.floor(t * 24);
    pData.render(dataRT);
    const c = pCompose.u;
    c.uZoom.value = zoom; c.uWorld.value = worldTex; c.uGlyphMix.value = P.glyphMix; c.uBgDim.value = P.bgDim; c.uHeat.value = P.heat;
    pCompose.render(target, true);
  }
  const seedRT = rt(GX, GY, { filter: THREE.NearestFilter, type: THREE.FloatType });
  let seeded = false;
  function cellFrom(tex) { if (seeded) return; pCell.u.uTex.value = tex; pCell.render(seedRT); seeded = true; }
  return { render, cellRT, dataRT, atlas, pData, advanceRD, cellFrom, get seedTex() { return seedRT.texture; }, get seeded() { return seeded; } };
}
