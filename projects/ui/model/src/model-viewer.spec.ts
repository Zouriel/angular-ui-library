import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { provideUiConfig } from '@zouriel/ui';
import { UI_MODEL_THREE, UiModelViewer, disposeObject, uiModelCameraDistance, uiModelSpinAngle, type UiModelThree } from './model-viewer';

/** A WebGLRenderer stand-in (jsdom has no WebGL): records what the viewer asks of it. */
class FakeRenderer {
  static last: FakeRenderer | null = null;
  renders = 0;
  disposed = false;
  size: [number, number] = [0, 0];
  clear: [number, number] = [-1, -1];
  scene: THREE.Scene | null = null;
  constructor(public opts: { alpha?: boolean; canvas?: HTMLCanvasElement }) {
    FakeRenderer.last = this;
  }
  setClearColor(c: number, a: number) { this.clear = [c, a]; }
  setPixelRatio() {}
  setSize(w: number, h: number) { this.size = [w, h]; }
  render(scene: THREE.Scene) { this.renders++; this.scene = scene; }
  dispose() { this.disposed = true; }
}

/** A model 4 x 2 x 0.5 whose box is centred at (10, 5, 0): the viewer must centre and scale it. */
let geometry: THREE.BoxGeometry;
let texture: THREE.Texture;
function makeModel(): THREE.Group {
  geometry = new THREE.BoxGeometry(4, 2, 0.5);
  texture = new THREE.Texture();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture }));
  mesh.position.set(10, 5, 0);
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

let loads: string[] = [];
let loaderCalls = 0;
let failNext = false;
const fakeThree: () => Promise<UiModelThree> = async () => {
  loaderCalls++;
  return {
    three: { ...THREE, WebGLRenderer: FakeRenderer },
    GLTFLoader: class {
      async loadAsync(url: string) {
        loads.push(url);
        if (failNext) throw new Error('404');
        return { scene: makeModel() };
      }
    },
  };
};

@Component({
  imports: [UiModelViewer],
  template: `<ui-model-viewer [src]="src()" [spin]="spin()" [tilt]="tilt()" [fixed]="fixed()" [ariaLabel]="label()" (loaded)="loadedCount = loadedCount + 1" (error)="err = $event" />`,
})
class Host {
  src = signal('/passport.glb');
  spin = signal(true);
  tilt = signal(12);
  fixed = signal(false);
  label = signal<string | null>('A Maldivian passport');
  loadedCount = 0;
  err: unknown = null;
}

let reduce = false;
let rafs: FrameRequestCallback[] = [];
async function settle(f: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 6; i++) {
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r, 0));
  }
}

function setUp(providers: unknown[] = []) {
  TestBed.configureTestingModule({ providers: [{ provide: UI_MODEL_THREE, useValue: fakeThree }, ...(providers as never[])] });
  const f = TestBed.createComponent(Host);
  return f;
}

describe('ui-model-viewer', () => {
  beforeEach(() => {
    loads = [];
    loaderCalls = 0;
    failNext = false;
    reduce = false;
    rafs = [];
    FakeRenderer.last = null;
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') && reduce, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafs.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads three.js through the injectable loader (lazily, once) and the model from src', async () => {
    const f = setUp();
    expect(loaderCalls).toBe(0);
    await settle(f);
    expect(loaderCalls).toBe(1);
    expect(loads).toEqual(['/passport.glb']);
    expect(f.componentInstance.loadedCount).toBe(1);
    const r = FakeRenderer.last!;
    expect(r.opts.alpha).toBe(true);
    expect(r.clear).toEqual([0, 0]); // a transparent canvas: the theme shows through
    f.componentInstance.src.set('/other.glb');
    await settle(f);
    expect(loads).toEqual(['/passport.glb', '/other.glb']);
    expect(loaderCalls).toBe(1);
  });

  it('centres the model on the origin and scales it to a unit bounding sphere, tilted toward the viewer', async () => {
    const f = setUp();
    await settle(f);
    const scene = FakeRenderer.last!.scene!;
    expect(scene).toBeTruthy();
    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
    expect(meshes).toHaveLength(1);
    // Untilted, unspun box: measure in the spin group's frame.
    const tiltGroup = scene.children.find((c) => (c as THREE.Group).isGroup)!;
    expect(tiltGroup.rotation.x).toBeCloseTo((12 * Math.PI) / 180, 6);
    tiltGroup.rotation.set(0, 0, 0);
    tiltGroup.children[0].rotation.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(meshes[0]);
    const c = box.getCenter(new THREE.Vector3());
    expect(c.length()).toBeLessThan(1e-6);
    expect(box.getSize(new THREE.Vector3()).length() / 2).toBeCloseTo(1, 6);
    // Lights: an ambient and at least a key light.
    expect(scene.children.some((o) => (o as THREE.HemisphereLight).isHemisphereLight || (o as THREE.AmbientLight).isAmbientLight)).toBe(true);
    expect(scene.children.some((o) => (o as THREE.DirectionalLight).isDirectionalLight)).toBe(true);
  });

  it('spins with a frame loop, and stands still (one frame, no loop) under reduced motion, spin off or animations off', async () => {
    // Run every queued animation frame (Angular's own included) a few times, a frame apart.
    let now = 0;
    const flush = (times = 4) => {
      for (let i = 0; i < times; i++) {
        const queued = rafs;
        rafs = [];
        now += 16;
        for (const cb of queued) cb(now);
      }
    };
    const f = setUp();
    await settle(f);
    const spinning = FakeRenderer.last!;
    const spinGroup = spinning.scene!.children.find((c) => (c as THREE.Group).isGroup)!.children[0];
    const before = spinning.renders;
    flush();
    expect(spinning.renders).toBeGreaterThan(before + 2);
    expect(spinGroup.rotation.y).toBeGreaterThan(0);

    for (const variant of ['reduce', 'spin', 'config'] as const) {
      TestBed.resetTestingModule();
      rafs = [];
      reduce = variant === 'reduce';
      const g = setUp(variant === 'config' ? [provideUiConfig({ animations: false })] : []);
      if (variant === 'spin') g.componentInstance.spin.set(false);
      await settle(g);
      const r = FakeRenderer.last!;
      expect(r.renders, variant).toBeGreaterThan(0); // the model still renders, at rest
      const still = r.renders;
      flush();
      expect(r.renders, variant).toBe(still);
      expect(r.scene!.children.find((c) => (c as THREE.Group).isGroup)!.children[0].rotation.y, variant).toBe(0);
      expect(g.componentInstance.loadedCount, variant).toBe(1);
    }
  });

  it('is an image with its label, or a decorative fixed layer behind the content', async () => {
    const f = setUp();
    await settle(f);
    const el = f.nativeElement.querySelector('ui-model-viewer') as HTMLElement;
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('A Maldivian passport');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    f.componentInstance.fixed.set(true);
    await settle(f);
    expect(el.classList).toContain('fixed');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-label')).toBe(false);
    const css = (UiModelViewer as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(css).toMatch(/\.fixed[^{]*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*pointer-events:\s*none;/);
  });

  it('disposes the renderer, geometries, materials and textures on destroy', async () => {
    const f = setUp();
    await settle(f);
    const geoDispose = vi.spyOn(geometry, 'dispose');
    const texDispose = vi.spyOn(texture, 'dispose');
    f.destroy();
    expect(FakeRenderer.last!.disposed).toBe(true);
    expect(geoDispose).toHaveBeenCalled();
    expect(texDispose).toHaveBeenCalled();
  });

  it('reports a model that fails to load', async () => {
    failNext = true;
    const f = setUp();
    await settle(f);
    expect(f.componentInstance.err).toBeInstanceOf(Error);
    expect(f.componentInstance.loadedCount).toBe(0);
  });
});

describe('model viewer maths', () => {
  it('fits a unit sphere in the narrower field of view', () => {
    const wide = uiModelCameraDistance(1, 32, 2);
    const tall = uiModelCameraDistance(1, 32, 0.5);
    expect(tall).toBeGreaterThan(wide);
    expect(wide).toBeCloseTo(1.08 / Math.sin((16 * Math.PI) / 180), 6);
  });

  it('turns once per spinSeconds', () => {
    expect(uiModelSpinAngle(0, 24)).toBe(0);
    expect(uiModelSpinAngle(6, 24)).toBeCloseTo(Math.PI / 2, 9);
    expect(uiModelSpinAngle(30, 24)).toBeCloseTo(Math.PI / 2, 9);
    expect(uiModelSpinAngle(5, 0)).toBe(0);
  });

  it('disposeObject leaves nothing undisposed', () => {
    const m = makeModel();
    const g = vi.spyOn(geometry, 'dispose');
    const t = vi.spyOn(texture, 'dispose');
    disposeObject(m);
    expect(g).toHaveBeenCalledOnce();
    expect(t).toHaveBeenCalledOnce();
  });
});
