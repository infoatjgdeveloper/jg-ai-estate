import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const FH = 0.32; // floor height in scene units

function windowTexture(cols: number, seed: number) {
  const cv = document.createElement('canvas');
  cv.width = 64 * cols; cv.height = 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#1b2640'; c.fillRect(0, 0, cv.width, 64);
  let s = seed;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < cols; i++) {
    const lit = r() > 0.55;
    c.fillStyle = lit ? (r() > 0.5 ? '#ffd88a' : '#fff0c4') : '#2c3a5c';
    c.fillRect(i * 64 + 10, 12, 44, 38);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(i * 64 + 10, 12, 44, 6);
  }
  c.fillStyle = '#0f1830'; c.fillRect(0, 56, cv.width, 8);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export default function BuildingViewer({ floors, selected, onSelect, className = '', towers = 1 }: { floors: number; selected: number | null; onSelect: (floor: number) => void; className?: string; towers?: number }) {
  const mount = useRef<HTMLDivElement>(null);
  const bandRef = useRef<((n: number | null) => void) | null>(null);
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = mount.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    const scene = new THREE.Scene();
    const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
    const g = sky.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0a1030'); gr.addColorStop(0.6, '#3a3170'); gr.addColorStop(1, '#f1a27a');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0x4a3a78, 18, 60);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const total = Math.max(2, Math.round(floors));
    const H = total * FH;
    camera.position.set(5 + H * 0.55, H * 0.55 + 1.5, 7 + H * 0.65);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, H * 0.45, 0);
    orbit.enableDamping = true; orbit.enablePan = false;
    orbit.minDistance = 3; orbit.maxDistance = 22 + H * 0.4;
    orbit.maxPolarAngle = Math.PI / 2.02;
    orbit.autoRotate = true; orbit.autoRotateSpeed = 0.7;
    renderer.domElement.addEventListener('pointerdown', () => { orbit.autoRotate = false; });

    scene.add(new THREE.HemisphereLight(0xb7a7ff, 0x3a2a4a, 1.1));
    const sun = new THREE.DirectionalLight(0xffc89a, 2.4); sun.position.set(-6, H * 0.6 + 4, 5); scene.add(sun);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x1a2038, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.6, 0.06, 48), new THREE.MeshStandardMaterial({ color: 0x2a3150, roughness: 0.9 }));
    plaza.position.y = 0.03; scene.add(plaza);

    const W = 2.6, D = 2.0;
    const group = new THREE.Group(); scene.add(group);
    const mkTower = (x: number, z: number, fl: number, seed: number, main: boolean) => {
      const h = fl * FH;
      const tex = windowTexture(10, seed); tex.repeat.set(2, fl);
      const side = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.5, metalness: 0.2 });
      const top = new THREE.MeshStandardMaterial({ color: 0x2a3150 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, h, D), [side, side, top, top, side, side]);
      mesh.position.set(x, h / 2, z); group.add(mesh);
      // slab lines
      const slabM = new THREE.MeshStandardMaterial({ color: 0xcdd3e6, roughness: 0.6 });
      for (let i = 1; i <= fl; i += main ? 1 : 3) { const s = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.02, D + 0.08), slabM); s.position.set(x, i * FH, z); group.add(s); }
      const crown = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, 0.25, D * 0.5), new THREE.MeshStandardMaterial({ color: 0x3a4468 })); crown.position.set(x, h + 0.12, z); group.add(crown);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5252 })); beacon.position.set(x, h + 0.32, z); group.add(beacon);
      return mesh;
    };
    const main = mkTower(0, 0, total, 7, true);
    // podium
    const pod = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.35, D + 1.2), new THREE.MeshStandardMaterial({ color: 0x3b4468, roughness: 0.7 })); pod.position.y = 0.2; group.add(pod);
    const extra = Math.min(2, Math.max(0, (towers || 1) - 1));
    for (let i = 0; i < extra; i++) mkTower(i === 0 ? -4.4 : 4.4, i === 0 ? -1.4 : -2.2, Math.max(4, Math.round(total * (i === 0 ? 0.85 : 0.7))), 21 + i, false);
    // distant skyline
    let s2 = 99; const rr = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
    for (let i = 0; i < 26; i++) {
      const a = rr() * Math.PI * 2, d = 12 + rr() * 22, fl = 6 + Math.floor(rr() * (total * 0.9 + 8));
      const t = windowTexture(6, i * 13 + 5); t.repeat.set(1.5, fl);
      const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.4 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.4 + rr() * 1.4, fl * FH, 1.4 + rr() * 1.4), m);
      b.position.set(Math.cos(a) * d, (fl * FH) / 2, Math.sin(a) * d); scene.add(b);
    }
    // stars
    const starG = new THREE.BufferGeometry(); const sp: number[] = [];
    for (let i = 0; i < 300; i++) { const a = rr() * Math.PI * 2, e = 0.15 + rr() * 1.2, r = 80; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r + 6, Math.sin(a) * Math.cos(e) * r); }
    starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true, fog: false })));

    // selection band
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, FH * 0.96, D + 0.14), new THREE.MeshBasicMaterial({ color: 0xf6d58b, transparent: true, opacity: 0.55, depthWrite: false }));
    band.visible = false; group.add(band);
    const hoverBand = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, FH * 0.96, D + 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
    hoverBand.visible = false; group.add(hoverBand);
    bandRef.current = (n) => { if (n == null) { band.visible = false; return; } band.visible = true; band.position.y = (n - 0.5) * FH; };

    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const pickFloor = (e: PointerEvent | MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(main)[0];
      if (!hit) return null;
      return Math.min(total, Math.max(1, Math.floor(hit.point.y / FH) + 1));
    };
    let down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const pu = (e: PointerEvent) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) { const f = pickFloor(e); if (f) cbRef.current(f); } down = null; };
    const pm = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const f = pickFloor(e);
      if (f) { hoverBand.visible = true; hoverBand.position.y = (f - 0.5) * FH; } else hoverBand.visible = false;
      setHover(f);
    };
    renderer.domElement.addEventListener('pointerdown', pd); renderer.domElement.addEventListener('pointerup', pu); renderer.domElement.addEventListener('pointermove', pm);

    const resize = () => { const w = el.clientWidth || 600, h = el.clientHeight || 400; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); orbit.update(); renderer.render(scene, camera); }; loop();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); orbit.dispose();
      scene.traverse((o: any) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); }); });
      renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove(); bandRef.current = null;
    };
  }, [floors, towers]);

  useEffect(() => { bandRef.current?.(selected); }, [selected, floors, towers]);

  return (
    <div className={`${className.includes("absolute") ? "" : "relative"} overflow-hidden bg-night ${className}`}>
      <div ref={mount} className="absolute inset-0 cursor-pointer" />
      {hover && <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-night/75 px-3 py-1 text-xs font-extrabold text-gold-300 backdrop-blur">Floor {hover}</div>}
    </div>
  );
}
