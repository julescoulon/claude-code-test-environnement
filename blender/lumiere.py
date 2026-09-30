"""Phase 6 — Lumière : plan photoréaliste (Blender Cycles, CPU, débruiteur OIDN).

La caméra démarre À L'INTÉRIEUR d'une bille de verre, face au disque qui affiche le monde du film
(images « intérieures » rendues par le navigateur), recule, traverse la paroi, et révèle la bille
posée sur la feuille de storyboard de l'animateur, sous une lampe de bureau.

python blender/lumiere.py --out render/blender --feed render/07_interieur --paper render/paper.png
                          [--start 878 --end 1007] [--samples 96] [--scale 100] [--only 900,950]
"""
import argparse, math, os, sys, random
import bpy
from mathutils import Vector, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='render/blender')
ap.add_argument('--feed', default='render/07_interieur')
ap.add_argument('--paper', default='render/paper.png')
ap.add_argument('--start', type=int, default=878)
ap.add_argument('--end', type=int, default=1007)
ap.add_argument('--samples', type=int, default=96)
ap.add_argument('--scale', type=int, default=100)
ap.add_argument('--only', default='')
ap.add_argument('--fast', type=int, default=-1)
ap.add_argument('--fps', type=int, default=24)
ap.add_argument('--save-blend', default='')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

FPS = a.fps
T_PULL = 36.571  # temps 73 : début du travelling arrière
R = 0.0125       # rayon de la bille (m)
rnd = random.Random(0)

def smooth(x):
    x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def ease_io(x, p=2.4):
    x = min(max(x, 0.0), 1.0)
    return (2 * x) ** p / 2 if x < 0.5 else 1 - (2 - 2 * x) ** p / 2
def remap(x, a0, a1):
    return min(max((x - a0) / (a1 - a0), 0.0), 1.0)

# ---------------------------------------------------------------- scène vide
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'
cy.samples = a.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.015
cy.use_denoising = True
cy.denoiser = 'OPENIMAGEDENOISE'
cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
cy.max_bounces = 10; cy.diffuse_bounces = 3; cy.glossy_bounces = 4; cy.transmission_bounces = 10; cy.volume_bounces = 1
cy.caustics_reflective = True; cy.caustics_refractive = True
cy.blur_glossy = 0.3
cy.seed = 0
sc.render.fps = FPS
sc.render.resolution_x = 1920; sc.render.resolution_y = 1080; sc.render.resolution_percentage = a.scale
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.5
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.color_depth = '8'
sc.view_settings.view_transform = 'Standard'   # l'émission du disque restitue exactement les images du navigateur
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0
sc.render.film_transparent = False

# monde : pièce sombre, très légère lumière bleutée d'ambiance
world = bpy.data.worlds.new('World'); sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.004, 0.005, 0.008, 1); bg.inputs[1].default_value = 1.0

def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links

# ---------------------------------------------------------------- bureau (bois de noyer procédural)
bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0, 0, -0.0004))
desk = bpy.context.object; desk.name = 'Bureau'
m, n, l = mat('Noyer')
bsdf = n['Principled BSDF']
tc = n.new('ShaderNodeTexCoord'); mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (18, 3.2, 18)
mp.inputs['Rotation'].default_value = (0, 0, 0.35)
noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 3.0; noise.inputs['Detail'].default_value = 8
wave = n.new('ShaderNodeTexWave'); wave.inputs['Scale'].default_value = 1.3; wave.inputs['Distortion'].default_value = 7.0
wave.inputs['Detail'].default_value = 6; wave.wave_profile = 'SAW'
ramp = n.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.035, 0.016, 0.008, 1); ramp.color_ramp.elements[1].color = (0.11, 0.055, 0.025, 1)
l.new(tc.outputs['Object'], mp.inputs['Vector']); l.new(mp.outputs['Vector'], wave.inputs['Vector'])
l.new(wave.outputs['Fac'], ramp.inputs['Fac']); l.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.38
bsdf.inputs['Coat Weight'].default_value = 0.35; bsdf.inputs['Coat Roughness'].default_value = 0.12
bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.08
l.new(wave.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
desk.data.materials.append(m)

# ---------------------------------------------------------------- feuille de storyboard (A4 paysage, légèrement gondolée)
bpy.ops.mesh.primitive_grid_add(x_subdivisions=80, y_subdivisions=56, size=1, location=(0.0, 0.05, 0))
paper = bpy.context.object; paper.name = 'Feuille'
paper.scale = (0.297, 0.210, 1)
bpy.ops.object.transform_apply(scale=True)
for v in paper.data.vertices:
    x, y = v.co.x, v.co.y
    v.co.z = 0.0006 + 0.0022 * (x / 0.1485) ** 4 + 0.0009 * math.sin(y * 21 + x * 7) * (abs(x) / 0.15) + 0.0012 * max(0, (y - 0.06) / 0.045) ** 2
paper.rotation_euler = (0, 0, -0.06)
m, n, l = mat('Papier')
bsdf = n['Principled BSDF']
img = n.new('ShaderNodeTexImage')
img.image = bpy.data.images.load(os.path.join(ROOT, a.paper))
img.interpolation = 'Cubic'
uv = n.new('ShaderNodeTexCoord')
l.new(uv.outputs['UV'], img.inputs['Vector'])
l.new(img.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.88
bsdf.inputs['Subsurface Weight'].default_value = 0.08
bsdf.inputs['Subsurface Radius'].default_value = (0.002, 0.002, 0.002)
bsdf.inputs['Sheen Weight'].default_value = 0.2
fib = n.new('ShaderNodeTexNoise'); fib.inputs['Scale'].default_value = 900; fib.inputs['Detail'].default_value = 10
bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.05
l.new(fib.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
paper.data.materials.append(m)
bpy.ops.object.shade_smooth()

# ---------------------------------------------------------------- la bille
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=R, location=(0, 0, R + 0.0006))
marble = bpy.context.object; marble.name = 'Bille'
bpy.ops.object.shade_smooth()
m, n, l = mat('Verre')
n.remove(n['Principled BSDF'])
glass = n.new('ShaderNodeBsdfGlass'); glass.inputs['IOR'].default_value = 1.52; glass.inputs['Roughness'].default_value = 0.0
glass.inputs['Color'].default_value = (0.97, 0.99, 0.98, 1)
l.new(glass.outputs[0], n['Material Output'].inputs['Surface'])
marble.data.materials.append(m)
CENTER = Vector((0, 0, R + 0.0006))

# disque intérieur : l'univers du film, toujours face à la caméra (comme la flamme d'une bille « œil de chat »)
RD = 0.47 * R
bpy.ops.mesh.primitive_plane_add(size=2 * RD, location=CENTER)
disc = bpy.context.object; disc.name = 'Univers'
m, n, l = mat('Univers')
n.remove(n['Principled BSDF'])
out = n['Material Output']
feed = n.new('ShaderNodeTexImage')
first = os.path.join(ROOT, a.feed, f'{a.start:05d}.png')
im = bpy.data.images.load(first)
im.source = 'SEQUENCE'
feed.image = im
feed.image_user.frame_duration = a.end - a.start + 1
feed.image_user.frame_start = a.start
feed.image_user.frame_offset = a.start - 1
feed.image_user.use_auto_refresh = True
feed.extension = 'CLIP'
tc = n.new('ShaderNodeTexCoord')
# UV du disque (0..1) → image 16:9 : le rayon du disque correspond à la demi-diagonale de l'image,
# si bien qu'au premier plan le disque couvre exactement tout le cadre (raccord au pixel près)
DG = math.hypot(16 / 9, 1.0)
SX, SY = DG / (16 / 9), DG
mp = n.new('ShaderNodeMapping')
mp.inputs['Location'].default_value = (0.5 - 0.5 * SX, 0.5 - 0.5 * SY, 0)
mp.inputs['Scale'].default_value = (SX, SY, 1)
l.new(tc.outputs['UV'], mp.inputs['Vector']); l.new(mp.outputs['Vector'], feed.inputs['Vector'])
em = n.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
l.new(feed.outputs['Color'], em.inputs['Color'])
# masque circulaire doux
sep = n.new('ShaderNodeSeparateXYZ'); l.new(tc.outputs['UV'], sep.inputs[0])
mx = n.new('ShaderNodeMath'); mx.operation = 'SUBTRACT'; mx.inputs[1].default_value = 0.5; l.new(sep.outputs[0], mx.inputs[0])
my = n.new('ShaderNodeMath'); my.operation = 'SUBTRACT'; my.inputs[1].default_value = 0.5; l.new(sep.outputs[1], my.inputs[0])
cmb = n.new('ShaderNodeCombineXYZ'); l.new(mx.outputs[0], cmb.inputs[0]); l.new(my.outputs[0], cmb.inputs[1])
ln = n.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; l.new(cmb.outputs[0], ln.inputs[0])
ramp = n.new('ShaderNodeMapRange'); ramp.inputs['From Min'].default_value = 0.5; ramp.inputs['From Max'].default_value = 0.42
l.new(ln.outputs['Value'], ramp.inputs['Value'])
tr = n.new('ShaderNodeBsdfTransparent')
mix = n.new('ShaderNodeMixShader')
# en sortant de la bille, le noir de l'image devient transparent : il ne reste que la flamme lumineuse
lum = n.new('ShaderNodeRGBToBW'); l.new(feed.outputs['Color'], lum.inputs[0])
lr_ = n.new('ShaderNodeMapRange'); lr_.inputs['From Min'].default_value = 0.03; lr_.inputs['From Max'].default_value = 0.22
l.new(lum.outputs[0], lr_.inputs['Value'])
DARKCLEAR = n.new('ShaderNodeValue'); DARKCLEAR.name = 'clair'; DARKCLEAR.outputs[0].default_value = 0.0
mixa = n.new('ShaderNodeMix'); mixa.data_type = 'FLOAT'
l.new(DARKCLEAR.outputs[0], mixa.inputs['Factor']); mixa.inputs['A'].default_value = 1.0
l.new(lr_.outputs['Result'], mixa.inputs['B'])
mult = n.new('ShaderNodeMath'); mult.operation = 'MULTIPLY'
l.new(ramp.outputs['Result'], mult.inputs[0]); l.new(mixa.outputs['Result'], mult.inputs[1])
l.new(mult.outputs[0], mix.inputs['Fac']); l.new(tr.outputs[0], mix.inputs[1]); l.new(em.outputs[0], mix.inputs[2])
DISC_MAT = m
l.new(mix.outputs[0], out.inputs['Surface'])
disc.data.materials.append(m)
disc.visible_shadow = False
disc.visible_diffuse = False   # le disque n'éclaire pas le décor (c'est la lumière ponctuelle qui s'en charge)

# ---------------------------------------------------------------- crayon (hexagonal, peinture jaune, mine, virole, gomme)
def add_obj(op, **kw):
    op(**kw); return bpy.context.object
pencil_parts = []
L_BODY, RP = 0.13, 0.0036
body = add_obj(bpy.ops.mesh.primitive_cylinder_add, vertices=6, radius=RP, depth=L_BODY, location=(0, 0, 0))
body.rotation_euler = (0, math.pi / 2, 0)
m, n, l = mat('Peinture'); b = n['Principled BSDF']; b.inputs['Base Color'].default_value = (0.85, 0.42, 0.02, 1); b.inputs['Roughness'].default_value = 0.28
b.inputs['Coat Weight'].default_value = 0.5
body.data.materials.append(m); pencil_parts.append(body)
bev = body.modifiers.new('bev', 'BEVEL'); bev.width = 0.0004; bev.segments = 2
tip = add_obj(bpy.ops.mesh.primitive_cone_add, vertices=48, radius1=RP * 0.93, radius2=0.0006, depth=0.02, location=(L_BODY / 2 + 0.01, 0, 0))
tip.rotation_euler = (0, math.pi / 2, 0)
m, n, l = mat('BoisTaille'); b = n['Principled BSDF']; b.inputs['Base Color'].default_value = (0.62, 0.42, 0.24, 1); b.inputs['Roughness'].default_value = 0.8
tip.data.materials.append(m); pencil_parts.append(tip)
lead = add_obj(bpy.ops.mesh.primitive_cone_add, vertices=24, radius1=0.00085, radius2=0.00012, depth=0.0045, location=(L_BODY / 2 + 0.0218, 0, 0))
lead.rotation_euler = (0, math.pi / 2, 0)
m, n, l = mat('Graphite'); b = n['Principled BSDF']; b.inputs['Base Color'].default_value = (0.04, 0.04, 0.045, 1); b.inputs['Metallic'].default_value = 0.6; b.inputs['Roughness'].default_value = 0.35
lead.data.materials.append(m); pencil_parts.append(lead)
fer = add_obj(bpy.ops.mesh.primitive_cylinder_add, vertices=48, radius=RP * 1.02, depth=0.011, location=(-L_BODY / 2 - 0.0055, 0, 0))
fer.rotation_euler = (0, math.pi / 2, 0)
m, n, l = mat('Virole'); b = n['Principled BSDF']; b.inputs['Base Color'].default_value = (0.75, 0.72, 0.65, 1); b.inputs['Metallic'].default_value = 1; b.inputs['Roughness'].default_value = 0.22
fer.data.materials.append(m); pencil_parts.append(fer)
era = add_obj(bpy.ops.mesh.primitive_cylinder_add, vertices=48, radius=RP * 0.98, depth=0.008, location=(-L_BODY / 2 - 0.015, 0, 0))
era.rotation_euler = (0, math.pi / 2, 0)
m, n, l = mat('Gomme'); b = n['Principled BSDF']; b.inputs['Base Color'].default_value = (0.8, 0.32, 0.3, 1); b.inputs['Roughness'].default_value = 0.7
era.data.materials.append(m); pencil_parts.append(era)
pencil = bpy.data.objects.new('Crayon', None); sc.collection.objects.link(pencil)
for p in pencil_parts: p.parent = pencil
pencil.location = (0.058, -0.02, RP * 0.866 + 0.0009)
pencil.rotation_euler = (0, 0, 2.55)

# ---------------------------------------------------------------- lumières
# lampe de bureau (disque chaud, hors champ en haut à gauche)
ld = bpy.data.lights.new('Lampe', 'AREA'); ld.shape = 'DISK'; ld.size = 0.16
ld.energy = float(os.environ.get("LAMP", "1.2")); ld.color = (1.0, 0.66, 0.36)
ld.cycles.is_caustics_light = True
lamp = bpy.data.objects.new('Lampe', ld); sc.collection.objects.link(lamp)
lamp.location = (-0.30, 0.16, 0.36)
d = (CENTER - lamp.location).normalized()
lamp.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
# contre-jour froid et discret (bord de la bille)
lr = bpy.data.lights.new('Contre', 'AREA'); lr.size = 0.3; lr.energy = 0.5; lr.color = (0.55, 0.7, 1.0)
rim = bpy.data.objects.new('Contre', lr); sc.collection.objects.link(rim)
rim.location = (0.35, 0.45, 0.22)
rim.rotation_euler = (CENTER - rim.location).normalized().to_track_quat('-Z', 'Y').to_euler()
# le cœur : lumière ponctuelle au centre de la bille ; le verre ne lui fait pas d'ombre (shadow linking)
lc = bpy.data.lights.new('Coeur', 'POINT'); lc.shadow_soft_size = 0.0004; lc.energy = 0.35; lc.color = (1.0, 0.55, 0.75)
core = bpy.data.objects.new('Coeur', lc); sc.collection.objects.link(core)
core.location = CENTER
core.visible_camera = False; core.visible_glossy = False; core.visible_transmission = False
blockers = bpy.data.collections.new('BloqueCoeur')
for p in pencil_parts: blockers.objects.link(p)
blockers.objects.link(paper)
core.light_linking.blocker_collection = blockers

marble.cycles.is_caustics_caster = True
paper.cycles.is_caustics_receiver = True
desk.cycles.is_caustics_receiver = True

# ---------------------------------------------------------------- poussières dans le faisceau (bokeh)
dust = []
m, n, l = mat('Poussiere'); b = n['Principled BSDF']; b.inputs['Base Color'].default_value = (0.9, 0.85, 0.8, 1); b.inputs['Roughness'].default_value = 0.6
b.inputs['Transmission Weight'].default_value = 0.3
for i in range(90):
    o = add_obj(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=1, radius=0.00018 + rnd.random() * 0.00025, location=(0, 0, 0))
    o.data.materials.append(m)
    o['p0'] = (rnd.uniform(-0.09, 0.07), rnd.uniform(-0.07, 0.09), rnd.uniform(0.01, 0.09))
    o['ph'] = rnd.random() * 10
    dust.append(o)

# ---------------------------------------------------------------- caméra : de l'intérieur de la bille au plan large
cam_data = bpy.data.cameras.new('Camera'); cam_data.sensor_fit = 'VERTICAL'; cam_data.sensor_height = 24
cam = bpy.data.objects.new('Camera', cam_data); sc.collection.objects.link(cam); sc.camera = cam
cam_data.clip_start = 0.0005
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 2.8
cam_data.dof.aperture_blades = 7

def cam_state(t):
    """Distance au centre, élévation, azimut, champ vertical (degrés)."""
    k = remap(t, T_PULL, T_PULL + 2.45)
    e = ease_io(k, 2.2)
    e2 = 1 - (1 - k) ** 3  # départ vif : on est « aspiré » hors de la bille
    ee = 0.55 * e2 + 0.45 * e
    fov0 = 56.0
    d0 = (RD / DG) / math.tan(math.radians(fov0) / 2)   # le disque remplit exactement le cadre
    d1 = 0.105
    dist = d0 * (d1 / d0) ** ee                          # recul exponentiel : vitesse perçue constante
    elev = math.radians(58 - 26 * e)
    az = math.radians(-8 + 10 * e)
    fov = fov0 + (27 - fov0) * e
    # après la pause : dérive très lente (respiration)
    s = remap(t, T_PULL + 2.45, 42.0)
    dist *= 1 + 0.035 * smooth(s)
    az += math.radians(2.5) * smooth(s)
    return dist, elev, az, fov

def place(t):
    dist, elev, az, fov = cam_state(t)
    dvec = Vector((math.sin(az) * math.cos(elev), -math.cos(az) * math.cos(elev), math.sin(elev)))
    cam.location = CENTER + dvec * dist
    cam.rotation_euler = (-dvec).to_track_quat('-Z', 'Y').to_euler()
    cam_data.sensor_height = 24
    cam_data.lens = 12 / math.tan(math.radians(fov) / 2)
    cam_data.dof.focus_distance = max(dist - RD * 0.1, 0.001)
    # f/ s'ouvre à mesure qu'on recule : profondeur de champ macro
    cam_data.dof.aperture_fstop = 16 - 13.2 * remap(dist, 0.02, 0.1)
    # le disque regarde la caméra (image droite)
    disc.rotation_euler = dvec.to_track_quat('Z', 'Y').to_euler()
    # le cœur se calme : sa lumière vire du magenta vers le blanc chaud
    c = smooth(remap(t, T_PULL, T_PULL + 3))
    lc.color = (1.0, 0.55 + 0.33 * c, 0.75 - 0.05 * c)
    DISC_MAT.node_tree.nodes['clair'].outputs[0].default_value = smooth(remap(t, T_PULL + 0.25, T_PULL + 1.1))
    lc.energy = float(os.environ.get("CORE", "0.004")) * (1.3 - 0.4 * c)
    for o in dust:
        p0, ph = o['p0'], o['ph']
        o.location = (p0[0] + 0.004 * math.sin(t * 0.37 + ph), p0[1] + 0.003 * math.cos(t * 0.29 + ph * 1.3), p0[2] + 0.003 * math.sin(t * 0.21 + ph * 0.7) + 0.0015 * (t - 36))

# images clés à chaque image (et aux demi-images pour le flou de mouvement)
sc.frame_start = a.start; sc.frame_end = a.end
objs = [cam, disc, core] + dust
for f10 in range((a.start - 1) * 2, (a.end + 1) * 2 + 1):
    f = f10 / 2
    sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
    place(f / FPS)
    for o in objs:
        o.keyframe_insert('location', frame=f)
        o.keyframe_insert('rotation_euler', frame=f)
    cam_data.keyframe_insert('lens', frame=f); cam_data.dof.keyframe_insert('focus_distance', frame=f); cam_data.dof.keyframe_insert('aperture_fstop', frame=f)
    lc.keyframe_insert('color', frame=f); lc.keyframe_insert('energy', frame=f)
    DISC_MAT.node_tree.nodes['clair'].outputs[0].keyframe_insert('default_value', frame=f)
for o in objs + [cam_data, lc]:
    ad = o.animation_data
    if ad and ad.action:
        for fc in ad.action.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

if a.fast >= 0:  # profils de test
    if a.fast >= 1: sc.render.use_motion_blur = False
    if a.fast >= 2: ld.cycles.is_caustics_light = False
    if a.fast >= 3: cam_data.dof.use_dof = False
    if a.fast >= 4:
        for mm in bpy.data.materials:
            if mm.name in ('Noyer', 'Papier'):
                nt = mm.node_tree
                for nd in list(nt.nodes):
                    if nd.type in ('TEX_NOISE', 'TEX_WAVE', 'BUMP'): nt.nodes.remove(nd)
    if a.fast >= 5:
        for o in dust: o.hide_render = True
    if a.fast >= 6:
        cy.max_bounces = 6; cy.transmission_bounces = 6; cy.glossy_bounces = 2; cy.diffuse_bounces = 1
if a.save_blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, a.save_blend))

# ---------------------------------------------------------------- rendu (reprise : les images existantes sont sautées)
outdir = os.path.join(ROOT, a.out); os.makedirs(outdir, exist_ok=True)
frames = [int(x) for x in a.only.split(',')] if a.only else list(range(a.start, a.end + 1))
import time
for f in frames:
    path = os.path.join(outdir, f'{f:05d}.png')
    if os.path.exists(path):
        continue
    t0 = time.time()
    sc.frame_set(f)
    sc.render.filepath = path + '.tmp.png'
    bpy.ops.render.render(write_still=True)
    os.replace(path + '.tmp.png', path)
    print(f'blender {f} {time.time() - t0:.1f}s', flush=True)
open(os.path.join(outdir, 'DONE'), 'w').write('ok') if not a.only else None
