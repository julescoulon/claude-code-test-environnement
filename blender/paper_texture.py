"""Feuille de storyboard de l'animateur (texture du plan « Lumière »), générée par code.

Les vignettes sont des images du film passées au crayon (contours + hachures). Les annotations
sont manuscrites (police Caveat) et le cercle au crayon marque l'endroit où la bille est posée.

python blender/paper_texture.py --frames <dossier d'images du film> --out render/paper.png
"""
import argparse, math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ap = argparse.ArgumentParser()
ap.add_argument('--frames', nargs='+', required=True, help='images clés (9) dans l’ordre du film')
ap.add_argument('--out', default='render/paper.png')
a = ap.parse_args()
rnd = random.Random(0)
np.random.seed(0)

def ttf(woff2, name):
    dst = os.path.join(ROOT, 'render', name)
    if not os.path.exists(dst):
        f = TTFont(os.path.join(ROOT, woff2)); f.flavor = None; f.save(dst)
    return dst
HAND = ttf('node_modules/@fontsource/caveat/files/caveat-latin-700-normal.woff2', 'caveat.ttf')
MONO = ttf('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 'jbmono.ttf')

W, H = 2970, 2100            # A4 paysage, 10 px/mm
PX = W / 0.297               # pixels par mètre
# papier : blanc cassé, fibres, léger vignettage
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
base = np.array([0.935, 0.918, 0.872], np.float32)
fib = np.random.rand(H // 4, W // 4).astype(np.float32)
fib = np.array(Image.fromarray((fib * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
grain = np.random.rand(H, W).astype(np.float32)
paper = base[None, None, :] * (0.975 + 0.035 * fib[..., None] + 0.015 * (grain[..., None] - 0.5))
paper *= (1 - 0.05 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2))[..., None]

ink = np.zeros((H, W), np.float32)   # densité de graphite (0..1)
blue = np.zeros((H, W), np.float32)  # impression bleu clair (cadres)

def stamp(layer, img_l, x0, y0):
    h, w = img_l.shape
    layer[y0:y0 + h, x0:x0 + w] = np.maximum(layer[y0:y0 + h, x0:x0 + w], img_l)

def sketch(path, w, h):
    """Image → dessin au crayon : contours marqués, hachures dans les ombres, trait irrégulier."""
    im = Image.open(path).convert('L').resize((w, h), Image.LANCZOS)
    g = np.array(im, np.float32) / 255
    gb = np.array(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    gx = np.zeros_like(gb); gy = np.zeros_like(gb)
    gx[:, 1:-1] = gb[:, 2:] - gb[:, :-2]; gy[1:-1] = gb[2:] - gb[:-2]
    edge = np.clip(np.hypot(gx, gy) * 6, 0, 1) ** 0.8
    edge *= (np.random.rand(h, w) > 0.12)
    # hachures : lumière = papier ; plus c'est sombre dans l'image... inversé : on dessine la lumière (fond noir du film)
    lum = gb
    yy_, xx_ = np.mgrid[0:h, 0:w]
    hatch1 = (np.sin((xx_ + yy_) * 0.9 + np.random.rand() * 6) > 0.55).astype(np.float32)
    hatch2 = (np.sin((xx_ - yy_) * 0.9) > 0.6).astype(np.float32)
    dark = 1 - lum
    shade = hatch1 * np.clip((dark - 0.45) * 2.5, 0, 1) * 0.35 + hatch2 * np.clip((dark - 0.75) * 4, 0, 1) * 0.3
    out = np.clip(edge * 0.9 + shade, 0, 1)
    out = np.array(Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255
    return out

# ------------------------------------------------ cadres imprimés + vignettes (3 × 2) dans les deux tiers supérieurs
M = 110
pw = 800
ph = int(pw * 9 / 16)
captions = ['1 · singularité', '2 · BANG !', '3 · ça refroidit', '4 · la matière s’écrit', '5 · ça bascule, ça prend du volume', '6 · l’univers se regarde']
frames = a.frames
chosen = frames[:6]
bl = Image.new('L', (W, H), 0); bd = ImageDraw.Draw(bl)
hand = ImageFont.truetype(HAND, 64); hand_s = ImageFont.truetype(HAND, 50); mono = ImageFont.truetype(MONO, 26)
tx = Image.new('L', (W, H), 0); td = ImageDraw.Draw(tx)
for i in range(6):
    cx, cy = i % 3, i // 3
    x0 = (W - 3 * pw - 2 * 110) // 2 + cx * (pw + 110); y0 = 230 + cy * (ph + 130)
    bd.rectangle([x0, y0, x0 + pw, y0 + ph], outline=150, width=3)
    bd.text((x0, y0 - 40), f'SC.01  PL.{i + 1:02d}', fill=140, font=mono)
    sk = sketch(chosen[i], pw - 16, ph - 16)
    stamp(ink, sk * (0.75 + 0.2 * rnd.random()), x0 + 8, y0 + 8)
    td.text((x0 + 10 + rnd.randint(-6, 6), y0 + ph + 18 + rnd.randint(-4, 4)), captions[i], fill=235, font=hand)
# en-tête imprimé
bd.text((M, 110), 'PROD. « GRAINE 0 »   ·   STORYBOARD   ·   SÉQ. BIG BANG   ·   48 s   ·   BOUCLE', fill=150, font=mono)
bd.line([M, 160, W - M, 160], fill=130, width=2)
blue = np.array(bl, np.float32) / 255

# ------------------------------------------------ zone basse : le cercle au crayon où la bille est posée
# la bille est en (0,0) dans le monde ; la feuille est centrée en (0, 0.035) et tournée de -0.06 rad
ang = 0.06
lx, ly = 0 * math.cos(ang) - (-0.05) * math.sin(ang), 0 * math.sin(ang) + (-0.05) * math.cos(ang)
mx, my = W / 2 + lx * PX, H / 2 - ly * PX
circ = Image.new('L', (W, H), 0); cd = ImageDraw.Draw(circ)
Rc = 0.0185 * PX
for k in range(3):  # trois passages de crayon, légèrement décalés, qui dépassent (tracé à la main)
    pts = []
    a0 = rnd.random() * 6.28
    for j in range(260):
        t = j / 250 * 2.12 * math.pi
        rr = Rc * (1 + 0.012 * math.sin(t * 3 + k) + 0.02 * (k - 1))
        pts.append((mx + math.cos(a0 + t) * rr + rnd.uniform(-1.5, 1.5), my + math.sin(a0 + t) * rr + rnd.uniform(-1.5, 1.5)))
    cd.line(pts, fill=200 - k * 40, width=5 - k, joint='curve')
# notes manuscrites autour
notes = [((mx + Rc + 60, my - 110), 'la graine : tout part d’ici', hand),
         ((mx - Rc - 700, my + 40), 'tempo 100 - 140 bpm (invisible)', hand_s),
         ((mx + Rc + 80, my + 60), 'et tout revient ici. (Big Crunch)', hand_s),
         ((M + 10, H - 250), 'GRAINE 0', ImageFont.truetype(HAND, 150))]
for (p, s, f) in notes:
    td.text(p, s, fill=235, font=f)
# flèche du « tout revient »
td.line([(mx + Rc + 70, my + 95), (mx + Rc + 10, my + 40)], fill=220, width=4)
td.line([(mx + Rc + 10, my + 40), (mx + Rc + 40, my + 45)], fill=220, width=4)
td.line([(mx + Rc + 10, my + 40), (mx + Rc + 20, my + 70)], fill=220, width=4)
txt = np.array(tx.filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
cir = np.array(circ.filter(ImageFilter.GaussianBlur(0.9)), np.float32) / 255
ink = np.maximum(ink, np.maximum(txt * 0.85, cir * 0.9))
# grain du graphite (le trait accroche le papier)
ink *= 0.7 + 0.3 * (grain > 0.35)

graphite = np.array([0.20, 0.20, 0.23], np.float32)
bluec = np.array([0.55, 0.68, 0.85], np.float32)
col = paper * (1 - blue[..., None] * 0.35) + bluec * blue[..., None] * 0.35
col = col * (1 - ink[..., None]) + graphite * ink[..., None]
Image.fromarray((np.clip(col, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8)).save(os.path.join(ROOT, a.out))
print('paper', a.out)
