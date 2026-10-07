import * as THREE from 'three';
import { sun, moon } from './time.js';
import { rng, smooth, lerp } from './util.js';
import { facades } from './pbr.js';

const VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`;
const FS = `
uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunCol; uniform float uNight; uniform float uTime; uniform float uCloud; uniform float uMoonPhase;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = max(d.y, 0.0);
  vec3 col = mix(uHor, uZen, pow(y, 0.48));
  // below the horizon: darker haze (seen in reflections)
  if (d.y < 0.0) col = mix(uHor, uHor * vec3(0.42, 0.42, 0.44), smoothstep(0.0, 0.25, -d.y));
  // city glow at night near the horizon
  col += vec3(0.32,0.17,0.08) * uNight * pow(1.0 - y, 6.0) * 0.6;
  float sd = max(dot(d, uSun), 0.0);
  col += uSunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 12.0) * 0.35 + pow(sd, 3.0) * 0.12) * (1.0 - uNight * 0.9);
  // moon
  float md = max(dot(d, uMoon), 0.0);
  col += vec3(0.85,0.88,1.0) * (smoothstep(0.99985, 0.99992, md) * (0.4 + 0.6 * uMoonPhase) + pow(md, 60.0) * 0.08) * uNight;
  // stars
  if (uNight > 0.3 && d.y > 0.05) {
    vec2 sp = d.xz / (d.y + 0.2) * 220.0;
    float s = step(0.9975, h(floor(sp))) * smoothstep(0.3, 1.0, uNight) * 0.55;
    col += vec3(s);
  }
  // clouds on a plane
  if (d.y > 0.0) {
    vec2 cp = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
    float c = fbm(cp);
    c = smoothstep(0.55 - uCloud * 0.25, 0.9, c) * smoothstep(0.0, 0.25, d.y);
    vec3 cc = mix(vec3(1.0), uSunCol, 0.35) * (1.0 - uNight * 0.85) + vec3(0.12,0.09,0.08) * uNight;
    col = mix(col, cc, c * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.uni = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, 1, 0) },
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uNight: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.5 }, uMoonPhase: { value: 0.5 },
    };
    const skyMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uni, side: THREE.BackSide, depthWrite: false, fog: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(15000, 32, 16), skyMat);
    dome.renderOrder = -1; dome.frustumCulled = false; dome.userData.noAO = true;
    scene.add(dome); this.dome = dome;
    // environment (image based lighting) captured from the sky + a city-coloured ground
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    const envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ vertexShader: VS.replace('gl_Position.z = gl_Position.w;', ''), fragmentShader: FS, uniforms: this.uni, side: THREE.BackSide, depthWrite: false }));
    this.envScene.add(envDome);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(48, 32).rotateX(-Math.PI / 2).translate(0, -2, 0), new THREE.MeshBasicMaterial({ color: 0x5a5854 }));
    this.envScene.add(this.envGround);
    this.envAt = -1e9; this.envEl = 999; this.scene = scene;

    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b6257, 0.4);
    scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 2.5);
    this.dir.castShadow = true;
    const sc = this.dir.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 900;
    this.dir.shadow.mapSize.set(2048, 2048);
    this.dir.shadow.bias = -0.0003; this.dir.shadow.normalBias = 0.05; this.dir.shadow.radius = 2;
    scene.add(this.dir); scene.add(this.dir.target);
    scene.fog = new THREE.FogExp2(0xc8d6e0, 0.0011);
    this.buildFar(scene);
    this.sunDir = new THREE.Vector3();
    this.night = 0;
  }

  buildFar(scene0) {
    const scene = (this.farGroup = new THREE.Group()); scene0.add(scene);
    const R = rng(99);
    const F = facades();
    // distant city: instanced boxes in a ring around the playable area
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const rep = (t) => { const c = t.clone(); c.repeat.set(2, 4); c.needsUpdate = true; return c; };
    const fs = F.concrete;
    this.farMat = new THREE.MeshStandardMaterial({ map: rep(fs.map), normalMap: rep(fs.normal), roughnessMap: rep(fs.orm), metalnessMap: rep(fs.orm), roughness: 1, metalness: 1, emissiveMap: rep(fs.emi), emissive: 0xffffff, emissiveIntensity: 0 });
    const N = 4200;
    // rooftops seen from above: concrete with plant, tanks and billboards
    const rc = document.createElement('canvas'); rc.width = rc.height = 256;
    { const g = rc.getContext('2d'); g.fillStyle = '#8e8f90'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.12})`; g.fillRect(R() * 256, R() * 256, 3, 3); }
      g.strokeStyle = '#c9c9c6'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246);
      for (let i = 0; i < 7; i++) { g.fillStyle = R() < 0.5 ? '#d9d9d6' : '#6f7275'; g.fillRect(30 + R() * 170, 30 + R() * 170, 18 + R() * 40, 14 + R() * 30); }
      g.fillStyle = '#b8bcc0'; g.beginPath(); g.arc(70 + R() * 100, 70 + R() * 100, 16, 0, 7); g.fill(); }
    const roofTex = new THREE.CanvasTexture(rc); roofTex.colorSpace = THREE.SRGBColorSpace;
    this.roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.9 });
    const sideM = this.farMat;
    const im = new THREE.InstancedMesh(geo, [sideM, sideM, this.roofMat, this.roofMat, sideM, sideM], N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    let k = 0;
    while (k < N) {
      const a = R() * Math.PI * 2, r = 700 + Math.pow(R(), 0.7) * 3600;
      const x = Math.cos(a) * r, z = Math.sin(a) * r + 50;
      if (x > -700 && x < 760 && z > -760 && z < 800) continue; // the PLATEAU city covers this
      const w = 12 + R() * 30, d = 12 + R() * 30;
      let h = 6 + Math.pow(R(), 2.6) * 55;
      if (R() < 0.03) h = 80 + R() * 90;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() < 0.6 ? 0 : R());
      im.setMatrixAt(k, m.compose(p.set(x, 0, z), q, s.set(w, h, d)));
      const pal = [[0.92, 0.9, 0.86], [0.8, 0.78, 0.74], [0.7, 0.66, 0.6], [0.95, 0.95, 0.95], [0.62, 0.6, 0.6], [0.78, 0.72, 0.64], [0.55, 0.6, 0.68]][Math.floor(R() * 7)];
      const v = 0.85 + R() * 0.25; im.setColorAt(k, c.setRGB(pal[0] * v, pal[1] * v, pal[2] * v));
      k++;
    }
    im.receiveShadow = false; im.castShadow = false;
    scene.add(im);

    // landmarks (real bearings/distances from Shibuya)
    const lm = (mesh, x, z) => { mesh.position.set(x, 0, z); scene.add(mesh); return mesh; };
    const L = (o) => new THREE.MeshLambertMaterial(o);
    this.lmMats = [];
    // Tokyo Tower (333 m) ~4.1 km east
    {
      const g = new THREE.Group();
      const red = L({ color: 0xe8461e, emissive: 0xff6a00, emissiveIntensity: 0 }), white = L({ color: 0xf2f2f2, emissive: 0xffa040, emissiveIntensity: 0 });
      this.towerMats = [red, white];
      const bands = 10;
      for (let i = 0; i < bands; i++) {
        const y0 = i * 25, y1 = (i + 1) * 25;
        const r0 = 45 * Math.pow(1 - y0 / 335, 1.8) + 3, r1 = 45 * Math.pow(1 - y1 / 335, 1.8) + 3;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 25, 4, 1, true), i % 2 ? white : red);
        mesh.position.y = (y0 + y1) / 2; mesh.rotation.y = Math.PI / 4; g.add(mesh);
      }
      for (const [y, r] of [[150, 12], [250, 6]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 8, 8), white); d.position.y = y; g.add(d); }
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.5, 85, 6), red); sp.position.y = 292; g.add(sp);
      lm(g, 4061, 100);
    }
    // Tokyo Skytree (634 m) ~11.4 km ENE
    {
      const g = new THREE.Group();
      const mat = L({ color: 0xdfe6ee, emissive: 0x6a8cff, emissiveIntensity: 0 });
      this.skytreeMat = mat;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 34, 500, 12), mat); shaft.position.y = 250; g.add(shaft);
      for (const [y, r] of [[350, 18], [450, 12]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 14, 16), mat); d.position.y = y; g.add(d); }
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4, 134, 8), mat); sp.position.y = 567; g.add(sp);
      lm(g, 9967, -5614);
    }
    // Shinjuku skyline ~3.4 km north
    const tower = (x, z, w, d, h, color = 0x9aa6b1) => {
      const mat = new THREE.MeshLambertMaterial({ color, map: F.glass.map, emissiveMap: F.glass.emi, emissive: 0xffffff, emissiveIntensity: 0 });
      mat.map = F.glass.map.clone(); mat.map.repeat.set(w / 12, h / 16); mat.map.needsUpdate = true;
      mat.emissiveMap = F.glass.emi.clone(); mat.emissiveMap.repeat.set(w / 12, h / 16); mat.emissiveMap.needsUpdate = true;
      this.lmMats.push(mat);
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), mat);
      return lm(m2, x, z);
    };
    // Tokyo Metropolitan Government Bldg (243 m, twin tops)
    tower(-796, -3340, 70, 40, 200); tower(-816, -3340, 26, 26, 243); tower(-776, -3340, 26, 26, 243);
    tower(-886, -2896, 60, 50, 235); tower(-344, -3573, 30, 30, 204, 0x7f93a6);
    tower(-560, -3420, 50, 40, 210); tower(-640, -3650, 50, 45, 223); tower(-420, -3300, 40, 40, 190); tower(-980, -3600, 45, 45, 180);
    tower(-250, -3200, 40, 30, 170);
    // Roppongi Hills Mori Tower (238 m) and Tokyo Midtown (248 m)
    tower(2596, -111, 70, 70, 238, 0x8d9aa5); tower(2758, -655, 50, 50, 248, 0x9fb0be);
    // Ebisu Garden Place (167 m)
    tower(1194, 1931, 40, 40, 167, 0xb5b0a8);
    // Mt. Fuji (scaled to keep its real angular size), WSW
    {
      const k = 0.13;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(180, 2600, 3776 * k, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x6f7f96, fog: false, transparent: true, opacity: 0.85 }));
      body.position.y = 3776 * k / 2; g.add(body);
      const snow = new THREE.Mesh(new THREE.CylinderGeometry(180, 700, 130, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xf4f6fa, fog: false, transparent: true, opacity: 0.9 }));
      snow.position.y = 3776 * k - 65; g.add(snow);
      g.position.set(-88007 * k, -5, 33163 * k);
      g.renderOrder = -0.5;
      scene.add(g);
      this.fuji = g;
    }
  }

  update(now, camPos, dt, wx) {
    const s = sun(now), mo = moon(now);
    const dirFromAz = (az, el, v) => v.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    dirFromAz(s.az, s.elev, this.sunDir);
    const mdir = dirFromAz(mo.az, mo.elev, new THREE.Vector3());
    const el = s.elev * 180 / Math.PI;
    const night = 1 - smooth(-7, 4, el);
    const golden = smooth(18, 2, el) * (1 - smooth(2, -5, el));
    this.night = night; this.golden = golden;
    const u = this.uni;
    u.uSun.value.copy(this.sunDir); u.uMoon.value.copy(mdir);
    u.uNight.value = night; u.uTime.value = now / 1000 % 100000; u.uMoonPhase.value = 1 - Math.abs(mo.phase - 0.5) * 2;
    u.uCloud.value = wx;
    const day = { zen: new THREE.Color(0x3d7fd6), hor: new THREE.Color(0xbcd6ea) };
    const nite = { zen: new THREE.Color(0x050a1a), hor: new THREE.Color(0x1d2236) };
    const dusk = { zen: new THREE.Color(0x46709f), hor: new THREE.Color(0xe9b48c) };
    const zen = day.zen.clone().lerp(dusk.zen, golden).lerp(nite.zen, night);
    const hor = day.hor.clone().lerp(dusk.hor, golden).lerp(nite.hor, night);
    u.uZen.value.copy(zen); u.uHor.value.copy(hor);
    u.uSunCol.value.setRGB(1, lerp(0.95, 0.6, golden), lerp(0.9, 0.4, golden));
    this.scene.fog.color.copy(hor).lerp(new THREE.Color(0x0e1222), night * 0.3);
    this.scene.fog.density = (lerp(0.0007, 0.0009, night) + wx * 0.0003) * (1 - 0.55 * smooth(15, 200, camPos.y));
    // lights
    const sunUp = smooth(-4, 6, el);
    const useMoon = sunUp < 0.05 && mo.elev > 0;
    const L = this.dir;
    if (sunUp > 0.05) {
      L.color.setRGB(1, lerp(0.97, 0.7, golden), lerp(0.92, 0.5, golden));
      L.intensity = 3.2 * sunUp * (1 - wx * 0.45);
      L.position.copy(camPos).addScaledVector(this.sunDir, 400);
    } else {
      L.color.setRGB(0.6, 0.7, 1.0);
      L.intensity = useMoon ? 0.25 : 0.08;
      L.position.copy(camPos).addScaledVector(useMoon ? mdir : new THREE.Vector3(0.3, 1, 0.2).normalize(), 400);
    }
    L.target.position.copy(camPos);
    // snap shadow camera to texels to reduce shimmering
    L.target.position.x = Math.round(L.target.position.x / 2) * 2; L.target.position.z = Math.round(L.target.position.z / 2) * 2;
    L.position.x += L.target.position.x - camPos.x; L.position.z += L.target.position.z - camPos.z;
    this.hemi.intensity = lerp(0.42, 0.5, night) * (1 - wx * 0.15);
    // refresh the environment map when the light changes noticeably
    if (Math.abs(el - this.envEl) > 0.7 || now - this.envAt > 120000 || now < this.envAt) {
      this.envEl = el; this.envAt = now;
      this.envGround.material.color.setRGB(lerp(0.36, 0.06, night), lerp(0.35, 0.055, night), lerp(0.33, 0.05, night));
      const rt = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 200);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt; this.scene.environment = rt.texture;
    }
    this.scene.environmentIntensity = lerp(1.0, 0.55, night) * (1 - 0.25 * golden);
    this.hemi.color.copy(zen).lerp(new THREE.Color(0xffffff), 0.5);
    this.hemi.groundColor.setRGB(lerp(0.45, 0.55, night), lerp(0.42, 0.4, night), lerp(0.38, 0.28, night));
    if (night > 0.5) this.hemi.color.lerp(new THREE.Color(0x6a6f8a), night - 0.5);
    // landmarks at night
    for (const m of this.towerMats) m.emissiveIntensity = night * 0.9;
    this.skytreeMat.emissiveIntensity = night * 0.8;
    for (const m of this.lmMats) m.emissiveIntensity = night * 0.9;
    this.farMat.emissiveIntensity = night * 0.85;
    this.fuji.visible = night < 0.6;
    this.fuji.children.forEach((c) => (c.material.opacity = (1 - night) * (0.55 - wx * 0.45) * (c === this.fuji.children[0] ? 1.0 : 1.2)));
    this.fuji.children[0].material.color.copy(hor).lerp(new THREE.Color(0x56667e), 0.5);
  }
}
