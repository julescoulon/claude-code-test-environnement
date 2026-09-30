// Aléatoire déterministe : tout dérive de la graine 0.
export const SEED = 0;
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rng = (salt = 0) => mulberry32((SEED * 2654435761 + salt * 40503 + 0x9E3779B9) | 0);
export function hash1(n) { const r = mulberry32((n * 374761393 + 668265263) | 0); return r(); }
// Bruit de valeur 1D lisse, déterministe.
export function noise1(x, salt = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash1(i + salt * 7919) * (1 - u) + hash1(i + 1 + salt * 7919) * u;
}
export function gauss(r) { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / Math.sqrt(0.5); }
