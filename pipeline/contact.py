"""Planche-contact : python pipeline/contact.py <dossier|liste> <sortie.png> [--cols 4] [--width 480] [--every N] [--fps 24]"""
import sys, os, glob, argparse
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--cols', type=int, default=4); ap.add_argument('--width', type=int, default=480)
ap.add_argument('--every', type=int, default=1); ap.add_argument('--fps', type=float, default=24)
ap.add_argument('--start', type=int, default=0); ap.add_argument('--end', type=int, default=10**9)
a = ap.parse_args()
files = sorted(glob.glob(os.path.join(a.src, '*.png')))
files = [f for f in files if a.start <= int(os.path.basename(f)[:5]) < a.end][::a.every]
if not files: sys.exit('aucune image')
im0 = Image.open(files[0]); tw = a.width; th = round(im0.height * tw / im0.width)
rows = (len(files) + a.cols - 1) // a.cols
sheet = Image.new('RGB', (a.cols * tw, rows * (th + 18)), (18, 18, 20))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % a.cols) * tw, (i // a.cols) * (th + 18)
    sheet.paste(im, (x, y))
    n = int(os.path.basename(f)[:5])
    d.text((x + 4, y + th + 3), f'#{n}  {n / a.fps:.2f}s', fill=(200, 200, 200))
sheet.save(a.out)
print(a.out, len(files))
