import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FloorPlan } from './types';
import { buildUnit, disposeModel, FINISHES, type UnitModel } from './furnish';

type Mode = 'dollhouse' | 'top' | 'walk';

const EYE = 1.6;
const RADIUS = 0.28;

function segPush(px: number, pz: number, s: { x1: number; z1: number; x2: number; z2: number }) {
  const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (pz - s.z1) * dz) / l2));
  const cx = s.x1 + dx * t, cz = s.z1 + dz * t;
  const ex = px - cx, ez = pz - cz;
  const d = Math.hypot(ex, ez);
  if (d >= RADIUS) return null;
  if (d < 1e-5) return { x: -dz / Math.sqrt(l2) * RADIUS, z: dx / Math.sqrt(l2) * RADIUS };
  return { x: (ex / d) * (RADIUS - d), z: (ez / d) * (RADIUS - d) };
}

export default function UnitViewer({ plan, className = '', onExit, initialMode = 'dollhouse', topPad = '', title }: { plan: FloorPlan; className?: string; onExit?: () => void; initialMode?: Mode; topPad?: string; title?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const api = useRef<{ setMode: (m: Mode) => void; jump: (i: number) => void; tour: (on: boolean) => void; setFinish: (i: number) => void; setNight: (n: boolean) => void } | null>(null);
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [night, setNight] = useState(false);
  const [finish, setFinish] = useState(0);
  const [touring, setTouring] = useState(false);
  const [roomNow, setRoomNow] = useState('');
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(true);
  const [rooms, setRooms] = useState<{ i: number; label: string }[]>([]);
  const keyId = useMemo(() => plan.id + ':' + plan.walls.length + ':' + plan.rooms.length + ':' + plan.openings.length, [plan]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    setReady(false);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.maxPolarAngle = Math.PI / 2.05;

    const hemi = new THREE.HemisphereLight(0xdfeaff, 0xb8a98f, 0.9);
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    scene.add(hemi, sun, sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xb9c2bb, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    scene.add(ground);

    let model: UnitModel | null = null;
    let curMode: Mode = initialMode;
    let isNight = false;
    const walk = { x: 0, z: 0, yaw: 0, pitch: 0 };
    const keys = new Set<string>();
    const joy = { x: 0, y: 0 };
    let tourState: { list: number[]; idx: number; t: number; from: THREE.Vector3; to: THREE.Vector3; yaw0: number; yaw1: number } | null = null;
    let anim: { t: number; from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
    let raf = 0;
    let lastRoom = '';

    const skyDay = new THREE.Color(0xcfe4f5), skyNight = new THREE.Color(0x0b1226);
    const applyLight = () => {
      scene.background = isNight ? skyNight : skyDay;
      scene.fog = null;
      hemi.intensity = isNight ? 0.18 : 0.9;
      sun.intensity = isNight ? 0.08 : 2.2;
      sun.color.set(isNight ? 0x9db4ff : 0xfff1d6);
      renderer.toneMappingExposure = isNight ? 1.25 : 1.05;
      model?.lights.forEach((l) => { l.intensity = isNight ? 9 : 2.2; });
      if (model) { model.glass.emissive.set(isNight ? 0x1a2a4a : 0x000000); model.glass.opacity = isNight ? 0.5 : 0.3; }
    };

    const roomAt = (x: number, z: number) => model?.rooms.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);

    const fitCamera = (m: Mode, instant = false) => {
      if (!model) return;
      const { w, d } = model.size;
      const span = Math.max(w, d);
      const from = camera.position.clone(), fromT = orbit.target.clone();
      let to: THREE.Vector3, toT = new THREE.Vector3(0, 0.3, 0);
      if (m === 'top') { to = new THREE.Vector3(0.001, span * 1.25 + 2, 0.001); camera.up.set(0, 0, -1); }
      else { to = new THREE.Vector3(span * 0.55, span * 0.85 + 2, span * 0.85 + 1.5); camera.up.set(0, 1, 0); }
      if (instant) { camera.position.copy(to); orbit.target.copy(toT); orbit.update(); }
      else anim = { t: 0, from, to, fromT, toT };
    };

    const setMode = (m: Mode) => {
      const prev = curMode;
      curMode = m;
      setModeState(m);
      stopTour();
      if (!model) return;
      const dollhouse = m !== 'walk';
      model.ceiling.visible = !dollhouse;
      model.walls.scale.y = dollhouse ? 0.42 : 1;
      ground.visible = true;
      orbit.enabled = dollhouse;
      if (dollhouse) {
        camera.fov = m === 'top' ? 35 : 45; camera.updateProjectionMatrix();
        fitCamera(m, prev === 'walk' || prev === m ? false : false);
      } else {
        camera.fov = 78; camera.updateProjectionMatrix();
        camera.up.set(0, 1, 0);
        placeWalker();
      }
    };

    const placeWalker = () => {
      if (!model) return;
      if (!(walk.x || walk.z)) {
        const start = model.rooms.find((r) => r.kind === 'living') || model.rooms.find((r) => r.kind === 'hall') || model.rooms[0];
        if (start) { walk.x = start.cx; walk.z = start.cz; }
        const bedlike = model.rooms.find((r) => r.kind === 'master');
        const toward = bedlike || model.rooms[1] || start;
        if (start && toward) walk.yaw = Math.atan2(-(toward.cx - walk.x), -(toward.cz - walk.z));
      }
      updateWalkCam();
    };

    const updateWalkCam = () => {
      camera.position.set(walk.x, EYE, walk.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(walk.pitch, walk.yaw, 0);
    };

    const jump = (i: number) => {
      if (!model) return;
      const r = model.rooms[i];
      if (!r) return;
      stopTour();
      if (curMode !== 'walk') setMode('walk');
      // stand near the doorway side of the room, looking at the room centre
      const from = new THREE.Vector3(walk.x, EYE, walk.z);
      const sp = standingSpot(r);
      walk.x = sp.x; walk.z = sp.z;
      walk.yaw = Math.atan2(-(sp.lx - walk.x), -(sp.lz - walk.z));
      walk.pitch = -0.14;
      void from;
      updateWalkCam();
    };

    const clearance = (x: number, z: number) => {
      let minD = 9;
      for (const s of model!.colliders) {
        const dx = s.x2 - s.x1, dz = s.z2 - s.z1; const l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (z - s.z1) * dz) / l2));
        minD = Math.min(minD, Math.hypot(x - (s.x1 + dx * t), z - (s.z1 + dz * t)));
      }
      return minD;
    };
    /** Where to stand and what to look at: just inside a doorway, looking across the room. */
    const standingSpot = (r: UnitModel['rooms'][number]): { x: number; z: number; lx: number; lz: number } => {
      const m = model!;
      const doors = m.doors.filter((d) => d.x > r.minX - 0.4 && d.x < r.maxX + 0.4 && d.z > r.minZ - 0.4 && d.z < r.maxZ + 0.4);
      for (const d of doors) {
        const vx = r.cx - d.x, vz = r.cz - d.z, l = Math.hypot(vx, vz) || 1;
        for (const step of [1.0, 0.8, 1.3, 0.6]) {
          const x = d.x + (vx / l) * step, z = d.z + (vz / l) * step;
          if (x > r.minX + 0.2 && x < r.maxX - 0.2 && z > r.minZ + 0.2 && z < r.maxZ - 0.2 && clearance(x, z) > RADIUS + 0.08) {
            const corners = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.minX, r.maxZ], [r.maxX, r.maxZ]];
            const far = corners.sort((a, b) => Math.hypot(b[0] - x, b[1] - z) - Math.hypot(a[0] - x, a[1] - z))[0];
            return { x, z, lx: far[0], lz: far[1] };
          }
        }
      }
      let best = { x: r.cx, z: r.cz, score: -1 };
      for (let x = r.minX + 0.5; x <= r.maxX - 0.5; x += 0.35) for (let z = r.minZ + 0.5; z <= r.maxZ - 0.5; z += 0.35) {
        const c = clearance(x, z);
        const score = Math.min(c, 1.2) * 2 + Math.hypot(x - r.cx, z - r.cz) * 0.6;
        if (c > RADIUS + 0.08 && score > best.score) best = { x, z, score };
      }
      return { x: best.x, z: best.z, lx: r.cx, lz: r.cz };
    };

    const stopTour = () => { if (tourState) { tourState = null; setTouring(false); } };
    const tour = (on: boolean) => {
      if (!on) return stopTour();
      if (!model || !model.rooms.length) return;
      if (curMode !== 'walk') setMode('walk');
      const order = [...model.rooms.keys()];
      tourState = { list: order, idx: -1, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), yaw0: 0, yaw1: 0 };
      setTouring(true);
    };
    const stepTour = (dt: number) => {
      if (!tourState || !model) return;
      const ts = tourState;
      ts.t += dt / 4.2;
      if (ts.t >= 1) {
        ts.idx += 1;
        if (ts.idx >= ts.list.length) { stopTour(); return; }
        const r = model.rooms[ts.list[ts.idx]];
        const spot = standingSpot(r);
        ts.from.set(walk.x, 0, walk.z); ts.to.set(spot.x, 0, spot.z);
        ts.yaw0 = walk.yaw; ts.yaw1 = Math.atan2(-(spot.lx - spot.x), -(spot.lz - spot.z));
        let dy = ts.yaw1 - ts.yaw0; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; ts.yaw1 = ts.yaw0 + dy;
        ts.t = 0;
      }
      const k = ts.t < 0.5 ? 2 * ts.t * ts.t : 1 - Math.pow(-2 * ts.t + 2, 2) / 2;
      // straight-line glide; the tour is a camera move, not a physical walk
      walk.x = ts.from.x + (ts.to.x - ts.from.x) * Math.min(1, k * 1.4);
      walk.z = ts.from.z + (ts.to.z - ts.from.z) * Math.min(1, k * 1.4);
      walk.yaw = ts.yaw0 + (ts.yaw1 - ts.yaw0) * k + Math.sin(ts.t * Math.PI) * 0.12;
      walk.pitch = -0.14;
      updateWalkCam();
    };

    const build = (fi: number) => {
      if (model) { scene.remove(model.group); disposeModel(model.group); }
      model = buildUnit(plan, FINISHES[fi]);
      scene.add(model.group);
      const span = Math.max(model.size.w, model.size.d);
      sun.position.set(span * 0.7, span * 1.3 + 4, span * 0.4);
      sun.target.position.set(0, 0, 0);
      const c = sun.shadow.camera as THREE.OrthographicCamera;
      const e = span * 0.9 + 2; c.left = -e; c.right = e; c.top = e; c.bottom = -e; c.near = 0.5; c.far = span * 4 + 20; c.updateProjectionMatrix();
      applyLight();
      setRooms(model.rooms.map((r, i) => ({ i, label: r.label })));
    };

    const resize = () => {
      const w = el.clientWidth || 600, h = el.clientHeight || 400;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    build(0);
    setMode(initialMode);
    fitCamera(initialMode === 'walk' ? 'dollhouse' : initialMode, true);
    if (initialMode === 'walk') setMode('walk');
    setReady(true);

    /* -------- input */
    const dom = renderer.domElement;
    let drag: { id: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { if (curMode !== 'walk') return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); stopTour(); setHint(false); };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      walk.yaw -= (e.clientX - drag.x) * 0.0055;
      walk.pitch = Math.max(-1.1, Math.min(1.1, walk.pitch - (e.clientY - drag.y) * 0.0045));
      drag.x = e.clientX; drag.y = e.clientY;
      updateWalkCam();
    };
    const onUp = () => { drag = null; };
    dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp); dom.addEventListener('pointercancel', onUp);
    const kd = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return; const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); if (curMode === 'walk') { e.preventDefault(); stopTour(); } } };
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

    // virtual joystick events from React overlay
    const onJoy = (e: Event) => { const d = (e as CustomEvent).detail; joy.x = d.x; joy.y = d.y; if (d.x || d.y) { stopTour(); setHint(false); } };
    el.addEventListener('joy', onJoy);

    api.current = {
      setMode,
      jump,
      tour,
      setFinish: (i) => { build(i); if (curMode !== 'walk') { model!.ceiling.visible = false; model!.walls.scale.y = 0.42; } },
      setNight: (n) => { isNight = n; applyLight(); },
    };

    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (anim) {
        anim.t = Math.min(1, anim.t + dt / 0.9);
        const k = 1 - Math.pow(1 - anim.t, 3);
        camera.position.lerpVectors(anim.from, anim.to, k);
        orbit.target.lerpVectors(anim.fromT, anim.toT, k);
        if (anim.t >= 1) anim = null;
      }
      if (curMode === 'walk' && model) {
        if (tourState) stepTour(dt);
        else {
          let f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - joy.y;
          let s = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0) + joy.x;
          if (keys.has('arrowleft')) walk.yaw += 1.8 * dt;
          if (keys.has('arrowright')) walk.yaw -= 1.8 * dt;
          const len = Math.hypot(f, s);
          if (len > 1) { f /= len; s /= len; }
          if (f || s) {
            const sp = 1.9 * dt;
            const fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
            const rx = Math.cos(walk.yaw), rz = -Math.sin(walk.yaw);
            walk.x += (fx * f + rx * s) * sp; walk.z += (fz * f + rz * s) * sp;
            for (let it = 0; it < 3; it++) for (const seg of model.colliders) { const p = segPush(walk.x, walk.z, seg); if (p) { walk.x += p.x; walk.z += p.z; } }
            updateWalkCam();
          } else if (keys.size === 0) updateWalkCam();
        }
        const r = roomAt(walk.x, walk.z);
        const name = r?.label || '';
        if (name !== lastRoom) { lastRoom = name; setRoomNow(name); }
      } else {
        orbit.update();
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      el.removeEventListener('joy', onJoy);
      dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp);
      orbit.dispose();
      if (model) disposeModel(model.group);
      renderer.dispose();
      renderer.forceContextLoss?.();
      dom.remove();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId]);

  const chip = (active: boolean) => `rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${active ? 'bg-gold-400 text-night' : 'bg-white/10 text-white/80 hover:bg-white/20'}`;
  const joyRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const sendJoy = (x: number, y: number) => { setKnob({ x, y }); mount.current?.dispatchEvent(new CustomEvent('joy', { detail: { x, y } })); };
  const onJoyMove = (e: React.PointerEvent) => {
    const r = joyRef.current!.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy) || 1, k = Math.min(1, l);
    sendJoy((dx / l) * k, (dy / l) * k);
  };

  return (
    <div className={`${className.includes("absolute") ? "" : "relative"} overflow-hidden bg-night ${className}`}>
      <div ref={mount} className="absolute inset-0" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-sm font-bold text-white/70">Building your home…</div>}

      {/* top bar */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 ${topPad}`}>
        <div className="pointer-events-auto flex gap-1.5 rounded-full bg-night/70 p-1 backdrop-blur">
          <button className={chip(mode === 'dollhouse')} onClick={() => api.current?.setMode('dollhouse')}>Dollhouse</button>
          <button className={chip(mode === 'top')} onClick={() => api.current?.setMode('top')}>Top view</button>
          <button className={chip(mode === 'walk')} onClick={() => api.current?.setMode('walk')}>Walk inside</button>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button className={chip(touring)} onClick={() => api.current?.tour(!touring)}>{touring ? '■ Stop tour' : '▶ Auto tour'}</button>
          <button className={chip(night)} onClick={() => { setNight(!night); api.current?.setNight(!night); }} aria-label="Toggle day and night">{night ? '☾ Night' : '☀ Day'}</button>
          {onExit && <button className={chip(false)} onClick={onExit}>✕ Back</button>}
        </div>
      </div>

      {title && <div className="pointer-events-none absolute left-3 top-[7.6rem] rounded-full bg-night/70 px-4 py-1.5 text-xs font-extrabold text-white backdrop-blur">{title}</div>}
      {/* room label */}
      {mode === 'walk' && roomNow && <div className="pointer-events-none absolute left-1/2 top-[6.2rem] -translate-x-1/2 rounded-full bg-night/70 px-4 py-1.5 text-xs font-extrabold text-gold-300 sm:top-[4.9rem] backdrop-blur">{roomNow}</div>}

      {/* hint */}
      {hint && ready && <div className="pointer-events-none absolute left-1/2 bottom-28 -translate-x-1/2 rounded-full bg-night/70 px-4 py-2 text-xs font-bold text-white/85 backdrop-blur">{mode === 'walk' ? 'Drag to look · WASD or joystick to walk' : 'Drag to rotate · pinch/scroll to zoom · tap “Walk inside”'}</div>}

      {/* joystick */}
      {mode === 'walk' && (
        <div ref={joyRef} onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); onJoyMove(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') onJoyMove(e); }} onPointerUp={() => sendJoy(0, 0)} onPointerCancel={() => sendJoy(0, 0)}
          className="absolute bottom-24 left-4 h-28 w-28 touch-none rounded-full border border-white/25 bg-white/10 backdrop-blur sm:hidden">
          <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-gold-400/90 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x * 34}px), calc(-50% + ${knob.y * 34}px))` }} />
        </div>
      )}

      {/* bottom: rooms + finishes */}
      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-night/90 to-transparent p-3 pt-10">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {rooms.map((r) => <button key={r.i} onClick={() => api.current?.jump(r.i)} className="shrink-0 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold text-white/90 ring-1 ring-white/15 transition hover:bg-gold-400 hover:text-night">{r.label}</button>)}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/60">
          <span className="mr-1 uppercase tracking-wider">Finish</span>
          {FINISHES.map((f, i) => <button key={f.id} onClick={() => { setFinish(i); api.current?.setFinish(i); }} className={`rounded-full px-3 py-1 transition ${finish === i ? 'bg-white text-night' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>{f.name}</button>)}
          <span className="ml-auto hidden text-white/40 sm:inline">Furniture is illustrative</span>
        </div>
      </div>
    </div>
  );
}
