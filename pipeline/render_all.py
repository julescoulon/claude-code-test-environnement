"""Orchestration complète du rendu de « Graine 0 ».

python pipeline/render_all.py [--preview] [--jobs 2] [--only plan1,plan2] [--skip-blender]

Chaque plan est rendu dans son propre dossier (render/ ou preview/), avec reprise : les images
existantes et les plans marqués DONE ne sont pas recalculés. Les plans se coupent pendant les
respirations ; les transitions sont rendues dans un même plan, avec les deux mondes présents.
"""
import argparse, json, os, subprocess, sys, time, shutil, glob
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ap = argparse.ArgumentParser()
ap.add_argument('--preview', action='store_true', help='maquette 854×480 à 12 i/s')
ap.add_argument('--jobs', type=int, default=2)
ap.add_argument('--only', default='')
ap.add_argument('--skip-blender', action='store_true')
ap.add_argument('--no-assemble', action='store_true')
a = ap.parse_args()

T_PULL = 36.5714  # temps 73 (cf. src/tempo.js)
if a.preview:
    W, H, FPS, OUT, BL_SCALE, BL_SAMPLES = 854, 480, 12, 'preview', 25, 16
else:
    W, H, FPS, OUT, BL_SCALE, BL_SAMPLES = 1920, 1080, 24, 'render', 75, 40
OUTD = os.path.join(ROOT, OUT)
os.makedirs(os.path.join(OUTD, 'logs'), exist_ok=True)

# Plans du navigateur (coupés pendant les respirations)
SHOTS = [
    ('01_singularite_expansion', 0.0, 8.5),
    ('02_refroidissement', 8.5, 12.6),
    ('03_glyphes', 12.6, 17.9),
    ('04_structures', 17.9, 24.4),
    ('05_vie_plongee', 24.4, 29.9),
    ('06_complexite', 29.9, T_PULL),
]

def run(cmd, log):
    t0 = time.time()
    with open(os.path.join(OUTD, 'logs', log), 'a') as fh:
        fh.write(f'\n$ {" ".join(cmd)}\n'); fh.flush()
        r = subprocess.run(cmd, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT)
    if r.returncode != 0:
        sys.exit(f'échec : {" ".join(cmd)} (voir {OUT}/logs/{log})')
    return time.time() - t0

def done(d):
    return os.path.exists(os.path.join(OUTD, d, 'DONE'))

def capture(name, t0, t1, extra=()):
    if done(name):
        print(f'= {name} déjà rendu'); return 0
    print(f'> {name} [{t0:.2f}, {t1:.2f}[', flush=True)
    dt = run(['node', 'pipeline/capture.mjs', '--out', f'{OUT}/{name}', '--from', str(t0), '--to', str(t1),
              '--fps', str(FPS), '--w', str(W), '--h', str(H), *extra], f'{name}.log')
    print(f'< {name} {dt / 60:.1f} min', flush=True)
    return dt

only = set(a.only.split(',')) if a.only else None
timing = {}
# 1. plans du navigateur, en parallèle
with ThreadPoolExecutor(a.jobs) as ex:
    futs = {n: ex.submit(capture, n, t0, t1, ['--query', f'root={OUT}']) for n, t0, t1 in SHOTS if not only or n in only}
    # 2. l'intérieur de la bille (source du disque dans Blender)
    if not only or '07_interieur' in only:
        futs['07_interieur'] = ex.submit(capture, '07_interieur', T_PULL, 42.0, ['--query', f'mode=feed&root={OUT}'])
    for n, f in futs.items(): timing[n] = f.result()

# 3. feuille de storyboard (vignettes tirées du film lui-même)
paper = os.path.join(OUTD, 'paper.png')
if not os.path.exists(paper):
    pick = lambda d, t: os.path.join(OUTD, d, f'{round(t * FPS):05d}.png')
    frames = [pick('01_singularite_expansion', 1.5), pick('01_singularite_expansion', 3.58), pick('02_refroidissement', 12.5),
              pick('03_glyphes', 16.3), pick('04_structures', 20.8), pick('06_complexite', 34.9)]
    run([sys.executable, 'blender/paper_texture.py', '--frames', *frames, '--out', f'{OUT}/paper.png'], 'paper.log')

# 4. plan photoréaliste (Blender Cycles)
if not a.skip_blender and (not only or 'blender' in only):
    if not done('blender'):
        print('> blender (Cycles)', flush=True)
        f0, f1 = round(T_PULL * FPS + 0.5), round(42.0 * FPS) - 1
        if a.preview:  # la maquette réutilise l'échelle du film : on rend les images 24 i/s correspondantes
            pass
        timing['blender'] = run([sys.executable, 'blender/lumiere.py', '--out', f'{OUT}/blender', '--feed', f'{OUT}/07_interieur',
                                 '--paper', f'{OUT}/paper.png', '--start', str(f0), '--end', str(f1), '--fps', str(FPS),
                                 '--samples', str(BL_SAMPLES), '--scale', str(BL_SCALE)], 'blender.log')

# 5. composition du plan Lumière (raccord navigateur → Cycles)
if not only or '08_lumiere' in only:
    timing['08_lumiere'] = capture('08_lumiere', T_PULL, 42.0, ['--query', f'root={OUT}'])

if a.no_assemble:
    sys.exit(0)

# 6. table image → fichier, Big Crunch, assemblage
src = os.path.join(OUTD, 'final_src'); os.makedirs(src, exist_ok=True)
dirs = [n for n, _, _ in SHOTS] + ['08_lumiere']
for d in dirs:
    for f in glob.glob(os.path.join(OUTD, d, '*.png')):
        dst = os.path.join(src, os.path.basename(f))
        if not os.path.exists(dst): os.symlink(os.path.relpath(f, src), dst)
n_src = round(42.0 * FPS)
missing = [i for i in range(n_src) if not os.path.exists(os.path.join(src, f'{i:05d}.png'))]
if missing:
    sys.exit(f'images manquantes avant le Crunch : {missing[:10]}…')
if not done('09_crunch'):
    timing['09_crunch'] = run([sys.executable, 'pipeline/crunch.py', '--src', f'{OUT}/final_src', '--out', f'{OUT}/09_crunch', '--fps', str(FPS)], 'crunch.log')
for f in glob.glob(os.path.join(OUTD, '09_crunch', '*.png')):
    dst = os.path.join(src, os.path.basename(f))
    if not os.path.exists(dst): os.symlink(os.path.relpath(f, src), dst)
run([sys.executable, 'pipeline/assemble.py', '--src', f'{OUT}/final_src', '--fps', str(FPS)] + (['--preview'] if a.preview else []), 'assemble.log')
with open(os.path.join(OUTD, 'timing.json'), 'a') as fh:
    fh.write(json.dumps({k: round(v / 60, 1) for k, v in timing.items()}) + '\n')
print('terminé.')
