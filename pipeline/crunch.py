"""Big Crunch : tout le film repasse à l'envers, en accéléré, jusqu'à la singularité.

La vitesse (images source par image de sortie) monte progressivement de 1× à ~30×, puis décélère
et se pose exactement sur l'image source 1 : l'image suivante du film, en boucle, est l'image 0.
Chaque image de sortie fusionne les images source qu'elle couvre (flou de vitesse).

python pipeline/crunch.py --src render/final_src --out render/09_crunch [--fps 24]
  (--src : dossier où chaque image source NNNNN.png est accessible, cf. assemble.py)
"""
import argparse, math, os, sys
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--fps', type=int, default=24)
ap.add_argument('--start', type=float, default=42.0)   # début du Crunch (s)
ap.add_argument('--end', type=float, default=48.0)     # fin du film (s) = image 0
ap.add_argument('--vmax', type=float, default=30.0)
a = ap.parse_args()

fps = a.fps
first_out = round(a.start * fps)            # 1008
n_out = round(a.end * fps) - first_out      # 144
s0 = first_out - 2                          # 1006 : on repart en arrière depuis l'image précédente
s_end = 1                                   # on se pose sur l'image 1 ; l'image 0 ouvre la boucle

# profil de vitesse : rampe exponentielle (accélération perçue régulière) de 1× à vmax vers 70 %,
# puis décélération symétrique en échelle log, qui se pose à 1× sur l'image 1
x = np.linspace(0, 1, n_out)
XP = 0.7
target = s0 - s_end
def speeds(k):
    g = np.where(x < XP, (x / XP) ** k, ((1 - x) / (1 - XP)) ** k)
    return np.exp(math.log(a.vmax) * g)
lo, hi = 0.2, 12.0
for _ in range(80):
    q = (lo + hi) / 2
    dist = speeds(q)[:-1].sum()
    if dist > target: lo = q
    else: hi = q
v = speeds(q)
pos = s0 - np.concatenate([[0], np.cumsum(v[:-1])])
pos = s0 + (pos - s0) * (s0 - s_end) / (s0 - pos[-1])
print(f'crunch : {n_out} images, source {s0} → {s_end}, q={q:.3f}, vmax={v.max():.1f}, v fin={v[-1]:.2f}')

os.makedirs(a.out, exist_ok=True)
cache = {}
def load(i):
    i = int(min(max(i, 0), s0 + 1))
    if i not in cache:
        if len(cache) > 80: cache.clear()
        cache[i] = np.asarray(Image.open(os.path.join(a.src, f'{i:05d}.png')).convert('RGB'), np.float32)
    return cache[i]

log = []
for k in range(n_out):
    f_out = first_out + k
    path = os.path.join(a.out, f'{f_out:05d}.png')
    c, w = pos[k], max(v[k], 1.0)
    log.append((f_out, round(float(c), 2), round(float(v[k]), 2)))
    if os.path.exists(path):
        continue
    # fenêtre triangulaire de rayon w centrée sur la position de lecture
    lo_i, hi_i = math.ceil(c - w + 1e-6), math.floor(c + w - 1e-6)
    acc = None; ws = 0.0
    for i in range(lo_i, hi_i + 1):
        wt = 1 - abs(i - c) / w
        if wt <= 0: continue
        im = load(i)
        acc = im * wt if acc is None else acc + im * wt
        ws += wt
    out = np.clip(acc / ws + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(path)
    print(f'crunch {f_out} pos={c:.1f} v={v[k]:.1f}', flush=True)
with open(os.path.join(a.out, 'profil.txt'), 'w') as fh:
    fh.write('image_sortie position_source vitesse\n' + '\n'.join(f'{a_} {b} {c}' for a_, b, c in log))
open(os.path.join(a.out, 'DONE'), 'w').write('ok')
