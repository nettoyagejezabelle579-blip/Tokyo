# Shibuya Live Walk

A first-person 3D walk around the real Shibuya Station area that runs on Tokyo time.

- **Real clock**: Japan Standard Time drives the sun, moon, night lights and seasonal trees.
- **Real trains**: JR Yamanote Line (both loops) and Tokyo Metro Ginza Line arrive and depart on the Shibuya timetable. Weekday/土休日 schedules and national holidays are handled, and trains after midnight count as the previous service day.
- **Real city**: every building, road, sidewalk, bridge and street tree within about 700 m of the Scramble Crossing comes from Japan's official 3D city model, [Project PLATEAU](https://www.mlit.go.jp/plateau/) (MLIT), Shibuya-ku 2023, with the aerial facade photos it was textured from. Shibuya Scramble Square, Hikarie, Stream, Mark City, QFRONT, SHIBUYA109, Miyashita Park and the JR viaduct stand at their surveyed positions and heights.
- **Real streets**: the five Scramble crosswalks, stop lines, Hachikō, the giant screens, the Center Gai gate, both rail alignments, the Yamanote island platform beside Hachikō Square and the Ginza Line terminal over Meiji-dōri are placed from PLATEAU rail data and the GSI (国土地理院) aerial photo, which is also the minimap. Crowds walk the real sidewalks and cars drive the real lanes. Mt Fuji, Tokyo Tower, Skytree and Shinjuku sit at their real bearings.

## Play

Serve the folder with any static server and open `index.html`:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

| Desktop | Phone |
| --- | --- |
| `WASD` walk, `Shift` run, mouse look (click to lock), `Space` jump | left thumb walk, right thumb look |
| `E` use (Hachikō Gate ↔ Yamanote platform, East Exit ↔ Ginza platform, Scramble Square ↔ SHIBUYA SKY), `M` map, `Esc` menu | RUN / JUMP buttons, tap the minimap for the map |

The menu has fast travel, a time slider (look at another hour; LIVE snaps back) and a battery-saver mode.

## Photoreal mode (Google 3D Tiles)

Menu → **World → Photoreal · Google 3D Tiles** swaps the PLATEAU city for Google's Photorealistic 3D Tiles (the 3D city from Google Earth). Clock, signals, trains, crowds and cars stay live on the same real coordinates; `F` or the FLY button toggles flying. Google's tiles are streamed live and cannot be stored, so this mode needs the key every time; the PLATEAU city is in this repository and works offline.

1. In Google Cloud, enable the **Map Tiles API** and create an API key ([guide](https://developers.google.com/maps/documentation/tile/get-api-key)). Restrict it to your site's address. Google bills per session after the free monthly quota.
2. Host the game (the claude.ai preview link cannot reach Google). GitHub Pages: repository **Settings → Pages → Deploy from a branch**, pick this branch and `/ (root)`, save, then open `https://<user>.github.io/Tokyo/`.
3. Paste the key in the menu (stored only in that browser) or open the page as `…/Tokyo/?key=YOUR_KEY`.

Libraries: [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS), [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) and three.js's Draco decoder, vendored in `vendor/` (Apache-2.0 / MIT).

## Data notes

- City model: 「3D都市モデル（Project PLATEAU）渋谷区（2023年度）」, 国土交通省, from [G空間情報センター](https://www.geospatial.jp/ckan/dataset/plateau-13113-shibuya-ku-2023), used under the [PLATEAU Site Policy](https://www.mlit.go.jp/plateau/site-policy/) (compatible with CC BY 4.0). Buildings LOD2 with facade textures, roads/sidewalks LOD3, bridges, street furniture and trees; converted to Draco glTF in `assets/plateau/` (textures reduced to 1024 px WebP). The facade photos were taken from the air, so walls look soft up close: shapes and positions are survey-accurate, surface detail is not.
- Aerial photo and minimap: 国土地理院 シームレス空中写真 ([GSI tiles](https://maps.gsi.go.jp/development/ichiran.html)), 出典：国土地理院.
- Yamanote weekday departures: JR East Shibuya timetable (2026). Weekend/holiday Yamanote rows and some Ginza Line hours are filled from the published headway for that hour.
- Rail: Yamanote outer loop (for Shinjuku/Ikebukuro) on the west track, inner loop (for Shinagawa/Tokyo) on the east track of the island platform; the open-air north end of the platform is modelled, the rest runs inside the station building. Ginza Line terminal on the 3rd floor over Meiji-dōri, viaduct and tunnel portal toward Omotesandō.
- Night windows are generated: lit panes appear where the facade photo shows dark glass.

## Code

`src/` — `geo.js` (real coordinates: crosswalks, rail alignments, roads, spots, signal cycle), `city.js` (PLATEAU loader, street heightfield, night windows, mesh physics), `details.js` (crosswalk paint, Hachikō, screens, platforms, viaduct), `pbr.js` (procedural PBR textures), `render.js` (ambient occlusion, bloom, tone mapping), `rail.js` (trains, platform doors, departure boards), `timetable.js`, `crowd.js` (jointed pedestrians), `traffic.js` (extruded vehicles), `sky.js` (sky, sun/moon, image-based lighting), `player.js`, `hud.js`, `audio.js`, `main.js`. Three.js r169 and the addons it needs are vendored in `vendor/` (MIT). `tools/plateau-view.html` is a viewer for the converted tiles.

Rendering: physically based materials lit by the sun and a sky environment map, soft shadows, GTAO ambient occlusion, MSAA and bloom on desktop. Phones use a lighter preset (no AO/MSAA); switch with the menu's quality buttons.
