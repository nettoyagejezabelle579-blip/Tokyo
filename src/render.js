// Post-processing chain: scene -> ambient occlusion -> bloom -> tone mapping / sRGB output.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

class AOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.userData.noAO) o.visible = false;
    });
  }
}

export class Post {
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    this.quality = null;
  }
  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.composer?.dispose?.();
    const r = this.r, size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q === 'high' ? 4 : 0 });
    const c = (this.composer = new EffectComposer(r, rt));
    c.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (q === 'high') {
      const ao = (this.ao = new AOPass(this.scene, this.camera, size.x, size.y));
      ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.4, thickness: 2.5, scale: 1.3, samples: 12, distanceFallOff: 0.6, screenSpaceRadius: false });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      ao.blendIntensity = 0.9;
      c.addPass(ao);
    }
    const bs = q === 'high' ? 0.5 : 0.25;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * bs, size.y * bs), 0.25, 0.55, 0.92);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.setSize(innerWidth, innerHeight);
  }
  setSize(w, h) {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.r.getPixelRatio());
    this.composer.setSize(w, h);
  }
  render(night, dt) {
    if (this.ao) this.ao.enabled = this.aoOn !== false;
    this.bloom.strength = 0.15 + night * 0.3;
    this.bloom.threshold = 0.95 - night * 0.1;
    this.bloom.radius = 0.4 + night * 0.15;
    this.composer.render(dt);
  }
}
