# Ground-floor building walls that face a street: bottom edges of vertical PLATEAU wall triangles whose
# outward side opens onto a sidewalk/road cell. Output: [[x0,z0,x1,z1,h], ...] (h = wall height above street).
import numpy as np, json, sys, math
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
T = np.fromfile(sys.argv[1], dtype=np.float32).reshape(-1, 10)
T = T[T[:, 0] == 0]  # buildings
mask = np.asarray(Image.open(sys.argv[2]).convert('L'))
G = json.load(open(sys.argv[3]))  # ground meta
hf = np.fromfile(sys.argv[4], dtype=np.int16).reshape(G['h'], G['w']) / 100.0
def ground(x, z):
    i = min(G['w'] - 2, max(0, int((x - G['x0']) / G['step']))); j = min(G['h'] - 2, max(0, int((z - G['z0']) / G['step'])))
    return hf[j, i]
def street(x, z):
    i, j = int((x + 640) / 0.5), int((z + 700) / 0.5)
    return 0 <= j < mask.shape[0] and 0 <= i < mask.shape[1] and mask[j, i] in (128, 255)
A, B, C = T[:, 1:4], T[:, 4:7], T[:, 7:10]
N = np.cross(B - A, C - A); L = np.linalg.norm(N, axis=1) + 1e-9; N /= L[:, None]
vert = np.abs(N[:, 1]) < 0.15
out = []
R = float(sys.argv[6]) if len(sys.argv) > 6 else 450
for t in np.nonzero(vert)[0]:
    P = [A[t], B[t], C[t]]; ys = [p[1] for p in P]; ymin, ymax = min(ys), max(ys)
    # bottom edge: the two lowest vertices, both near ymin
    idx = sorted(range(3), key=lambda k: P[k][1])
    a, b = P[idx[0]], P[idx[1]]
    if b[1] - a[1] > 0.5: continue
    dx, dz = b[0] - a[0], b[2] - a[2]; seg = math.hypot(dx, dz)
    if seg < 2.5: continue
    mx, mz = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
    if math.hypot(mx, mz) > R: continue
    g = ground(mx, mz)
    if ymin > g + 1.5 or ymax < g + 4.5: continue  # wall must reach the street and rise above a storey
    nx, nz = N[t, 0], N[t, 2]; nl = math.hypot(nx, nz); nx, nz = nx / nl, nz / nl
    if not (street(mx + nx * 2.5, mz + nz * 2.5) or street(mx + nx * 4, mz + nz * 4)): continue
    # orient so that the outward normal is the right-hand side of a->b (normal = (dz, -dx)/len)
    if (dz * nx - dx * nz) < 0: a, b = b, a
    out.append([round(float(a[0]), 2), round(float(a[2]), 2), round(float(b[0]), 2), round(float(b[2]), 2), round(float(ymax - g), 1)])
json.dump(out, open(sys.argv[5], 'w'), separators=(',', ':'))
print(len(out), 'frontages', sum(math.hypot(o[2] - o[0], o[3] - o[1]) for o in out) / 1000, 'km')
