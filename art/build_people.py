# Builds the CC0 people assets used by js/people.js. Run headless:
#   blender -b --python art/build_people.py -- <UniversalBaseCharacters dir> <UAL1_Standard.glb> <out dir>
# Sources (both CC0, by Quaternius): Universal Base Characters [Standard], Universal Animation Library [Standard].
# The base bodies only wear underwear, so every face is reassigned to a clothing region (Top, Sleeve, Bottom,
# Shoes, Tudung) by its dominant bone; js/people.js colours those regions per role (murid, guru, VIP...).
import bpy, bmesh, os, sys
from collections import Counter

ubc, ual, out = sys.argv[sys.argv.index('--') + 1:][:3]
base = os.path.join(ubc, 'Base Characters', 'Godot - UE')
hairdir = os.path.join(ubc, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)')
os.makedirs(out, exist_ok=True)
KEEP_ANIMS = ['Walk_Loop', 'Walk_Formal_Loop', 'Idle_Loop', 'Idle_Talking_Loop', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop']

REGION = {}
for b in ('foot', 'ball', 'ball_leaf'): REGION[b] = 'Shoes'
for b in ('pelvis', 'thigh', 'calf'): REGION[b] = 'Bottom'
for b in ('spine_01', 'spine_02', 'spine_03', 'clavicle', 'upperarm'): REGION[b] = 'Top'
REGION['lowerarm'] = 'Sleeve'
for b in ('neck_01', 'Head'): REGION[b] = 'Head'

def region_of(bone):
    name = bone[:-2] if bone[-2:] in ('_l', '_r') else bone
    return REGION.get(name, 'Skin')  # hands and fingers

def flat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1); bsdf.inputs['Roughness'].default_value = 0.8
    return m

def shrink_textures(px=1024):
    for img in bpy.data.images:
        if img.size[0] > px: img.scale(px, px)

def build(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(base, f'Superhero_{kind}_FullBody.gltf'))
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.parent is None]: bpy.data.objects.remove(o)  # stray icosphere
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    body = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    body.name = 'Body'; body['lod'] = True
    skin = body.data.materials[0]; skin.name = 'Skin'
    # drop normal/roughness maps: 1K base colour is plenty at planning distance
    for n in list(skin.node_tree.nodes):
        if n.type == 'TEX_IMAGE' and 'BaseColor' not in n.image.name and 'Dark' not in n.image.name and 'Ligh' not in n.image.name:
            skin.node_tree.nodes.remove(n)
    mats = {'Skin': skin}
    for r, rgb in (('Top', (0.95, 0.95, 0.95)), ('Sleeve', (0.95, 0.95, 0.95)), ('Bottom', (0.1, 0.15, 0.35)), ('Shoes', (0.05, 0.05, 0.05))):
        mats[r] = flat(r, rgb)
    if kind == 'Female': mats['Tudung'] = flat('Tudung', (0.97, 0.97, 0.97))
    for r in mats:
        if r != 'Skin': body.data.materials.append(mats[r])
    slot = {m.name: i for i, m in enumerate(body.data.materials)}

    names = {g.index: g.name for g in body.vertex_groups}
    def dominant(v):
        gs = [g for g in v.groups if g.weight > 0]
        return names[max(gs, key=lambda g: g.weight).group] if gs else 'root'
    vreg = [region_of(dominant(v)) for v in body.data.vertices]
    co = [v.co for v in body.data.vertices]
    nrm = [v.normal for v in body.data.vertices]
    top = max(c.z for c in co)
    for p in body.data.polygons:
        rs = Counter(vreg[i] for i in p.vertices).most_common(1)[0][0]
        if rs == 'Head':
            c = sum((co[i] for i in p.vertices), co[p.vertices[0]] * 0) / len(p.vertices)
            n = sum((nrm[i] for i in p.vertices), nrm[p.vertices[0]] * 0)
            # face = forward-facing part of the head between chin and brow; the rest is scalp/neck
            face = n.y < -0.25 * n.length and top - 0.205 < c.z < top - 0.06 and abs(c.x) < 0.075
            rs = 'Skin' if face or kind == 'Male' else 'Tudung'
        elif kind == 'Female' and rs == 'Top':
            c = sum((co[i] for i in p.vertices), co[p.vertices[0]] * 0) / len(p.vertices)
            if c.z > top - 0.36 and abs(c.x) < 0.2: rs = 'Tudung'  # tudung drapes over shoulders and chest
        p.material_index = slot[rs]

    if kind == 'Male':
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(hairdir, 'Hair_SimpleParted.gltf'))
        new = set(bpy.data.objects) - before
        for o in new:
            if o.type == 'MESH':
                o.name = 'Hair'; o['lod'] = True; mw = o.matrix_world.copy(); o.parent = arm; o.matrix_world = mw
                for m in list(o.modifiers): o.modifiers.remove(m)
                o.modifiers.new('Armature', 'ARMATURE').object = arm
                if 'Head' not in o.vertex_groups:
                    g = o.vertex_groups.new(name='Head'); g.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
                o.data.materials.clear(); o.data.materials.append(flat('Hair', (0.03, 0.025, 0.02)))
        for o in new:
            if o.type != 'MESH': bpy.data.objects.remove(o)
    shrink_textures()
    return arm

def export(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLB', export_animations=False,
                              export_image_format='JPEG', export_jpeg_quality=80, export_skins=True)

for kind in ('Male', 'Female'):
    arm = build(kind)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    export(os.path.join(out, f'{kind.lower()}.glb'), [arm] + meshes)
    # crowd LOD: decimated body (+hair), no eyes/eyebrows; posed and instanced at runtime
    for o in meshes:
        if not o.get('lod'): bpy.data.objects.remove(o)
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        d = o.modifiers.new('Decimate', 'DECIMATE'); d.ratio = 0.075 if o.name.startswith('Body') else 0.15
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_move_to_index(modifier='Decimate', index=0)
        bpy.ops.object.modifier_apply(modifier='Decimate')
    export(os.path.join(out, f'{kind.lower()}_lod.glb'), [arm] + [o for o in bpy.data.objects if o.type == 'MESH'])

# animations: UAL armature only, trimmed to the clips the planner uses
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ual)
for o in [o for o in bpy.data.objects if o.type == 'MESH']: bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    if a.name not in KEEP_ANIMS: bpy.data.actions.remove(a)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'anims.glb'), use_selection=True, export_format='GLB',
                          export_animations=True, export_animation_mode='ACTIONS', export_skins=True)
print('DONE', sorted(os.listdir(out)))
