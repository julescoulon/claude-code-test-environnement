// Orchestration de la phase 4 : caméra, fond, scène 3D, encre, cœur masqué par la profondeur.
import { THREE, W, H, rt, pass, renderer, clearRT, additive } from '../gl.js';
import { T, beatTime, beatAt, pulse } from '../tempo.js';
import { clamp, remap, smooth, easeInOut, easeOut, lerp, spring, anticipate } from '../anim.js';
import { noise1 } from '../rng.js';
import { createWorld3D, PLANETS, planetPos } from './world3d.js';
import { palVec } from './matter.js';

const D = 1 / Math.tan((35 / 2) * Math.PI / 180);

export function createStructures(atlas) {
  const w3 = createWorld3D(atlas, { value: palVec });
  const cam = new THREE.PerspectiveCamera(35, W / H, 0.005, 60);
  const s3dRT = rt(W, H, { depth: true });
  const nrmRT = rt(W, H, { depth: true });

  const bg = pass(/* glsl */`
    uniform vec3 uTop, uBot; uniform float uStars, uT; uniform vec2 uAng;
    void main(){
      vec3 c=mix(uBot,uTop,smoothstep(0.,1.,vUv.y));
      vec2 q=(vUv+uAng)*vec2(uRes.x/uRes.y,1.)*90.;
      vec2 id=floor(q); float h=hash12(id);
      if(h>.985){ vec2 f=fract(q)-.5; c+=uStars*vec3(.7,1.,.6)*smoothstep(.25,0.,length(f))*(h-.985)*60.*(.6+.4*sin(uT*3.+h*50.)); }
      fragColor=vec4(c,1.);
    }`, { uTop: { value: new THREE.Vector3() }, uBot: { value: new THREE.Vector3() }, uStars: { value: 0 }, uT: { value: 0 }, uAng: { value: new THREE.Vector2() } });

  // Encre : détection de bords sur normales + profondeur, trait légèrement vivant.
  const ink = pass(/* glsl */`
    uniform sampler2D uScene, uNrm; uniform float uInk, uWidth, uBoil, uFront; uniform vec3 uInkCol; uniform vec2 uCore;
    vec4 N(vec2 uv){ return texture(uNrm,uv); }
    void main(){
      vec3 c=texture(uScene,vUv).rgb;
      if(uInk>0.){
        vec2 px=uWidth/uRes;
        vec2 j=(vec2(snoise(vec3(vUv*8.,uBoil)),snoise(vec3(vUv*8.+9.,uBoil)))) *px*.8;
        vec2 uv=vUv+j;
        vec4 a=N(uv+vec2(px.x,0)), b=N(uv-vec2(px.x,0)), cc=N(uv+vec2(0,px.y)), d=N(uv-vec2(0,px.y)), m=N(uv);
        float e=length(a.rgb-b.rgb)+length(cc.rgb-d.rgb);
        float dz=abs(a.a-b.a)+abs(cc.a-d.a);
        float has=step(.001,m.a+a.a+b.a);
        e=smoothstep(.25,.6,e) + smoothstep(.0008,.003,dz)*has;
        float asp=uRes.x/uRes.y; float dist=length((vUv*2.-1.)*vec2(asp,1.)-uCore*vec2(asp,1.));
        float front=smoothstep(uFront,uFront-.15,dist);
        c=mix(c,uInkCol,clamp(e,0.,1.)*uInk*front);
      }
      fragColor=vec4(c,1.);
    }`, { uScene: { value: s3dRT.texture }, uNrm: { value: nrmRT.texture }, uInk: { value: 0 }, uWidth: { value: 1.5 }, uBoil: { value: 0 },
    uInkCol: { value: new THREE.Vector3(0.004, 0.012, 0.01) }, uFront: { value: 0 }, uCore: { value: new THREE.Vector2() } });

  // Cœur en 3D : même dessin que le cœur 2D, mais masqué par la profondeur de la scène.
  const core = pass(/* glsl */`
    uniform vec2 uPos; uniform float uSize, uI, uDepth; uniform vec3 uCol;
    void main(){
      float asp=uRes.x/uRes.y;
      vec2 q=(vUv*2.-1.)*vec2(asp,1.)-uPos*vec2(asp,1.);
      float r=length(q), s=uSize;
      float k=exp(-r*r/(s*s*.08))*6.+(s*s*.02)/(r*r+s*s*.02)*1.2+exp(-r/(s*3.))*.08;
      vec3 c=mix(uCol,vec3(1.),exp(-r*r/(s*s*.02)))*k*uI;
      gl_FragDepth=uDepth;
      fragColor=vec4(c,1.);
    }`, { uPos: { value: new THREE.Vector2() }, uSize: { value: 0.05 }, uI: { value: 1 }, uDepth: { value: 0.5 }, uCol: { value: new THREE.Vector3(1, 1, 1) } },
  { ...additive, depth: true });

  // Caméra de la phase 4 : bascule avec anticipation, effet vertigo (dolly zoom), orbite lente.
  function camAt(t) {
    const kt = remap(t, T.tilt, T.tilt + 2.1);
    // bascule (avec anticipation), puis on se rapproche et on descend vers le monde central
    const late = easeInOut(remap(t, T.planetsDone - 0.3, T.dive + 0.2), 2.2);
    const tilt = (anticipate(easeInOut(kt, 1.7), 0.08) * 57 - 15 * late) * Math.PI / 180;
    const fov = lerp(35, 52, easeInOut(kt, 2)) - 8 * late;
    let dist = D * Math.tan(17.5 * Math.PI / 180) / Math.tan(lerp(35, 52, easeInOut(kt, 2)) / 2 * Math.PI / 180);
    dist *= 1 - 0.08 * easeInOut(remap(t, T.planets, T.planetsDone + 1), 2) - 0.36 * late;
    dist *= lerp(1 / 1.5, 1, easeInOut(remap(t, T.tilt + 0.3, T.planets + 0.6), 2)); // raccord avec la poussée de la phase 3
    const az = (22 * easeInOut(remap(t, T.tilt + 0.8, T.planetsDone), 2) + 40 * late) * Math.PI / 180;
    const pos = new THREE.Vector3(0, -dist * Math.sin(tilt), dist * Math.cos(tilt));
    const up = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
    pos.applyAxisAngle(new THREE.Vector3(0, 0, 1), az); up.applyAxisAngle(new THREE.Vector3(0, 0, 1), az);
    const fl = smooth(remap(t, T.tilt + 2.5, T.tilt + 4));
    pos.x += (noise1(t * 0.4, 21) - 0.5) * 0.03 * fl; pos.y += (noise1(t * 0.4, 22) - 0.5) * 0.03 * fl;
    return { pos, up, fov, target: new THREE.Vector3(0, 0, 0.03 * late) };
  }

  // Plongée : anticipation (léger recul), puis chute accélérée dans la faille.
  let RIFT = null;
  function rift() {
    if (!RIFT) { const c0 = camAt(T.dive).pos.clone().normalize(); RIFT = c0.add(new THREE.Vector3(0.15, 0.1, 0.25)).normalize(); }
    return RIFT;
  }
  function diveCam(t) {
    const c0 = camAt(Math.min(t, T.dive));
    if (t <= T.dive) return c0;
    const R = PLANETS[0].r * 0.93, rd = rift();
    const back = Math.sin(Math.PI * clamp((t - T.dive) / 0.5)) * 0.1 * (t < T.dive + 0.5 ? 1 : 0);
    const s = easeInOut(clamp((t - T.dive - 0.3) / (T.fractal - T.dive - 0.35)), 1.6) * 0.93 + 0.07 * clamp((t - T.fractal + 0.5) / 0.5);
    const P0 = c0.pos.clone().multiplyScalar(1 + back);
    const P3 = rd.clone().multiplyScalar(R - 0.06);
    const P1 = P0.clone().lerp(rd.clone().multiplyScalar(P0.length()), 0.6);
    const P2 = rd.clone().multiplyScalar(R + 0.2);
    const b = (a, b_, c, d, x) => a.clone().multiplyScalar((1 - x) ** 3).add(b_.clone().multiplyScalar(3 * (1 - x) ** 2 * x)).add(c.clone().multiplyScalar(3 * (1 - x) * x * x)).add(d.clone().multiplyScalar(x ** 3));
    const pos = b(P0, P1, P2, P3, s);
    const target = c0.target.clone().lerp(rd.clone().multiplyScalar(R * 0.2), smooth(s * 1.4));
    const fov = lerp(c0.fov, 78, easeInOut(s, 2));
    return { pos, up: c0.up.clone(), fov, target };
  }

  function setup(t, P, img3, data) {
    const u = w3.u;
    u.uT.value = t; u.uData.value = data; u.uImg.value = img3;
    u.uExtT.value = T.tilt + 0.3; u.uMorphT.value = T.planets; u.uMorphDur.value = 1.25;
    u.uHmax.value = 0.3;
    u.uStage.value.set(T.wireFlat, T.flatSmooth, T.cel, T.tilt + 1.4);
    u.uRingRot.value = Math.max(0, t - T.planets) * 0.12;
    u.uCoreI.value = P.coreLight;
    u.uKey.value.set(-0.45, -0.55, 0.7).normalize().multiplyScalar(P.key);
    u.uCrack.value = P.crack;
    u.uRift.value.copy(rift()); u.uRiftOpen.value = P.rift;
    const tp = T.planets;
    PLANETS.forEach((p, j) => {
      const c = planetPos(j, t, tp);
      u.uPl.value[j].set(c.x, c.y, c.z, p.r);
      u.uSpin.value[j] = (t - tp) * (j === 0 ? 0.25 : 0.6);
      const m = w3.planets[j], pu = m.userData.u;
      pu.uCenter.value.copy(c);
      const g = t - (tp + 0.25 + j * 0.08);
      pu.uGrow.value = g <= 0 ? 0 : Math.min(1.15, 1 - Math.exp(-4 * g) * Math.cos(9 * g));
      const detail = clamp(Math.floor(beatAt(t) - 41 + 0.001), 0, 4);
      m.geometry = w3.planetGeos[detail];
      pu.uStage.value.set(tp + 0.55, beatTime(44), T.cel, 0);
      pu.uRift.value.copy(rift()); pu.uRiftOpen.value = P.rift; pu.uCrack.value = P.crack;
      pu.uFlatN.value = 1 - smooth(remap(t, beatTime(44), beatTime(45)));
      m.visible = t > tp + 0.2;
    });
    // orbites dessinées progressivement
    w3.orbitMat.uniforms.uDraw.value = easeInOut(remap(t, T.planetsDone - 0.6, T.cel + 0.4), 2);
    w3.orbitMat.uniforms.uT.value = t;
    w3.orbitMat.uniforms.uI.value = 1 - smooth(remap(t, T.dive, T.dive + 0.8));
    w3.orbits.forEach((o) => { o.visible = t > T.planetsDone - 0.6; });
    // arbres
    w3.treeMat.uniforms.uGrow.value = easeOut(remap(t, T.life, T.life + 1.8), 2);
    w3.treeLines.visible = w3.leaves.visible = t > T.life;
    w3.treeLines.rotation.z = 0; // les arbres tournent avec la planète centrale
    const spin0 = (t - tp) * 0.25;
    w3.treeLines.rotation.z = spin0; w3.leaves.rotation.z = spin0;
    w3.treeLines.updateMatrixWorld(); w3.leaves.updateMatrixWorld();
    w3.boids.update(t, T.life, smooth(remap(t, T.life, T.life + 0.6)));
  }

  function render(t, P, img3, data, target, camOverride) {
    setup(t, P, img3, data);
    const c = camOverride || diveCam(t);
    cam.fov = c.fov; cam.updateProjectionMatrix();
    cam.position.copy(c.pos); cam.up.copy(c.up); cam.lookAt(c.target); cam.updateMatrixWorld();
    // fond
    bg.u.uTop.value.copy(P.bgTop); bg.u.uBot.value.copy(P.bgBot); bg.u.uStars.value = P.stars; bg.u.uT.value = t;
    bg.u.uAng.value.set(Math.atan2(c.pos.y, c.pos.x) * 0.05, c.pos.z * 0.02);
    bg.render(s3dRT, true);
    renderer.setRenderTarget(s3dRT); renderer.clearDepth();
    renderer.render(w3.scene, cam);
    // cœur (masqué par les planètes)
    const v = new THREE.Vector3(0, 0, 0).project(cam);
    const dist = cam.position.length();
    core.u.uPos.value.set(v.x, v.y); core.u.uDepth.value = v.z * 0.5 + 0.5;
    core.u.uSize.value = P.coreSize * (D / dist) * (Math.tan(17.5 * Math.PI / 180) / Math.tan(cam.fov / 2 * Math.PI / 180));
    core.u.uI.value = P.coreI; core.u.uCol.value.copy(P.coreCol);
    core.render(s3dRT, false);
    // passe normales pour l'encre
    if (P.ink > 0) {
      const saved = [];
      w3.scene.traverse((o) => {
        if (!o.isMesh && !o.isLine && !o.isPoints) return;
        saved.push([o, o.material, o.visible]);
        if (o === w3.cols) o.material = w3.matColsN;
        else if (o.userData.matN) o.material = o.userData.matN;
        else o.visible = false;
      });
      clearRT(nrmRT, 0.5, 0.5, 0.5, 0);
      renderer.setRenderTarget(nrmRT); renderer.render(w3.scene, cam);
      saved.forEach(([o, m, vis]) => { o.material = m; o.visible = vis; });
    }
    ink.u.uInk.value = P.ink; ink.u.uFront.value = P.inkFront; ink.u.uWidth.value = P.inkWidth * H / 1080;
    ink.u.uBoil.value = P.boil; ink.u.uCore.value.set(v.x, v.y);
    ink.render(target, true);
    P.corePos.set(v.x, v.y);
    const rw = rift().clone().multiplyScalar(PLANETS[0].r * 0.93);
    const rp = rw.clone().project(cam);
    const tv = new THREE.Vector3().crossVectors(rift(), new THREE.Vector3(0, 0, 1)).normalize();
    const rp2 = rw.clone().addScaledVector(tv, 0.03).project(cam);
    const riftAng = Math.atan2((rp2.y - rp.y), (rp2.x - rp.x) * W / H);
    return { cam, coreNdc: v, riftNdc: rp, riftAng, camDist: cam.position.distanceTo(rift().clone().multiplyScalar(PLANETS[0].r * 0.93)) };
  }

  return { render, camAt, cam, w3, s3dRT, nrmRT };
}
