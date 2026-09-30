// Tracés vectoriels (Canvas 2D) : crayon qui bouillonne, oscilloscope, morphing, déchirure.
import { W, H, ASPECT, THREE } from '../gl.js';
import { beatAt, T, beatTime, hit } from '../tempo.js';
import { clamp, remap, smooth, easeOut, easeInOut, spring, lerp, bell, win } from '../anim.js';
import { mulberry32, noise1 } from '../rng.js';

let cv, ctx, tex;
export function initVector() {
  cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  ctx = cv.getContext('2d');
  tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return tex;
}
const px = (x) => (x / ASPECT * 0.5 + 0.5) * W; // x ∈ [-A, A]
const py = (y) => (0.5 - y * 0.5) * H;          // y ∈ [-1, 1]
const S = () => H / 1080;                        // échelle des épaisseurs

// Forme du leitmotiv : cercle qui se transforme sur les temps (étoile, polygone...).
export function motifRadius(theta, t) {
  const b = beatAt(t);
  // cible de forme par temps : 0 cercle, 1 étoile 5, 2 triangle arrondi, 3 cercle
  const shapes = [(a) => 0, (a) => 0.18 * Math.cos(5 * a), (a) => 0.12 * Math.cos(3 * a), (a) => 0.07 * Math.cos(8 * a), (a) => 0];
  const i = Math.floor(b), f = b - i;
  const s0 = shapes[Math.min(Math.max(i, 0), 4)], s1 = shapes[Math.min(Math.max(i + 1, 0), 4)];
  const k = spring(f * 1.6, 2.2, 6); // chaque temps, la forme bascule avec un léger rebond
  return lerp(s0(theta), s1(theta), clamp(k, 0, 1.3));
}

// Rayon du cercle de crayon (unités écran, hauteur = 2)
export function circleR(t) {
  const aspire = smooth(remap(t, T.anticip, T.bang - 0.05)); // aspiré pendant l'anticipation
  return 0.46 * (1 - 0.72 * aspire * aspire);
}

// Trait de crayon : polyligne avec épaisseur et opacité variables, grain et bouillonnement 12 i/s.
function pencil(points, { width = 2, alpha = 0.8, color = '230,232,255', seed = 1, boil = 1 }) {
  const r = mulberry32(seed);
  for (let pass = 0; pass < 3; pass++) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      const j = (noise1(i * 0.21 + pass * 13, seed + pass) - 0.5) * 2.2 * S() * boil;
      if (i === 0) ctx.moveTo(x + j, y - j); else ctx.lineTo(x + j, y - j);
    }
    ctx.strokeStyle = `rgba(${color},${alpha * (pass === 0 ? 0.9 : 0.35)})`;
    ctx.lineWidth = width * S() * (pass === 0 ? 1 : 0.6 + r() * 0.6);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function renderVector(t, tSnap) {
  ctx.clearRect(0, 0, W, H);
  const boilT = Math.floor(t * 12); // le trait bouillonne à 12 i/s
  // --- Phase 1 : cercle au crayon qui se dessine, oscilloscope ---
  if (t < T.bang + 1.2) {
    const draw = easeInOut(remap(t, 0.15, T.anticip - 0.1), 2.2); // progression du tracé
    const R = circleR(t);
    const fadeOut = 1 - smooth(remap(t, T.bang, T.bang + 0.12));
    if (t < T.bang) {
      const n = 360;
      const pts = [];
      const a0 = Math.PI * 0.5 + 0.3;
      for (let i = 0; i <= n * draw; i++) {
        const a = a0 - (i / n) * Math.PI * 2.08; // le trait dépasse un peu son départ, comme à la main
        const rr = R * (1 + motifRadius(a, t)) * (1 + 0.012 * Math.sin(i * 0.05));
        pts.push([px(Math.cos(a) * rr), py(Math.sin(a) * rr)]);
      }
      if (pts.length > 2) pencil(pts, { width: 2.4, alpha: 0.85 * fadeOut, seed: 7 + boilT % 3 });
      // mine du crayon : point de contact lumineux à la tête du tracé
      if (draw > 0 && draw < 1 && pts.length) {
        const [hx, hy] = pts[pts.length - 1];
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14 * S());
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(160,120,255,0)');
        ctx.fillStyle = g; ctx.fillRect(hx - 20 * S(), hy - 20 * S(), 40 * S(), 40 * S());
      }
      // Lissajous : traces d'oscilloscope qui gravitent timidement
      const osc = win(t, 0.6, 1.4, T.anticip - 0.2, T.bang - 0.1);
      if (osc > 0.01) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          const fa = 3 + k, fb = 4 + k, ph = t * (0.6 + k * 0.25) + k;
          const rad = R * (1.35 + k * 0.28) * (1 - 0.6 * smooth(remap(t, T.anticip, T.bang)));
          for (let i = 0; i <= 600; i++) {
            const u = (i / 600) * Math.PI * 2;
            const x0 = Math.sin(fa * u + ph) * rad, y0 = Math.sin(fb * u) * rad * 0.8, ca = Math.cos(k * 1.1 + t * 0.2), sa = Math.sin(k * 1.1 + t * 0.2);
            const x = x0 * ca - y0 * sa, y = x0 * sa + y0 * ca;
            if (i === 0) ctx.moveTo(px(x), py(y)); else ctx.lineTo(px(x), py(y));
          }
          ctx.strokeStyle = `rgba(150,110,255,${0.16 * osc})`;
          ctx.lineWidth = 1.1 * S(); ctx.stroke();
        }
      }
    }
    // --- Déchirure : au Big Bang, le cercle éclate en fragments de trait ---
    if (t >= T.bang - 0.02 && t < T.bang + 1.2) {
      const tau = t - T.bang;
      const r = mulberry32(77);
      const R0 = circleR(T.bang - 0.01);
      for (let k = 0; k < 90; k++) {
        const a = (k / 90) * Math.PI * 2 + r() * 0.05;
        const len = 0.05 + r() * 0.08;
        const sp = 0.8 + r() * 2.5;
        const d = R0 + easeOut(tau * 1.6, 2) * sp;
        const rot = (r() - 0.5) * tau * 6;
        const al = (1 - smooth(remap(tau, 0.1, 0.9 + r() * 0.3))) * 0.9;
        if (al <= 0.01) continue;
        const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
        const tx = -Math.sin(a + rot), ty = Math.cos(a + rot);
        // étirement (smear) proportionnel à la vitesse
        const smear = 1 + 4 * Math.exp(-tau * 5);
        pencil([[px(cx - tx * len), py(cy - ty * len)], [px(cx + tx * len), py(cy + ty * len)],
                [px(cx + tx * len - Math.cos(a) * 0.02 * smear), py(cy + ty * len - Math.sin(a) * 0.02 * smear)]],
               { width: 2.2, alpha: al, color: '255,235,210', seed: k + 1000, boil: 0.5 });
      }
    }
  }
  tex.needsUpdate = true;
  return tex;
}
export { ctx as vectorCtx, px as vpx, py as vpy };
