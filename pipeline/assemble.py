"""Assemblage : MP4 (H.264, yuv420p, CRF 18, faststart, sans audio), poster, planche-contact, script couleur.

python pipeline/assemble.py --src render/final_src [--fps 24] [--preview]
"""
import argparse, os, subprocess, shutil
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True)
ap.add_argument('--fps', type=int, default=24)
ap.add_argument('--preview', action='store_true')
ap.add_argument('--poster', type=float, default=26.5, help='temps (s) de la plus belle image')
a = ap.parse_args()
src = os.path.join(ROOT, a.src)
N = 48 * a.fps
for i in range(N):
    if not os.path.exists(os.path.join(src, f'{i:05d}.png')):
        raise SystemExit(f'image manquante {i}')

def ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe: return exe
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()

outdir = os.path.join(ROOT, 'preview' if a.preview else 'out'); os.makedirs(outdir, exist_ok=True)
mp4 = os.path.join(outdir, 'film_maquette.mp4' if a.preview else 'film.mp4')
subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-framerate', str(a.fps), '-i', os.path.join(src, '%05d.png'),
                '-frames:v', str(N), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart', '-an', mp4], check=True)
print('mp4', mp4)

# poster
Image.open(os.path.join(src, f'{round(a.poster * a.fps):05d}.png')).convert('RGB').save(os.path.join(outdir, 'poster.png'))

# planche-contact : une image par seconde (4 par seconde en maquette)
per_s = 4 if a.preview else 1
idx = [round(k * a.fps / per_s) for k in range(48 * per_s)]
cols = 8; tw = 480 if not a.preview else 320; th = tw * 9 // 16
rows = (len(idx) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 22) + 60), (14, 14, 16))
d = ImageDraw.Draw(sheet)
d.text((12, 18), f'GRAINE 0 — planche-contact ({per_s} image/s)', fill=(220, 220, 220))
for k, i in enumerate(idx):
    im = Image.open(os.path.join(src, f'{i:05d}.png')).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (k % cols) * tw, 60 + (k // cols) * (th + 22)
    sheet.paste(im, (x, y))
    d.text((x + 6, y + th + 4), f'{i / a.fps:5.2f} s', fill=(190, 190, 190))
sheet.save(os.path.join(outdir, 'contact-sheet.png'))

# script couleur : couleur moyenne de chaque image
strip = np.zeros((160, N, 3), np.uint8)
for i in range(N):
    im = np.asarray(Image.open(os.path.join(src, f'{i:05d}.png')).convert('RGB').resize((48, 27)), np.float32)
    lin = (im / 255) ** 2.2
    m = lin.reshape(-1, 3).mean(0) ** (1 / 2.2)
    # teinte dominante : pondère par la saturation pour éviter le gris moyen
    sat = lin.max(-1) - lin.min(-1)
    wgt = (sat.reshape(-1) + 1e-3)[:, None]
    dom = ((lin.reshape(-1, 3) * wgt).sum(0) / wgt.sum()) ** (1 / 2.2)
    strip[:80, i] = (m * 255).clip(0, 255)
    strip[80:, i] = (dom / max(dom.max(), 1e-3) * 235).clip(0, 255)
Image.fromarray(strip).resize((min(N * 2, 2304), 160), Image.NEAREST).save(os.path.join(outdir, 'color-script.png'))
print('assemblage terminé')
