// Phase 5 — Complexité : fractale raymarchée, remplacement sur les temps, physarum, attracteur, iris.
import { THREE, W, H, rt, pass, renderer, clearRT, additive, over } from '../gl.js';
import { NOISE, COLOR } from '../glsl.js';
import { PAL_GLSL, palVec, GX, GY } from './matter.js';
import { rng } from '../rng.js';

// Styles de l'objet central (montage par remplacement)
export const STYLE = { FRACTAL: 0, CEL: 1, GLYPH: 2, PIXEL: 3, PARTICLE: 4, PENCIL: 5 };

export function createComplexity(atlas) {
  const scale = 0.75; // le raymarching est calculé à 75 % puis agrandi (encre recalculée plein cadre)
  const RW = Math.round(W * scale), RH = Math.round(H * scale);
  const fracRT = rt(RW, RH); // rgb + alpha (couverture)
  const auxRT = rt(RW, RH);  // normale + profondeur pour l'encre

  const MARCH = /* glsl */`
    uniform mat4 uCamMat; uniform float uFovT, uT, uStyle, uPower, uCoreI, uGlyphI, uCycle, uPop, uIris, uTq;
    uniform vec3 uCore; uniform sampler2D uAtlas; uniform vec3 uKey;
    uniform vec3 uPal[8];
    float gStyle;
    vec4 gTrap;
    float mandel(vec3 p){
      vec3 z=p; float dr=1., r=0.; vec4 tr=vec4(1e9);
      for(int i=0;i<7;i++){
        r=length(z); if(r>2.) break;
        float th=acos(clamp(z.z/r,-1.,1.)), ph=atan(z.y,z.x);
        dr=pow(r,uPower-1.)*uPower*dr+1.;
        float zr=pow(r,uPower); th*=uPower; ph*=uPower;
        z=zr*vec3(sin(th)*cos(ph),sin(th)*sin(ph),cos(th))+p;
        tr=min(tr,vec4(abs(z),dot(z,z)));
      }
      gTrap=tr;
      return .5*log(max(r,1e-6))*r/dr;
    }
    float map(vec3 p){
      float s=1.+uPop*.08;
      if(gStyle<.5) return mandel(p/(1.15*s))*1.15*s;
      return length(p)-1.02*s;
    }
    vec3 nrm(vec3 p, float e){ vec2 k=vec2(1.,-1.); return normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e)); }
  `;
  const pMarch = pass(MARCH + /* glsl */`
    uniform float uAux;
    vec3 palF(float i){ int k=int(clamp(floor(i+.5),0.,7.)); return uPal[k]*1.25; }
    vec3 fracCol(vec4 tr, float cyc){
      float a=clamp(tr.w*.6,0.,1.), b=clamp(tr.x*1.2,0.,1.);
      vec3 mag=vec3(.95,.12,.55), gold=vec3(1.,.72,.2), deep=vec3(.25,.03,.3);
      vec3 c=mix(deep, mag, smoothstep(.0,.5,a)); c=mix(c,gold,smoothstep(.35,.9,b));
      // cycle de palette sur les bandes du piège d'orbite
      float band=fract(a*4.-cyc);
      c*=.75+.5*smoothstep(.0,.08,band)*smoothstep(.3,.18,band);
      return c;
    }
    void main(){
      gStyle=uStyle;
      vec2 ndc=vUv*2.-1.;
      vec3 ro=(uCamMat*vec4(0.,0.,0.,1.)).xyz;
      vec3 rd=normalize((uCamMat*vec4(ndc.x*uFovT*uRes.x/uRes.y, ndc.y*uFovT, -1., 0.)).xyz);
      // intersection avec la sphère englobante
      float b=dot(ro,rd), c=dot(ro,ro)-1.5*1.5, h=b*b-c;
      vec3 col=vec3(0.); float alpha=0.; vec3 N=vec3(0.); float depth=1.;
      float glow=0.;
      if(h>0.){
        float t=max(-b-sqrt(h),0.), tmax=-b+sqrt(h);
        float d; int i; bool hit=false; float stp=0.;
        for(i=0;i<96;i++){
          vec3 p=ro+rd*t; d=map(p);
          glow+=exp(-length(p-uCore)*3.)*.012;
          if(d<.0012*t){ hit=true; break; }
          t+=d*.9; stp+=1.; if(t>tmax) break;
        }
        if(hit){
          vec3 p=ro+rd*t; N=nrm(p,.0015*t);
          vec3 L=normalize(uCore-p); float dl=length(uCore-p);
          float ndl=max(dot(N,L),0.), att=uCoreI/(1.+dl*dl*1.6);
          if(uStyle>.5){ ndl=max(dot(N,uKey),0.); att=1.15; } // objets de remplacement : lumière de trois-quarts
          vec3 V=-rd; float rim=pow(1.-max(dot(N,V),0.),3.);
          float ao=clamp(1.-stp/70.,0.,1.);
          if(uStyle<.5){
            vec3 base=fracCol(gTrap, uCycle);
            col=base*(.06+ndl*att*1.4)*mix(.35,1.,ao) + pow(max(dot(N,normalize(L+V)),0.),30.)*att*.5*vec3(1.,.85,.6) + rim*vec3(.9,.2,.6)*.25;
            // glyphes plaqués (projection triplanaire) : la matière est écrite
            if(uGlyphI>0.){
              vec3 an=abs(N); vec2 uvg = an.z>an.x&&an.z>an.y ? p.xy : (an.x>an.y ? p.yz : p.xz);
              vec2 cell=floor(uvg*40.); vec2 f=fract(uvg*40.);
              float gi=floor(hash12(cell+floor(uTq*3.))*10.);
              vec2 auv=(vec2(mod(gi,8.),floor(gi/8.))+vec2(f.x*.78+.11,1.-(f.y*.9+.05)))/8.; auv.y=1.-auv.y;
              float g=texture(uAtlas,auv).r;
              col+=g*uGlyphI*vec3(1.,.8,.4)*.35*ao*(.3+ndl);
            }
          } else if(uStyle<1.5){ // cel (phase 4)
            float lt=ndl*att;
            col = lt>.55 ? vec3(.55,.95,.18) : (lt>.18 ? vec3(.09,.42,.12) : vec3(.012,.05,.035));
            if(lt<=.18){ vec2 q=gl_FragCoord.xy/(uRes.y/100.); vec2 f=fract(mat2(.707,-.707,.707,.707)*q)-.5; col=mix(col,vec3(0.),step(length(f),.3)*.8); }
            float n=snoise(p*3.); col=mix(col,col*vec3(.75,.9,.6),step(.2,n)*.6);
          } else if(uStyle<2.5){ // glyphes (phase 3)
            vec2 cid=floor(gl_FragCoord.xy/(uRes.y/60.)); vec2 f=fract(gl_FragCoord.xy/(uRes.y/60.));
            float lt=clamp(ndl*att*1.2+.05,0.,1.);
            float gi=floor(lt*9.99);
            vec2 auv=(vec2(mod(gi,8.),floor(gi/8.))+vec2(f.x*.78+.11,1.-(f.y*.9+.05)))/8.; auv.y=1.-auv.y;
            float g=texture(uAtlas,auv).r;
            col=mix(palF(1.)*.5, palF(3.+lt*4.)*1.3, g);
          } else if(uStyle<3.5){ // pixel (phase 3) : blocs, palette, tramage
            float lt=clamp(ndl*att*1.2+.03,0.,1.);
            vec2 id=floor(gl_FragCoord.xy/(uRes.y/60.));
            int bx=int(mod(id.x,4.)), by=int(mod(id.y,4.));
            int bayer[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
            float th=(float(bayer[by*4+bx])+.5)/16.;
            float q=floor(pow(lt,.6)*7.+th);
            if(q>=2.&&q<=5.) q=2.+mod(q-2.+floor(uTq*8.),4.); col=palF(q);
          } else if(uStyle<4.5){ // particules (phase 2)
            vec3 sp=normalize(p); vec2 ll=vec2(atan(sp.y,sp.x),acos(sp.z));
            vec2 q=ll*vec2(40.,26.); vec2 id=floor(q); vec2 f=fract(q)-.5+ (hash22(id)-.5)*.6;
            float dot_=smoothstep(.22,.05,length(f))*step(.35,hash12(id+3.));
            col=heat(.2+.6*hash12(id))*dot_*(.4+ndl*att*1.8)*1.6;
          } else { // crayon (phase 1) : méridiens et parallèles tracés
            vec3 sp=normalize(p); vec2 ll=vec2(atan(sp.y,sp.x)/6.28318*18., acos(sp.z)/3.14159*9.);
            vec2 f=abs(fract(ll)-.5); vec2 fw=fwidth(ll);
            float line=max(smoothstep(fw.x*1.5,0.,.5-f.x-0.),smoothstep(fw.y*1.5,0.,.5-f.y));
            line=1.-min(smoothstep(0.,fw.x*1.6,.5-f.x), smoothstep(0.,fw.y*1.6,.5-f.y));
            col=mix(vec3(.01,.005,.02), vec3(.85,.8,1.)*1.3, line*(.4+.6*max(dot(N,V),0.)));
          }
          alpha=1.; depth=t/6.;
        }
      }
      // lueur du cœur qui fuit à travers les pores de la fractale
      col+=vec3(1.,.55,.8)*glow*uCoreI*(uStyle<.5?1.:.3);
      alpha=max(alpha, clamp(glow*2.,0.,1.)*.0);
      if(uAux>.5) fragColor=vec4(N*.5+.5, alpha>0.?depth:1.);
      else fragColor=vec4(col,alpha);
    }`, {
    uCamMat: { value: new THREE.Matrix4() }, uFovT: { value: 0.5 }, uT: { value: 0 }, uStyle: { value: 0 }, uPower: { value: 8 },
    uCoreI: { value: 2 }, uGlyphI: { value: 0 }, uCycle: { value: 0 }, uPop: { value: 0 }, uIris: { value: 0 }, uTq: { value: 0 },
    uCore: { value: new THREE.Vector3() }, uAtlas: { value: atlas }, uKey: { value: new THREE.Vector3() }, uPal: { value: palVec }, uAux: { value: 0 },
  });
  pMarch.u.uRes.value.set(RW, RH);

  // --- physarum : moisissure numérique (agents GPU), rejouée depuis son début ---
  const AN = 384, TW = 960, TH = 540;
  const agA = rt(AN, AN, { type: THREE.FloatType, filter: THREE.NearestFilter });
  const agB = rt(AN, AN, { type: THREE.FloatType, filter: THREE.NearestFilter });
  const trA = rt(TW, TH, { type: THREE.FloatType });
  const trB = rt(TW, TH, { type: THREE.FloatType });
  const pAgInit = pass(`void main(){ vec2 h=hash22(gl_FragCoord.xy*1.37+.5); float a=h.x*6.28318; float r=.04+.5*sqrt(h.y);
      fragColor=vec4(.5+cos(a)*r*9./16., .5+sin(a)*r, hash12(gl_FragCoord.xy+9.)*6.28318, 1.); }`, {});
  pAgInit.u.uRes.value.set(AN, AN);
  const pAgStep = pass(`uniform sampler2D uAg, uTr; uniform float uStep;
      float sens(vec2 p, float a, float off){ vec2 q=p+vec2(cos(a)*9./16.,sin(a))*off; return texture(uTr,q).r; }
      void main(){ vec4 s=texture(uAg,vUv); vec2 p=s.xy; float a=s.z;
        float sd=.018, sa=.6, ra=.45, sp=.0011;
        float f=sens(p,a,sd), l=sens(p,a+sa,sd), r=sens(p,a-sa,sd);
        float rnd=hash13(vec3(gl_FragCoord.xy,uStep));
        if(f>l&&f>r){} else if(f<l&&f<r) a+=(rnd-.5)*2.*ra; else if(l>r) a+=ra; else a-=ra;
        p+=vec2(cos(a)*9./16.,sin(a))*sp;
        if(p.x<0.||p.x>1.||p.y<0.||p.y>1.){ a+=3.14159; p=clamp(p,0.,1.); }
        fragColor=vec4(p,a,1.); }`, { uAg: { value: null }, uTr: { value: null }, uStep: { value: 0 } });
  pAgStep.u.uRes.value.set(AN, AN);
  const pDiff = pass(`uniform sampler2D uTr; void main(){ vec2 px=1./vec2(${TW}.,${TH}.); float s=0.;
      for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++) s+=texture(uTr,vUv+vec2(i,j)*px).r;
      fragColor=vec4(mix(texture(uTr,vUv).r,s/9.,.6)*.86,0.,0.,1.); }`, { uTr: { value: null } });
  pDiff.u.uRes.value.set(TW, TH);
  // dépôt : chaque agent dessine un point dans la carte de traces
  const idx = new Float32Array(AN * AN * 2);
  for (let i = 0; i < AN * AN; i++) { idx[i * 2] = (i % AN + 0.5) / AN; idx[i * 2 + 1] = (Math.floor(i / AN) + 0.5) / AN; }
  const depGeo = new THREE.BufferGeometry();
  depGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AN * AN * 3), 3));
  depGeo.setAttribute('aIdx', new THREE.BufferAttribute(idx, 2));
  const depMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: { uAg: { value: null } }, blending: THREE.AdditiveBlending, transparent: true, depthTest: false,
    vertexShader: `in vec2 aIdx; uniform sampler2D uAg; void main(){ vec2 p=texture(uAg,aIdx).xy; gl_Position=vec4(p*2.-1.,0.,1.); gl_PointSize=1.; }`,
    fragmentShader: `precision highp float; out vec4 o; void main(){ o=vec4(.016,0.,0.,1.); }`,
  });
  const depPts = new THREE.Points(depGeo, depMat); depPts.frustumCulled = false;
  const depScene = new THREE.Scene(); depScene.add(depPts);
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let phSteps = -1, agSrc = agA, agDst = agB, trSrc = trA, trDst = trB;
  function advancePhysarum(t, t0) {
    const target = t < t0 ? -1 : Math.floor((t - t0) * 12) * 6;
    if (target < 0) return;
    if (phSteps < 0 || target < phSteps) {
      pAgInit.render(agA); clearRT(trA); clearRT(trB); agSrc = agA; agDst = agB; trSrc = trA; trDst = trB; phSteps = 0;
    }
    while (phSteps < target) {
      pAgStep.u.uAg.value = agSrc.texture; pAgStep.u.uTr.value = trSrc.texture; pAgStep.u.uStep.value = phSteps; pAgStep.render(agDst);
      [agSrc, agDst] = [agDst, agSrc];
      depMat.uniforms.uAg.value = agSrc.texture;
      renderer.setRenderTarget(trSrc); renderer.render(depScene, orthoCam);
      pDiff.u.uTr.value = trSrc.texture; pDiff.render(trDst); [trSrc, trDst] = [trDst, trSrc];
      phSteps++;
    }
  }

  // --- attracteur étrange (Aizawa), intégré une fois (RK4), tracé progressivement ---
  const attr = [];
  { let x = 0.1, y = 0, z = 0; const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1, dt = 0.01;
    const F = (x, y, z) => [(z - b) * x - d * y, d * x + (z - b) * y, c + a * z - z * z * z / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x];
    for (let i = 0; i < 26000; i++) {
      const k1 = F(x, y, z), k2 = F(x + k1[0] * dt / 2, y + k1[1] * dt / 2, z + k1[2] * dt / 2);
      const k3 = F(x + k2[0] * dt / 2, y + k2[1] * dt / 2, z + k2[2] * dt / 2), k4 = F(x + k3[0] * dt, y + k3[1] * dt, z + k3[2] * dt);
      x += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); z += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      if (i > 300) attr.push([x, y, z - 0.6]);
    }
  }
  const acv = document.createElement('canvas'); acv.width = W; acv.height = H;
  const actx = acv.getContext('2d');
  const atex = new THREE.CanvasTexture(acv); atex.colorSpace = THREE.NoColorSpace; atex.generateMipmaps = false; atex.minFilter = THREE.LinearFilter;
  function drawAttractor(draw, rot, boil, alpha) {
    actx.clearRect(0, 0, W, H);
    if (alpha <= 0.001) { atex.needsUpdate = true; return; }
    const n = Math.floor(attr.length * draw);
    const S = H * 0.36, cx = W / 2, cy = H / 2;
    const ca = Math.cos(rot), sa = Math.sin(rot), cb = Math.cos(0.9), sb = Math.sin(0.9);
    const r = rng(900 + boil);
    actx.lineWidth = 1.1 * H / 1080; actx.lineJoin = 'round';
    for (let pass_ = 0; pass_ < 2; pass_++) {
      actx.beginPath();
      const jx = (r() - 0.5) * 2.5 * H / 1080, jy = (r() - 0.5) * 2.5 * H / 1080;
      for (let i = 0; i < n; i += 2) {
        const [x, y, z] = attr[i];
        const X = x * ca - y * sa, Y = x * sa + y * ca;
        const Y2 = Y * cb - z * sb;
        const px = cx + X * S + jx, py = cy - Y2 * S * 0.9 + jy;
        if (i === 0) actx.moveTo(px, py); else actx.lineTo(px, py);
      }
      actx.strokeStyle = pass_ ? `rgba(255,200,90,${0.16 * alpha})` : `rgba(255,215,120,${0.36 * alpha})`;
      actx.stroke();
    }
    atex.needsUpdate = true;
  }

  // --- composition de la phase 5 ---
  const pComp = pass(/* glsl */`
    uniform sampler2D uFrac, uAux, uTrail, uAttr, uAtlas; uniform float uT, uTq, uInk, uBoil, uPhys, uSpores, uIris, uContract, uAttrI, uBgI;
    uniform vec2 uCoreS; uniform vec3 uBgA, uBgB; uniform float uBeat;
    vec4 A(vec2 uv){ return texture(uAux,uv); }
    void main(){
      float asp=uRes.x/uRes.y;
      vec2 q=(vUv*2.-1.)*vec2(asp,1.)-uCoreS*vec2(asp,1.);
      float r=length(q), th=atan(q.y,q.x);
      // fond : dégradé + réseau physarum (magenta/or) avec parallaxe
      vec3 bg=mix(uBgB,uBgA,smoothstep(1.6,0.,r));
      vec2 tuv=(vUv-.5)*.92+.5;
      float tr=texture(uTrail,tuv).r;
      bg+=mix(vec3(.6,.05,.4),vec3(1.,.7,.3),smoothstep(.25,.6,tr))*smoothstep(.04,.35,tr)*uPhys*.8;
      bg*=uBgI;
      // attracteur (tracé or)
      vec4 at=texture(uAttr,vUv); bg+=at.rgb*at.a*uAttrI*1.5;
      // fractale / objet central
      vec4 f=texture(uFrac,vUv);
      vec3 c=mix(bg,f.rgb,f.a);
      c+=f.rgb*(1.-f.a); // lueur additive
      // encre sur la fractale (normales + profondeur), trait vivant à 12 i/s
      if(uInk>0.){
        vec2 px=1.6/uRes*(uRes.y/1080.);
        vec2 j=vec2(snoise(vec3(vUv*7.,uBoil)),snoise(vec3(vUv*7.+5.,uBoil)))*px*.9;
        vec2 uv=vUv+j;
        vec4 a=A(uv+vec2(px.x,0)), b=A(uv-vec2(px.x,0)), cc=A(uv+vec2(0,px.y)), d=A(uv-vec2(0,px.y));
        float e=length(a.rgb-b.rgb)+length(cc.rgb-d.rgb);
        float dz=abs(a.a-b.a)+abs(cc.a-d.a);
        e=smoothstep(.35,.8,e)+smoothstep(.004,.02,dz);
        c=mix(c,vec3(.02,.0,.02),clamp(e,0.,1.)*uInk);
      }
      // spores : points qui dérivent depuis le cœur
      if(uSpores>0.){
        vec2 g=vec2(th/6.28318*90., log(r+.02)*14.-uT*5.);
        vec2 id=floor(g); vec2 fr=fract(g)-.5+(hash22(id)-.5)*.7;
        float s=smoothstep(.12,.0,length(fr*vec2(1.,.6)))*step(.82,hash12(id+7.));
        c+=vec3(1.,.8,.5)*s*uSpores*smoothstep(.15,.4,r)*1.5;
      }
      // les veines du physarum courent aussi sur la fractale (tout se mélange)
      c+=mix(vec3(.9,.1,.6),vec3(1.,.8,.3),smoothstep(.25,.6,tr))*smoothstep(.12,.45,tr)*uPhys*.22*f.a;
      // iris : fibres radiales, cryptes, collerette, limbe ; la pupille se contracte quand la lumière arrive
      if(uIris>0.){
        float R=.58, pr=mix(.19,.05,uContract)*(1.+.07*exp(-fract(uBeat)*5.));
        vec2 cs=vec2(cos(th),sin(th));
        float fA=snoise(vec3(cs*9.,r*1.5+uTq*.05))*.5+.5;
        float fB=snoise(vec3(cs*38.,r*2.5+3.))*.5+.5;
        float fC=snoise(vec3(cs*90.,r*4.+7.))*.5+.5;
        float fib=fA*.4+fB*.35+fC*.25;
        float rn=(r-pr)/(R-pr);
        vec3 ic=mix(vec3(1.,.72,.22),vec3(.92,.16,.52),smoothstep(.05,.45,rn));
        ic=mix(ic,vec3(.32,.04,.38),smoothstep(.55,1.,rn));
        ic*=.45+.9*fib;
        float collar=pr*1.75+.02*snoise(vec3(cs*4.,2.));
        ic+=vec3(1.,.75,.35)*smoothstep(.03,0.,abs(r-collar))*.7;
        float crypt=smoothstep(.62,.72,snoise(vec3(cs*7.,rn*3.+11.))*.5+.5)*smoothstep(.2,.35,rn)*smoothstep(.9,.7,rn);
        ic*=1.-crypt*.75;
        ic=mix(ic,vec3(.04,0.,.05),smoothstep(.82,1.,rn));
        ic*=.85+.3*luma(f.rgb); // la structure de la fractale transparaît
        float a=smoothstep(R+.05,R-.01,r)*uIris;
        c=mix(c,ic,a);
        float pupil=smoothstep(pr+.006,pr-.006,r);
        c=mix(c,vec3(.0,.0,.004),pupil*uIris);
        // reflet de fenêtre (humide)
        vec2 hq=q-vec2(-.16,.15)*R; c+=vec3(1.)*smoothstep(.045,.0,length(hq*vec2(1.,1.3)))*.5*uIris;
      }
      fragColor=vec4(c,1.);
    }`, {
    uFrac: { value: fracRT.texture }, uAux: { value: auxRT.texture }, uTrail: { value: null }, uAttr: { value: atex }, uAtlas: { value: atlas },
    uT: { value: 0 }, uTq: { value: 0 }, uInk: { value: 1 }, uBoil: { value: 0 }, uPhys: { value: 0 }, uSpores: { value: 0 },
    uIris: { value: 0 }, uContract: { value: 0 }, uAttrI: { value: 0 }, uBgI: { value: 1 }, uCoreS: { value: new THREE.Vector2() },
    uBeat: { value: 0 }, uBgA: { value: new THREE.Vector3(0.12, 0.01, 0.1) }, uBgB: { value: new THREE.Vector3(0.01, 0.0, 0.015) },
  });

  const cam = new THREE.PerspectiveCamera(40, W / H, 0.01, 50);
  function render(t, P, target) {
    const tq = P.tq;
    cam.fov = P.fcam.fov; cam.position.copy(P.fcam.pos); cam.up.copy(P.fcam.up); cam.lookAt(P.fcam.target); cam.updateMatrixWorld();
    const u = pMarch.u;
    u.uCamMat.value.copy(cam.matrixWorld); u.uFovT.value = Math.tan(cam.fov / 2 * Math.PI / 180);
    u.uT.value = t; u.uTq.value = tq; u.uStyle.value = P.style; u.uPower.value = P.power; u.uCoreI.value = P.fCoreI;
    u.uGlyphI.value = P.glyphI; u.uCycle.value = tq * 0.8; u.uPop.value = P.pop;
    // le cœur flotte juste devant l'objet central, sur l'axe de la caméra
    const cdir = cam.position.clone().normalize();
    u.uCore.value.copy(cdir.multiplyScalar(P.coreOff));
    const e = cam.matrixWorld.elements; // lumière clé : en haut à gauche, légèrement de face
    u.uKey.value.set(-0.62 * e[0] + 0.55 * e[4] + 0.56 * e[8], -0.62 * e[1] + 0.55 * e[5] + 0.56 * e[9], -0.62 * e[2] + 0.55 * e[6] + 0.56 * e[10]).normalize();
    u.uAux.value = 0; pMarch.render(fracRT);
    u.uAux.value = 1; pMarch.render(auxRT);
    advancePhysarum(t, P.physT0);
    drawAttractor(P.attrDraw, tq * 0.35, Math.floor(tq * 12), P.attrI);
    const c = pComp.u;
    c.uTrail.value = trSrc.texture; c.uT.value = t; c.uTq.value = tq; c.uBoil.value = Math.floor(tq * 12) * 0.71;
    c.uPhys.value = P.phys; c.uSpores.value = P.spores; c.uIris.value = P.iris; c.uContract.value = P.contract; c.uAttrI.value = P.attrI;
    c.uInk.value = P.fInk; c.uBgI.value = P.bgI; c.uBeat.value = P.beat;
    const v = u.uCore.value.clone().project(cam);
    c.uCoreS.value.set(v.x, v.y);
    pComp.render(target, true);
    return { coreNdc: v, cam };
  }
  return { render, cam, fracRT };
}
