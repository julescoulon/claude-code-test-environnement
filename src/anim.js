// Bibliothèque d'animation maison : courbes d'amorti et principes d'animation.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const remap = (x, a, b) => clamp((x - a) / (b - a));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const easeIn = (x, p = 3) => Math.pow(clamp(x), p);
export const easeOut = (x, p = 3) => 1 - Math.pow(1 - clamp(x), p);
export const easeInOut = (x, p = 3) => { x = clamp(x); return x < 0.5 ? Math.pow(2 * x, p) / 2 : 1 - Math.pow(2 - 2 * x, p) / 2; };
export const expoOut = (x) => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };

// Dépassement puis stabilisation (ressort amorti), 0 → 1.
export function spring(x, freq = 3.2, damp = 5) {
  if (x <= 0) return 0;
  return 1 - Math.exp(-damp * x) * Math.cos(freq * Math.PI * 2 * x * 0.5);
}
// Retour arrière avant de partir (anticipation), 0 → 1.
export function anticipate(x, amount = 0.25) {
  x = clamp(x);
  const k = 1 + amount * 6;
  return x * x * ((k + 1) * x - k);
}
export const backOut = (x, s = 1.7) => { x = clamp(x) - 1; return x * x * ((s + 1) * x + s) + 1; };
// Cloche 0 → 1 → 0 entre a et b.
export const bell = (x, a, b) => { const k = remap(x, a, b); return Math.sin(Math.PI * k); };
// Fenêtre douce : monte sur [a0,a1], descend sur [b0,b1].
export const win = (x, a0, a1, b0, b1) => smooth(remap(x, a0, a1)) * (1 - smooth(remap(x, b0, b1)));
