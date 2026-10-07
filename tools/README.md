# Data tools

Regenerate `assets/` from the open data. Not needed to play.

1. Download `13113_shibuya-ku_pref_2023_citygml_2_op` 3D Tiles from [G空間情報センター](https://www.geospatial.jp/ckan/dataset/plateau-13113-shibuya-ku-2023) and unzip the bldg/tran/brid/frn/veg tilesets into one folder.
2. `cd tools/plateau && npm install`
3. `node convert.mjs <tiles folder> ../../assets/plateau` converts every tile within about 700 m of the crossing to Draco glTF in the game frame (origin = Scramble Crossing, x east, z south, metres; textures to 1024 px WebP), splitting roads and street furniture by class.
4. `node probe.mjs ../../assets/plateau cache` writes a triangle cache (`assets/tris.bin`, delete it afterwards); `node groundgen.mjs ../../assets/tris.bin ../../assets/plateau/ground.bin` writes the street heightfield (4 m grid of the lowest road surface, holes filled), referenced as `ground` in `index.json`. `node probe.mjs ../../assets/plateau v <x> <z>` lists the surfaces above a point.
5. `tools/map/ortho.py` stitches GSI seamless aerial photo tiles (出典：国土地理院) into the game-frame image used for the minimap; `roadmask.mjs` + `walkpaths.py` route the crowd's walking paths along the PLATEAU sidewalks (output pasted into `src/geo.js`).

`plateau-view.html` shows the converted tiles (`?view=top&s=100` or `?view=persp&px=..&py=..&pz=..&lx=..&ly=..&lz=..`).
