import {
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  NgZone,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { injectUiConfig } from '@zouriel/ui';

/**
 * What ui-model-viewer needs from three.js: the `three` module and the glTF loader class from
 * `three/addons/loaders/GLTFLoader.js`. Typed loosely so apps that never use the viewer need no
 * three.js types.
 */
export interface UiModelThree {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  three: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GLTFLoader: new (...args: any[]) => { loadAsync(url: string): Promise<{ scene: any }> };
}

/**
 * How ui-model-viewer loads three.js: dynamic imports of `three` and its GLTFLoader by default, so an
 * app that never shows a model never downloads three.js (it is an optional peer dependency). Provide
 * another loader to test the viewer or to load three.js from somewhere else.
 */
export const UI_MODEL_THREE = new InjectionToken<() => Promise<UiModelThree>>('UI_MODEL_THREE', {
  providedIn: 'root',
  factory: () => async () => {
    const [three, gltf] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
    return { three, GLTFLoader: gltf.GLTFLoader } as UiModelThree;
  },
});

/** Space left around the model's bounding sphere, so a spinning model never touches the edge. */
export const UI_MODEL_FIT_PADDING = 1.08;

/**
 * How far from the centre the camera stands so a sphere of `radius` fits the view at `fovDeg`
 * (vertical field of view) in a box `aspect` wide per unit of height: the narrower of the two
 * fields of view decides.
 */
export function uiModelCameraDistance(radius: number, fovDeg: number, aspect: number): number {
  const v = (fovDeg * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(aspect, 0.0001));
  return (radius * UI_MODEL_FIT_PADDING) / Math.sin(Math.min(v, h) / 2);
}

/** The spin angle (radians) after `seconds`, one full turn every `spinSeconds`. */
export function uiModelSpinAngle(seconds: number, spinSeconds: number): number {
  return spinSeconds > 0 ? ((seconds / spinSeconds) % 1) * Math.PI * 2 : 0;
}

const FOV = 32;

/**
 * `ui-model-viewer` — shows a glTF / GLB 3D model, by default turning slowly around its vertical axis.
 *
 * The model is centred and scaled to fit (its bounding sphere, so it never clips while it turns),
 * tilted `tilt` degrees toward the viewer, and lit by a soft studio rig (a sky/ground ambient, a warm
 * key light and a cool fill) that reads on light and dark themes. The canvas is transparent, so the
 * theme or a `ui-liquid-backdrop` shows through.
 *
 * `fixed` makes it a decorative full-viewport layer like `ui-liquid-backdrop`: position fixed, inset 0,
 * behind the content, no pointer, hidden from screen readers. Otherwise give it an `ariaLabel` (it is
 * then an image to assistive tech); without one it is treated as decorative.
 *
 * Motion: the spin stops under prefers-reduced-motion and with provideUiConfig({ animations: false });
 * the model still renders, at rest. It only draws while it is on screen and the tab is visible.
 *
 * three.js is an optional peer dependency (`npm i three`), loaded on first use with a dynamic import
 * (see {@link UI_MODEL_THREE}). Everything it allocates (renderer, geometries, materials, textures)
 * is disposed when the viewer is destroyed or the model changes.
 */
@Component({
  selector: 'ui-model-viewer',
  host: {
    class: 'ui-model-viewer',
    '[class.fixed]': 'fixed()',
    '[class.loaded]': 'ready()',
    '[attr.aria-hidden]': "decorative() ? 'true' : null",
    '[attr.role]': "decorative() ? null : 'img'",
    '[attr.aria-label]': 'decorative() ? null : ariaLabel()',
  },
  template: `<canvas #canvas></canvas>`,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 320px;
        contain: strict;
      }
      :host(.fixed) {
        position: fixed;
        inset: 0;
        width: auto;
        height: auto;
        z-index: 0;
        pointer-events: none;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity var(--ui-motion-slow, 400ms) var(--ui-ease-standard, ease);
      }
      :host(.loaded) canvas {
        opacity: 1;
      }
      @media (prefers-reduced-motion: reduce) {
        canvas {
          transition: none;
        }
      }
    `,
  ],
})
export class UiModelViewer {
  /** URL of the model (.glb or .gltf). */
  src = input.required<string>();
  /** Turn slowly around the vertical axis (stops under reduced motion / animations off). */
  spin = input(true, { transform: booleanAttribute });
  /** Seconds per full turn. */
  spinSeconds = input(24, { transform: numberAttribute });
  /** Resting tilt toward the viewer, in degrees (the top leans toward you). */
  tilt = input(12, { transform: numberAttribute });
  /** A decorative full-viewport layer behind the content (position fixed, inset 0, no pointer, aria-hidden). */
  fixed = input(false, { transform: booleanAttribute });
  /** What the model shows, for screen readers (ignored when `fixed`; without it the viewer is decorative). */
  ariaLabel = input<string | null>(null);

  /** The model loaded and drew its first frame. */
  loaded = output<void>();
  /** The model (or three.js) failed to load. */
  error = output<unknown>();

  protected readonly decorative = computed(() => this.fixed() || !this.ariaLabel());

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private readonly zone = inject(NgZone);
  private readonly loadThree = inject(UI_MODEL_THREE);
  private readonly animationsOn = injectUiConfig().animations;

  // three.js state (loosely typed: three.js types are optional for apps).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private lib: UiModelThree | null = null;
  private renderer: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private scene: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private camera: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private tiltGroup: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private spinGroup: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private model: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private radius = 1;

  protected readonly ready = signal(false);
  private destroyed = false;
  private loadSeq = 0;
  private raf = 0;
  private onScreen = true;
  private pageVisible = true;
  private reducedMotion = false;
  /** Seconds of spin so far, kept across pauses so the model resumes where it stopped. */
  private spunSeconds = 0;
  private lastFrame = 0;
  private cleanups: (() => void)[] = [];

  constructor() {
    afterNextRender(() => {
      void this.setUp();
    });
    // A new src loads a new model; spin, tilt and speed apply on the next frame.
    effect(() => {
      const src = this.src();
      untracked(() => {
        if (this.renderer) void this.load(src);
      });
    });
    effect(() => {
      this.spin();
      this.spinSeconds();
      this.tilt();
      untracked(() => this.update());
    });
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  /** Whether the model is turning right now (wanted, allowed, and worth drawing). */
  get spinning(): boolean {
    return this.spin() && this.spinSeconds() > 0 && this.animationsOn && !this.reducedMotion && this.onScreen && this.pageVisible;
  }

  private async setUp(): Promise<void> {
    let lib: UiModelThree;
    try {
      lib = await this.loadThree();
    } catch (e) {
      this.error.emit(e);
      return;
    }
    if (this.destroyed) return;
    this.lib = lib;
    const THREE = lib.three;
    this.zone.runOutsideAngular(() => {
      const renderer = new THREE.WebGLRenderer({ canvas: this.canvas().nativeElement, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x000000, 0);
      if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      if (THREE.ACESFilmicToneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      this.renderer = renderer;

      const scene = new THREE.Scene();
      // Soft studio light: a sky/ground ambient so no side goes black, a warm key from above-front-right
      // and a cool fill from the left; together they read on a light or a dark page.
      scene.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a4150, 1.6));
      const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
      key.position.set(3, 4, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xdce8ff, 0.9);
      fill.position.set(-4, 1, 2);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 0.6);
      rim.position.set(0, 3, -4);
      scene.add(rim);
      this.scene = scene;

      this.tiltGroup = new THREE.Group();
      this.spinGroup = new THREE.Group();
      this.tiltGroup.add(this.spinGroup);
      scene.add(this.tiltGroup);
      this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);

      this.watch();
      this.resize();
    });
    await this.load(this.src());
  }

  /** Resize, visibility and reduced-motion watchers. */
  private watch(): void {
    const win = this.host.ownerDocument.defaultView;
    const doc = this.host.ownerDocument;
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.host);
      this.cleanups.push(() => ro.disconnect());
    }
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver((entries) => {
        this.onScreen = entries[entries.length - 1].isIntersecting;
        this.update();
      });
      io.observe(this.host);
      this.cleanups.push(() => io.disconnect());
    }
    const onVisibility = () => {
      this.pageVisible = doc.visibilityState !== 'hidden';
      this.update();
    };
    doc.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => doc.removeEventListener('visibilitychange', onVisibility));
    this.pageVisible = doc.visibilityState !== 'hidden';
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : win?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq) {
      this.reducedMotion = mq.matches;
      const onMotion = () => {
        this.reducedMotion = mq.matches;
        this.update();
      };
      mq.addEventListener?.('change', onMotion);
      this.cleanups.push(() => mq.removeEventListener?.('change', onMotion));
    }
  }

  private async load(src: string): Promise<void> {
    const lib = this.lib;
    if (!lib || !src) return;
    const seq = ++this.loadSeq;
    let gltf: { scene: unknown };
    try {
      gltf = await new lib.GLTFLoader().loadAsync(src);
    } catch (e) {
      if (seq === this.loadSeq && !this.destroyed) this.error.emit(e);
      return;
    }
    if (seq !== this.loadSeq || this.destroyed) {
      disposeObject(gltf.scene);
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.place(gltf.scene);
      this.draw();
    });
    this.ready.set(true);
    this.loaded.emit();
  }

  /** Centre the model on the origin and scale its bounding sphere to radius 1. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private place(model: any): void {
    const THREE = this.lib!.three;
    if (this.model) {
      this.spinGroup.remove(this.model);
      disposeObject(this.model);
    }
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() / 2 || 1;
    const wrapper = new THREE.Group();
    model.position.sub(center);
    wrapper.add(model);
    wrapper.scale.setScalar(1 / radius);
    this.radius = 1;
    this.model = wrapper;
    this.spinGroup.add(wrapper);
    this.resize();
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    const dpr = Math.min(this.host.ownerDocument.defaultView?.devicePixelRatio ?? 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.set(0, 0, uiModelCameraDistance(this.radius, FOV, w / h));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.update();
  }

  /** Apply tilt and the spin state: run the frame loop while spinning, else draw one still frame. */
  private update(): void {
    if (!this.renderer || !this.tiltGroup) return;
    this.tiltGroup.rotation.x = (this.tilt() * Math.PI) / 180;
    if (this.spinning) {
      if (!this.raf) {
        this.lastFrame = 0;
        this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(this.frame)));
      }
    } else {
      this.stopLoop();
      this.draw();
    }
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (this.destroyed || !this.spinning) return;
    if (this.lastFrame) this.spunSeconds += Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(): void {
    if (!this.renderer || !this.scene) return;
    this.spinGroup.rotation.y = uiModelSpinAngle(this.spunSeconds, this.spinSeconds());
    this.renderer.render(this.scene, this.camera);
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private teardown(): void {
    this.destroyed = true;
    this.stopLoop();
    for (const c of this.cleanups) c();
    this.cleanups = [];
    if (this.scene) disposeObject(this.scene);
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.renderer = this.scene = this.camera = this.model = this.tiltGroup = this.spinGroup = null;
  }
}

/** Dispose every geometry, material and texture under `root`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function disposeObject(root: any): void {
  root?.traverse?.((o: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if ((v as { isTexture?: boolean })?.isTexture) (v as { dispose(): void }).dispose();
      m.dispose?.();
    }
  });
}
