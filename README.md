# Shibuya Live Walk

A first-person 3D walk around Shibuya Station that runs on Tokyo time.

- **Real clock**: Japan Standard Time drives the sun, moon, night lights and seasonal trees.
- **Real trains**: JR Yamanote Line (both loops) and Tokyo Metro Ginza Line arrive and depart on the Shibuya timetable. Weekday/土休日 schedules and national holidays are handled, and trains after midnight count as the previous service day.
- **Real places**: the Scramble Crossing (120 s cycle with the all-way pedestrian phase), Hachikō, Q-FRONT, MAGNET, SHIBUYA109, Center Gai, Shibuya Scramble Square with SHIBUYA SKY at 229.7 m, Hikarie, Stream and the Shibuya River, Sakura Stage, Fukuras, Mark City, Miyashita Park, Seibu, PARCO, Route 246 under the Shuto Expressway. Mt Fuji, Tokyo Tower, Skytree and Shinjuku sit at their real bearings.

## Play

Serve the folder with any static server and open `index.html`:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

| Desktop | Phone |
| --- | --- |
| `WASD` walk, `Shift` run, mouse look (click to lock), `Space` jump | left thumb walk, right thumb look |
| `E` elevator (Scramble Square ↔ SHIBUYA SKY), `M` map, `Esc` menu | RUN / JUMP buttons, tap the minimap for the map |

The menu has fast travel, a time slider (look at another hour; LIVE snaps back) and a battery-saver mode.

## Photoreal mode (Google 3D Tiles)

Menu → **World → Photoreal · Google 3D Tiles** swaps the hand-built city for Google's Photorealistic 3D Tiles (the 3D city from Google Earth). Clock, signals and train timetables stay live; the simulated crowd and cars walk the real crossing (use *Line up the crowd* to rotate them onto the real crosswalks); `F` or the FLY button toggles flying.

1. In Google Cloud, enable the **Map Tiles API** and create an API key ([guide](https://developers.google.com/maps/documentation/tile/get-api-key)). Restrict it to your site's address. Google bills per session after the free monthly quota.
2. Host the game (the claude.ai preview link cannot reach Google). GitHub Pages: repository **Settings → Pages → Deploy from a branch**, pick this branch and `/ (root)`, save, then open `https://<user>.github.io/Tokyo/`.
3. Paste the key in the menu (stored only in that browser) or open the page as `…/Tokyo/?key=YOUR_KEY`.

Libraries: [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS), [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) and three.js's Draco decoder, vendored in `vendor/` (Apache-2.0 / MIT).

## Data notes

- Yamanote weekday departures: JR East Shibuya timetable (2026). Weekend/holiday Yamanote rows and some Ginza Line hours are filled from the published headway for that hour.
- Platform layout: Yamanote track 1 (inner loop, for Shinagawa/Tokyo) and track 2 (outer loop, for Shinjuku/Ikebukuro); Ginza Line terminal platform above Meiji-dōri under the M-shaped roof.
- Buildings are simplified boxes placed on a metre grid centred on the crossing; heights of the landmark towers match the real ones.

## Code

`src/` — `layout.js` (map, signal cycle, Ginza curve), `world.js` (city), `pbr.js` (procedural PBR textures: albedo, normal, roughness/metal, night emissive), `render.js` (ambient occlusion, bloom, tone mapping), `rail.js` (trains, platform doors, departure boards), `timetable.js`, `crowd.js` (jointed pedestrians), `traffic.js` (extruded vehicles), `sky.js` (sky, sun/moon, image-based lighting), `player.js`, `hud.js`, `audio.js`, `main.js`. Three.js r169 and the addons it needs are vendored in `vendor/` (MIT).

Rendering: physically based materials lit by the sun and a sky environment map, soft shadows, GTAO ambient occlusion, MSAA and bloom on desktop. Phones use a lighter preset (no AO/MSAA); switch with the menu's quality buttons.
