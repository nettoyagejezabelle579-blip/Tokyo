# Route pedestrian paths along PLATEAU sidewalks (A* on a 1 m grid; roads allowed but costly)
import json, heapq, math, sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
X0, Z0 = -640, -700
m = np.asarray(Image.open('gsi/roadmask.png').convert('L'))
H, W = m.shape[0] // 2, m.shape[1] // 2
blk = m[:H * 2, :W * 2].reshape(H, 2, W, 2)
walk = (blk == 128).any(axis=(1, 3)); road = (blk == 255).any(axis=(1, 3)); med = (blk == 64).any(axis=(1, 3))
cost = np.full((H, W), np.inf); cost[road] = 9.0; cost[med] = 4.0; cost[walk] = 1.0
# prefer the middle of sidewalks a little: cells next to non-walk cost more
from scipy.ndimage import distance_transform_edt
dist = distance_transform_edt(walk)
cost[walk] += np.clip(1.6 - dist[walk] * 0.4, 0, 1.2)
cell = lambda x, z: (int(round(x - X0)), int(round(z - Z0)))
def snap(x, z):
    i, j = cell(x, z)
    if walk[j, i]: return i, j
    best = None
    for r in range(1, 25):
        for dj in range(-r, r + 1):
            for di in (-r, r) if abs(dj) != r else range(-r, r + 1):
                jj, ii = j + dj, i + di
                if 0 <= jj < H and 0 <= ii < W and walk[jj, ii]:
                    d = math.hypot(di, dj)
                    if best is None or d < best[0]: best = (d, ii, jj)
        if best: return best[1], best[2]
    return i, j
def astar(a, b):
    (ai, aj), (bi, bj) = a, b
    openq = [(0, ai, aj)]; g = {(ai, aj): 0}; came = {}
    while openq:
        f, i, j = heapq.heappop(openq)
        if (i, j) == (bi, bj): break
        for di, dj in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
            ii, jj = i + di, j + dj
            if not (0 <= ii < W and 0 <= jj < H): continue
            c = cost[jj, ii]
            if c == np.inf: continue
            ng = g[(i, j)] + c * (1.4142 if di and dj else 1)
            if ng < g.get((ii, jj), 1e18):
                g[(ii, jj)] = ng; came[(ii, jj)] = (i, j)
                heapq.heappush(openq, (ng + math.hypot(bi - ii, bj - jj), ii, jj))
    path = [(bi, bj)]
    while path[-1] != (ai, aj):
        if path[-1] not in came: return None
        path.append(came[path[-1]])
    return path[::-1]
def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    ab = b - a; L = np.hypot(*ab) or 1
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / L for p in pts]
    k = int(np.argmax(d))
    if d[k] > tol: return dp(pts[:k + 1], tol)[:-1] + dp(pts[k:], tol)
    return [pts[0], pts[-1]]
def route(wps):
    out = []
    for a, b in zip(wps, wps[1:]):
        p = astar(snap(*a), snap(*b))
        if p is None: print('no path', a, b, file=sys.stderr); p = [snap(*a), snap(*b)]
        out += p if not out else p[1:]
    pts = [(i + X0, j + Z0) for i, j in out]
    return [[round(x, 1), round(z, 1)] for x, z in dp(pts, 0.9)]
spec = json.load(open(sys.argv[1]))
res = {k: [route(w) for w in v] for k, v in spec.items()}
json.dump(res, open(sys.argv[2], 'w'))
for k, v in res.items(): print(k, [len(p) for p in v])
