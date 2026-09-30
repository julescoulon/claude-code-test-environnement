// Le cœur (point focal) et les ondes de choc, rendus en HDR.
import { pass, additive, THREE } from '../gl.js';

export function createCore() {
  return pass(/* glsl */`
    uniform vec2 uPos; uniform float uSize, uI, uBlink, uFlash, uT, uFoam;
    uniform vec3 uCol; uniform vec3 uShock[3]; uniform vec3 uShockCol;
    void main(){
      float asp=uRes.x/uRes.y;
      vec2 q=(vUv*2.-1.)*vec2(asp,1.)-uPos*vec2(asp,1.);
      vec2 qb=q; qb.y/=max(1.-uBlink*.97,.03); qb.x/=1.+uBlink*.6; // clignement : écrasement vertical
      float r=length(qb);
      float s=uSize;
      float core = exp(-r*r/(s*s*.08))*6. + (s*s*.02)/(r*r+s*s*.02)*1.2 + exp(-r/(s*3.))*.08;
      vec3 c = mix(uCol, vec3(1.), exp(-r*r/(s*s*.02))) * core * uI;
      // ondes de choc : front net, longue traîne intérieure
      float rr=length(q);
      for(int i=0;i<3;i++){
        vec3 sh=uShock[i]; if(sh.y<=0.) continue;
        float d=rr-sh.x;
        float front = d>0. ? exp(-d*d/(sh.z*sh.z*.15)) : exp(d/(sh.z*.5))*.35 + exp(-d*d/(sh.z*sh.z*.1))*.5;
        float ang = atan(q.y,q.x);
        float mod = .75+.25*snoise(vec3(cos(ang)*3.,sin(ang)*3.,sh.x*2.));
        c += uShockCol*front*sh.y*mod;
      }
      // écume quantique : des points apparaissent et disparaissent autour de la singularité
      if(uFoam>0.){
        vec2 g=q*38.; vec2 id=floor(g); vec2 f=fract(g)-.5;
        float h=hash12(id+floor(uT*9.)*17.);
        float s2=smoothstep(.12,.0,length(f-(hash22(id)-.5)*.6))*step(.965,h);
        c+=vec3(.75,.65,1.)*s2*uFoam*smoothstep(1.2,.2,rr)*.8;
      }
      c += vec3(1.,.95,.9)*uFlash;
      fragColor=vec4(c,1.);
    }`, {
    uPos: { value: new THREE.Vector2() }, uSize: { value: 0.05 }, uI: { value: 1 }, uBlink: { value: 0 },
    uFlash: { value: 0 }, uT: { value: 0 }, uFoam: { value: 0 }, uCol: { value: new THREE.Vector3(0.7, 0.6, 1) },
    uShock: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uShockCol: { value: new THREE.Vector3(1, 0.7, 0.4) },
  }, additive);
}

export function createNebula() {
  return pass(/* glsl */`
    uniform float uT, uR, uI; uniform vec2 uCam; uniform vec3 uTint;
    void main(){
      float asp=uRes.x/uRes.y;
      vec2 q=(vUv*2.-1.)*vec2(asp,1.) - uCam*.35;
      float r=length(q);
      vec3 p=vec3(q*1.1, uT*.04);
      vec2 w=vec2(fbm(p+vec3(0.,0.,1.3)), fbm(p+vec3(5.2,1.3,2.)));
      float n=fbm(vec3(q*1.4+w*1.6, uT*.06));
      float n2=fbm(vec3(q*3.1-w*2.2, uT*.09+7.));
      float mask=smoothstep(uR, uR*.25, r);
      float dens=pow(smoothstep(-.1,.7,n),1.6)*(.5+.7*n2);
      // gaz : magenta dense, bleu-violet ténu, liseré orange près du cœur
      vec3 col=mix(vec3(1.,.22,.55), vec3(.32,.18,1.), smoothstep(-.2,.5,n2));
      col=mix(vec3(1.,.55,.18), col, smoothstep(.05,.45,r/uR));
      col*=1.3;
      // filaments sombres (poussière)
      float dust=smoothstep(.05,.0,abs(n2-.1))*.6;
      fragColor=vec4(col*dens*mask*uI*(1.-dust*.7),1.);
    }`, {
    uT: { value: 0 }, uR: { value: 0 }, uI: { value: 0 }, uCam: { value: new THREE.Vector2() },
    uTint: { value: new THREE.Vector3(1, 0.3, 0.5) },
  }, additive);
}
