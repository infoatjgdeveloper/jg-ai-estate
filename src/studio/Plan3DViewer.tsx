import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FloorPlan } from './types';
import { planBounds } from './geometry';

const WALL_T = 0.15; // metres
const DOOR_H = 2.05;
const WIN_SILL = 0.9;
const WIN_TOP = 2.1;

type ViewMode = 'orbit' | 'top' | 'inside';

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o: any) => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m: any) => {
        m.map?.dispose?.();
        m.dispose?.();
      });
    }
  });
}

function labelSprite(text: string) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontPx = 44;
  ctx.font = `700 ${fontPx}px Manrope, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  canvas.width = w;
  canvas.height = fontPx + 28;
  const c2 = canvas.getContext('2d')!;
  c2.font = `700 ${fontPx}px Manrope, system-ui, sans-serif`;
  c2.fillStyle = 'rgba(26,23,20,0.82)';
  const r = 18;
  c2.beginPath();
  c2.moveTo(r, 0);
  c2.arcTo(w, 0, w, canvas.height, r);
  c2.arcTo(w, canvas.height, 0, canvas.height, r);
  c2.arcTo(0, canvas.height, 0, 0, r);
  c2.arcTo(0, 0, w, 0, r);
  c2.fill();
  c2.fillStyle = '#fff';
  c2.textBaseline = 'middle';
  c2.fillText(text, 18, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const scaleH = 0.32;
  sprite.scale.set((canvas.width / canvas.height) * scaleH, scaleH, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Builds all 3D geometry for a plan. Returns the group and the model centre/size in metres. */
export function buildPlanModel(plan: FloorPlan) {
  const group = new THREE.Group();
  const b = planBounds(plan);
  if (!b) return { group, size: { w: 6, d: 6 }, center: new THREE.Vector3() };

  const ppm = plan.pxPerMeter || 1;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const toX = (px: number) => (px - cx) / ppm;
  const toZ = (py: number) => (py - cy) / ppm;
  const H = plan.wallHeight || 2.9;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 });
  const lintelMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d3, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9cc7e8, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.1 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.7 });

  const addBox = (len: number, h: number, thick: number, s: number, y: number, x1: number, z1: number, theta: number, mat: THREE.Material) => {
    if (len <= 0.005 || h <= 0.005) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), mat);
    const ux = Math.cos(theta);
    const uz = Math.sin(theta);
    mesh.position.set(x1 + ux * s, y + h / 2, z1 + uz * s);
    mesh.rotation.y = -theta;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  for (const wall of plan.walls) {
    const x1 = toX(wall.x1), z1 = toZ(wall.y1), x2 = toX(wall.x2), z2 = toZ(wall.y2);
    const L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 0.05) continue;
    const theta = Math.atan2(z2 - z1, x2 - x1);
    const ops = plan.openings
      .filter((o) => o.wallId === wall.id)
      .map((o) => {
        const c = Math.max(0, Math.min(1, o.t)) * L;
        const half = Math.min(o.width, L) / 2;
        return { type: o.type, a: Math.max(0, c - half), b: Math.min(L, c + half) };
      })
      .sort((p, q) => p.a - q.a);

    // Extend the wall by half a thickness at each end so corners close without gaps.
    const ext = WALL_T / 2;
    let cursor = -ext;
    const mid = (a: number, b: number) => (a + b) / 2;
    const segs: { a: number; b: number }[] = [];
    for (const o of ops) {
      if (o.a > cursor) segs.push({ a: cursor, b: o.a });
      cursor = Math.max(cursor, o.b);
    }
    if (cursor < L + ext) segs.push({ a: cursor, b: L + ext });
    for (const s of segs) addBox(s.b - s.a, H, WALL_T, mid(s.a, s.b), 0, x1, z1, theta, wallMat);

    for (const o of ops) {
      const len = o.b - o.a;
      const m = mid(o.a, o.b);
      if (o.type === 'door') {
        addBox(len, H - DOOR_H, WALL_T, m, DOOR_H, x1, z1, theta, lintelMat);
        // A slim door leaf standing open is overkill; show a frame-coloured threshold strip instead.
        addBox(len, 0.03, WALL_T * 0.9, m, 0, x1, z1, theta, doorMat);
      } else {
        addBox(len, WIN_SILL, WALL_T, m, 0, x1, z1, theta, wallMat);
        addBox(len, H - WIN_TOP, WALL_T, m, WIN_TOP, x1, z1, theta, lintelMat);
        addBox(len, WIN_TOP - WIN_SILL, 0.03, m, WIN_SILL, x1, z1, theta, glassMat);
      }
    }
  }

  const wM = b.w / ppm;
  const dM = b.h / ppm;

  // Base slab under the plan (a "model base", not a claim about room floors).
  const pad = 0.6;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(wM + pad * 2, 0.12, dM + pad * 2),
    new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 1 })
  );
  slab.position.set(0, -0.06, 0);
  slab.receiveShadow = true;
  slab.name = 'slab';
  group.add(slab);

  // Light floor tone inside the footprint for visual contrast.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(wM, dM),
    new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  for (const r of plan.rooms) {
    if (!r.label) continue;
    const s = labelSprite(r.label);
    s.position.set(toX(r.x), Math.min(H - 0.2, 1.9), toZ(r.y));
    s.name = 'label';
    group.add(s);
  }

  return { group, size: { w: wM, d: dM }, center: new THREE.Vector3(0, 0, 0) };
}

interface Props {
  plan: FloorPlan;
  className?: string;
  /** Show the Orbit / Top / Inside buttons (default true) */
  controls?: boolean;
  showLabels?: boolean;
}

export default function Plan3DViewer({ plan, className, controls = true, showLabels = true }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>('orbit');
  const apiRef = useRef<{ setMode: (m: ViewMode) => void } | null>(null);
  const model = useMemo(() => plan, [plan]);
  const hasWalls = plan.walls.length > 0;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !hasWalls) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f1eb);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
    const ctrl = new OrbitControls(camera, renderer.domElement);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b2, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    scene.add(sun.target);

    const { group, size } = buildPlanModel(model);
    if (!showLabels) group.children.filter((c) => c.name === 'label').forEach((c) => group.remove(c));
    scene.add(group);

    const span = Math.max(size.w, size.d, 4);
    sun.position.set(span * 0.8, span * 1.6, span * 0.6);
    const sc = span * 0.9;
    Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 0.5, far: span * 6 });
    sun.shadow.camera.updateProjectionMatrix();

    let current: ViewMode = 'orbit';
    const orbitPos = new THREE.Vector3(span * 0.9, span * 0.95, span * 1.1);

    const applyMode = (m: ViewMode) => {
      current = m;
      ctrl.minDistance = 0.5;
      ctrl.maxDistance = span * 5;
      ctrl.minPolarAngle = 0;
      ctrl.maxPolarAngle = Math.PI / 2 - 0.03;
      ctrl.enablePan = true;
      ctrl.enableZoom = true;
      if (m === 'orbit') {
        camera.position.copy(orbitPos);
        ctrl.target.set(0, 0.8, 0);
      } else if (m === 'top') {
        camera.position.set(0.001, span * 1.9, 0.001);
        ctrl.target.set(0, 0, 0);
        ctrl.maxPolarAngle = 0.35;
      } else {
        // Inside: stand in the middle of the plan at eye level; click the floor to move.
        placeInside(0, 0);
      }
      ctrl.update();
    };

    const placeInside = (x: number, z: number) => {
      ctrl.enablePan = false;
      ctrl.enableZoom = false;
      ctrl.minDistance = 0.01;
      ctrl.maxDistance = 0.6;
      ctrl.minPolarAngle = Math.PI * 0.2;
      ctrl.maxPolarAngle = Math.PI * 0.8;
      const dir = new THREE.Vector3().subVectors(ctrl.target, camera.position).setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize().multiplyScalar(0.5);
      camera.position.set(x, 1.55, z);
      ctrl.target.set(x + dir.x, 1.5, z + dir.z);
      ctrl.update();
    };

    // Click-to-walk: tap the floor in inside mode to teleport there (drag still rotates the view).
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0, downY = 0;
    const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; };
    const onUp = (e: PointerEvent) => {
      if (current !== 'inside') return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const floorMesh = group.getObjectByName('floor');
      if (!floorMesh) return;
      const hit = ray.intersectObject(floorMesh, false)[0];
      if (hit) placeInside(hit.point.x, hit.point.z);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const resize = () => {
      const w = mount.clientWidth || 600;
      const h = mount.clientHeight || 400;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    applyMode('orbit');
    apiRef.current = { setMode: applyMode };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      ctrl.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      ctrl.dispose();
      disposeObject(group);
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
  }, [model, hasWalls, showLabels]);

  useEffect(() => {
    apiRef.current?.setMode(mode);
  }, [mode]);

  if (!hasWalls) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 text-stone-500 text-sm font-semibold rounded-2xl ${className || ''}`}>
        No walls traced yet. Trace the plan to see it in 3D.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-stone-100 ${className || ''}`}>
      <div ref={mountRef} className="absolute inset-0" />
      {controls && (
        <div className="absolute left-3 top-3 flex gap-1 rounded-full bg-white/90 p-1 shadow ring-1 ring-stone-200 backdrop-blur">
          {([
            ['orbit', '3D'],
            ['top', 'Top'],
            ['inside', 'Walk inside'],
          ] as [ViewMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${mode === m ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {controls && mode === 'inside' && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/80 px-3 py-1.5 text-[11px] font-semibold text-white">
          Drag to look around. Tap the floor to move.
        </div>
      )}
    </div>
  );
}
