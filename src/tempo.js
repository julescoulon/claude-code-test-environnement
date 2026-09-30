// Grille rythmique invisible : 100 → 140 BPM entre 0 et 37 s, puis tempo tenu.
// beat(t) = ∫ BPM/60. Les temps 0–4 forment l'anacrouse, le Big Bang tombe sur le temps 5.
export const T_ACC = 37;
const A = 20 / 37; // demi-accélération en BPM/s

export function beatAt(t) {
  if (t <= T_ACC) return (100 * t + A * t * t) / 60;
  return beatAt(T_ACC) + (t - T_ACC) * 140 / 60;
}

export function beatTime(n) {
  const nAcc = beatAt(T_ACC);
  if (n <= nAcc) return (-100 + Math.sqrt(10000 + 4 * A * 60 * n)) / (2 * A);
  return T_ACC + (n - nAcc) * 60 / 140;
}

export function bpmAt(t) { return t <= T_ACC ? 100 + 40 * t / T_ACC : 140; }

// Impulsion qui décroît après chaque temps (0..1). sharp règle la vitesse de décroissance.
export function pulse(t, sharp = 6, every = 1) {
  const b = beatAt(t) / every;
  const f = b - Math.floor(b);
  return Math.exp(-f * sharp);
}

// Impulsion d'un temps précis n (0 avant, 1 au temps, décroît après).
export function hit(t, n, decay = 0.35) {
  const d = t - beatTime(n);
  return d < 0 ? 0 : Math.exp(-d / decay);
}

// Temps clés du film (en numéros de temps), cf. NOTES.md
export const B = {
  anticip: 4, bang: 5, shock2: 9, shock3: 13,
  cool: 17, frozen: 21, chem: 23, glyph: 25, glyphDone: 29, zero: 31,
  tilt: 33, wireFlat: 37, flatSmooth: 39, planets: 41, planetsDone: 45,
  cel: 47, life: 49, dive: 53, fractal: 57, cuts: 61, cutsEnd: 69, iris: 69,
  contract: 72, pullback: 73,
};
export const T = Object.fromEntries(Object.entries(B).map(([k, n]) => [k, beatTime(n)]));
