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

## Data notes

- Yamanote weekday departures: JR East Shibuya timetable (2026). Weekend/holiday Yamanote rows and some Ginza Line hours are filled from the published headway for that hour.
- Platform layout: Yamanote track 1 (inner loop, for Shinagawa/Tokyo) and track 2 (outer loop, for Shinjuku/Ikebukuro); Ginza Line terminal platform above Meiji-dōri under the M-shaped roof.
- Buildings are simplified boxes placed on a metre grid centred on the crossing; heights of the landmark towers match the real ones.

## Code

`src/` — `layout.js` (map, signal cycle, Ginza curve), `world.js` (city), `rail.js` (trains, platform doors, departure boards), `timetable.js`, `crowd.js`, `traffic.js`, `sky.js`, `player.js`, `hud.js`, `audio.js`, `main.js`. Three.js r169 is vendored in `vendor/` (MIT).
