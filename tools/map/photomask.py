# Photo -> projector texture: alpha 0 on sky (flood fill from the top), crowds, poles, trees (polygons), WebP with alpha.
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
src, spec, out = sys.argv[1:4]
S = json.load(open(spec))
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.int16)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx, mn = a.max(axis=2), a.min(axis=2)
skyish = ((mx > 165) & (mx - mn < 70) & (b >= r - 10)) | ((b > r + 25) & (b > 120))
lab, n = ndimage.label(skyish)
top = set(np.unique(lab[:max(4, S.get('skyrows', 6)), :])) - {0}
sky = np.isin(lab, list(top))
sky = ndimage.binary_dilation(sky, iterations=3)
keep = Image.new('L', im.size, 0); dk = ImageDraw.Draw(keep)
for poly in S.get('keep', []): dk.polygon([tuple(p) for p in poly], fill=255)
sky &= np.asarray(keep) == 0
mask = Image.fromarray(np.where(sky, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(mask)
for poly in S.get('cut', []): d.polygon([tuple(p) for p in poly], fill=0)
if 'below' in S: d.rectangle((0, S['below'], im.width, im.height), fill=0)
mask = mask.filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(2))
rgba = im.copy(); rgba.putalpha(mask)
w = S.get('width', im.width)
if w != im.width: rgba = rgba.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
rgba.save(out, quality=82, method=5)
print(out, rgba.size)
