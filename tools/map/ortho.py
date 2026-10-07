import math, os, sys, urllib.request, concurrent.futures as cf
from PIL import Image
LAT0, LON0 = 35.6595, 139.70052
KX = 111320 * math.cos(math.radians(LAT0)); KZ = 110950
Z = 18; N = 2 ** Z
def merc(lat, lon):
    x = (lon + 180) / 360 * N
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    return x * 256, y * 256
X0, Z0, X1, Z1, RES = -640, -700, 700, 740, 0.5
def ll(x, z): return LAT0 - z / KZ, LON0 + x / KX
px0, py0 = merc(*ll(X0, Z0)); px1, py1 = merc(*ll(X1, Z1))
tx0, ty0, tx1, ty1 = int(px0 // 256), int(py0 // 256), int(px1 // 256), int(py1 // 256)
D = 'gsi/t18'
def get(t):
    x, y = t; f = f'{D}/{x}_{y}.jpg'
    if not os.path.exists(f):
        urllib.request.urlretrieve(f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{Z}/{x}/{y}.jpg', f)
    return f
tiles = [(x, y) for x in range(tx0, tx1 + 1) for y in range(ty0, ty1 + 1)]
with cf.ThreadPoolExecutor(8) as ex: list(ex.map(get, tiles))
mos = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
for x, y in tiles: mos.paste(Image.open(f'{D}/{x}_{y}.jpg'), ((x - tx0) * 256, (y - ty0) * 256))
W, H = int((X1 - X0) / RES), int((Z1 - Z0) / RES)
out = Image.new('RGB', (W, H))
# x maps linearly in lon -> mercator x; z maps per row
ax = (merc(LAT0, LON0 + 1 / KX)[0] - merc(LAT0, LON0)[0])  # merc px per metre east
row = Image.new('RGB', (W, 1))
for j in range(H):
    z = Z0 + (j + 0.5) * RES
    lat, lon = ll(X0, z)
    mx, my = merc(lat, lon)
    sx = mx - tx0 * 256; sy = my - ty0 * 256
    strip = mos.transform((W, 1), Image.AFFINE, (ax * RES, 0, sx + ax * RES * 0.5 - 0.5, 0, 0, sy - 0.5), resample=Image.BILINEAR)
    out.paste(strip, (0, j))
out.save('gsi/ortho_05.png')
print(W, H, len(tiles))
