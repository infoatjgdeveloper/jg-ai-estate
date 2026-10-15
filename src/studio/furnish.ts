import * as THREE from 'three';
import type { FloorPlan, PlanRoomLabel, RoomKind } from './types';
import { planBounds, roomKind } from './geometry';

/* ------------------------------------------------------------------ finishes */

export interface Finish {
  id: string;
  name: string;
  wall: number;
  accent: number;
  wood: number;       // floors + furniture wood
  tile: number;
  sofa: number;
  bed: number;
  fabric: number;     // curtains / cushions
  trim: number;
}

export const FINISHES: Finish[] = [
  { id: 'modern', name: 'Modern Light', wall: 0xf3f0ea, accent: 0x7f9bb3, wood: 0xc8a57a, tile: 0xe7e5df, sofa: 0x5f7184, bed: 0xf1ece3, fabric: 0xd9d2c3, trim: 0xffffff },
  { id: 'warm', name: 'Warm Wood', wall: 0xf1e6d6, accent: 0xb5703c, wood: 0x9a6a41, tile: 0xded3c2, sofa: 0xa8683c, bed: 0xeadfce, fabric: 0xcfa982, trim: 0xfaf3e6 },
  { id: 'dark', name: 'Dark Luxe', wall: 0xcfd2d8, accent: 0xc9a14a, wood: 0x4a3b33, tile: 0x2f3237, sofa: 0x2d3340, bed: 0x3b4150, fabric: 0x586177, trim: 0xe9e6df },
];

/* ------------------------------------------------------------------ types */

export interface RoomInfo { id: string; label: string; kind: RoomKind; cx: number; cz: number; minX: number; maxX: number; minZ: number; maxZ: number }
export interface Seg { x1: number; z1: number; x2: number; z2: number }
export interface UnitModel {
  group: THREE.Group;          // everything
  walls: THREE.Group;          // scaled for cutaway
  ceiling: THREE.Group;
  lights: THREE.PointLight[];
  glass: THREE.MeshStandardMaterial;
  rooms: RoomInfo[];
  colliders: Seg[];
  floorMeshes: THREE.Object3D[];
  doors: { x: number; z: number }[];
  size: { w: number; d: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  H: number;
}

const WALL_T = 0.15;
const DOOR_H = 2.05;
const WIN_SILL = 0.9;
const WIN_TOP = 2.1;

type Side = 'N' | 'S' | 'E' | 'W';
const SIDES: Side[] = ['N', 'S', 'E', 'W'];
const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/* ------------------------------------------------------------------ textures */

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
function shade(n: number, k: number) {
  const c = new THREE.Color(n); c.multiplyScalar(k); return '#' + c.getHexString();
}

function woodTexture(base: number) {
  return canvasTex(256, 256, (c) => {
    const plank = 32;
    for (let i = 0; i < 8; i++) {
      c.fillStyle = shade(base, 0.9 + ((i * 37) % 17) / 100);
      c.fillRect(0, i * plank, 256, plank);
      c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 2;
      c.strokeRect(0, i * plank, 256, plank);
      c.strokeStyle = 'rgba(0,0,0,.05)'; c.lineWidth = 1;
      for (let g = 0; g < 5; g++) { c.beginPath(); c.moveTo(0, i * plank + 6 + g * 5); c.bezierCurveTo(80, i * plank + 3 + g * 5, 160, i * plank + 9 + g * 5, 256, i * plank + 6 + g * 5); c.stroke(); }
    }
  });
}

function tileTexture(base: number) {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = hex(base); c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 3;
    c.strokeRect(0, 0, 128, 128); c.strokeRect(128, 0, 128, 128); c.strokeRect(0, 128, 128, 128); c.strokeRect(128, 128, 128, 128);
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 0, 128, 128); c.fillRect(128, 128, 128, 128);
  });
}

/* ------------------------------------------------------------------ builder */

export function buildUnit(plan: FloorPlan, finish: Finish): UnitModel {
  const group = new THREE.Group();
  const wallsG = new THREE.Group();
  const ceilingG = new THREE.Group();
  const lights: THREE.PointLight[] = [];
  const colliders: Seg[] = [];
  const floorMeshes: THREE.Object3D[] = [];
  const rooms: RoomInfo[] = [];
  group.add(wallsG, ceilingG);

  const b = planBounds(plan);
  const H = plan.wallHeight || 2.9;
  const glass = new THREE.MeshStandardMaterial({ color: 0xaed4ee, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.2, emissive: 0x000000 });
  if (!b) return { group, walls: wallsG, ceiling: ceilingG, lights, glass, rooms, colliders, floorMeshes, doors: [], size: { w: 6, d: 6 }, bounds: { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }, H };

  const ppm = plan.pxPerMeter || 1;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const toX = (px: number) => (px - cx) / ppm;
  const toZ = (py: number) => (py - cy) / ppm;
  const wM = b.w / ppm, dM = b.h / ppm;
  const bounds = { minX: -wM / 2, maxX: wM / 2, minZ: -dM / 2, maxZ: dM / 2 };

  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: number, rough = 0.8, metal = 0) => {
    const k = `${color}-${rough}-${metal}`;
    let m = matCache.get(k);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); matCache.set(k, m); }
    return m;
  };
  const emissive = (color: number, intensity = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

  const wallMat = mat(finish.wall, 0.95);
  const trimMat = mat(finish.trim, 0.6);
  const lintelMat = mat(finish.wall, 0.95);
  const doorMat = mat(finish.wood, 0.6);
  const frameMat = mat(0x2b2b2b, 0.5, 0.3);

  /* ---------------- walls with door / window openings */
  const addBox = (parent: THREE.Object3D, len: number, h: number, thick: number, s: number, y: number, x1: number, z1: number, theta: number, m: THREE.Material, shadow = true) => {
    if (len <= 0.005 || h <= 0.005) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), m);
    mesh.position.set(x1 + Math.cos(theta) * s, y + h / 2, z1 + Math.sin(theta) * s);
    mesh.rotation.y = -theta;
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    parent.add(mesh);
  };

  const openingPoints: { type: 'door' | 'window'; x: number; z: number; w: number; horizontal: boolean }[] = [];
  for (const wall of plan.walls) {
    const x1 = toX(wall.x1), z1 = toZ(wall.y1), x2 = toX(wall.x2), z2 = toZ(wall.y2);
    const L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 0.05) continue;
    const theta = Math.atan2(z2 - z1, x2 - x1);
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L;
    const ops = plan.openings.filter((o) => o.wallId === wall.id).map((o) => {
      const c = Math.max(0, Math.min(1, o.t)) * L;
      const half = Math.min(o.width, L - 0.2) / 2;
      return { type: o.type, a: Math.max(0, c - half), b: Math.min(L, c + half), c };
    }).sort((p, q) => p.a - q.a);

    const ext = WALL_T / 2;
    let cursor = -ext;
    const mid = (a: number, bb: number) => (a + bb) / 2;
    const segs: { a: number; b: number }[] = [];
    for (const o of ops) { if (o.a > cursor) segs.push({ a: cursor, b: o.a }); cursor = Math.max(cursor, o.b); }
    if (cursor < L + ext) segs.push({ a: cursor, b: L + ext });
    for (const s of segs) {
      addBox(wallsG, s.b - s.a, H, WALL_T, mid(s.a, s.b), 0, x1, z1, theta, wallMat);
      // collider (walls only; end caps trimmed to the opening)
      colliders.push({ x1: x1 + ux * Math.max(0, s.a), z1: z1 + uz * Math.max(0, s.a), x2: x1 + ux * Math.min(L, s.b), z2: z1 + uz * Math.min(L, s.b) });
    }
    // baseboard strip along the wall for a finished look
    addBox(wallsG, L, 0.09, WALL_T + 0.02, L / 2, 0, x1, z1, theta, trimMat, false);

    for (const o of ops) {
      const len = o.b - o.a, m = mid(o.a, o.b);
      const px = x1 + ux * o.c, pz = z1 + uz * o.c;
      openingPoints.push({ type: o.type, x: px, z: pz, w: len, horizontal: Math.abs(uz) < 0.5 });
      if (o.type === 'door') {
        addBox(wallsG, len, H - DOOR_H, WALL_T, m, DOOR_H, x1, z1, theta, lintelMat);
        // frame jambs
        addBox(wallsG, 0.05, DOOR_H, WALL_T + 0.02, o.a + 0.025, 0, x1, z1, theta, trimMat, false);
        addBox(wallsG, 0.05, DOOR_H, WALL_T + 0.02, o.b - 0.025, 0, x1, z1, theta, trimMat, false);
        addBox(wallsG, len, 0.05, WALL_T + 0.02, m, DOOR_H - 0.05, x1, z1, theta, trimMat, false);
        // open door leaf, hinged at the start of the opening
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(len - 0.1, DOOR_H - 0.06, 0.04), doorMat);
        const pivot = new THREE.Group();
        pivot.position.set(x1 + ux * (o.a + 0.05), (DOOR_H - 0.06) / 2, z1 + uz * (o.a + 0.05));
        pivot.rotation.y = -theta - 1.25;
        leaf.position.x = (len - 0.1) / 2;
        leaf.castShadow = true;
        pivot.add(leaf);
        wallsG.add(pivot);
      } else {
        addBox(wallsG, len, WIN_SILL, WALL_T, m, 0, x1, z1, theta, wallMat);
        addBox(wallsG, len, H - WIN_TOP, WALL_T, m, WIN_TOP, x1, z1, theta, lintelMat);
        addBox(wallsG, len, WIN_TOP - WIN_SILL, 0.025, m, WIN_SILL, x1, z1, theta, glass, false);
        // frame + mullion + sill
        addBox(wallsG, len, 0.05, WALL_T + 0.02, m, WIN_SILL, x1, z1, theta, frameMat, false);
        addBox(wallsG, len, 0.05, WALL_T + 0.02, m, WIN_TOP - 0.05, x1, z1, theta, frameMat, false);
        addBox(wallsG, 0.05, WIN_TOP - WIN_SILL, WALL_T + 0.02, o.a + 0.025, WIN_SILL, x1, z1, theta, frameMat, false);
        addBox(wallsG, 0.05, WIN_TOP - WIN_SILL, WALL_T + 0.02, o.b - 0.025, WIN_SILL, x1, z1, theta, frameMat, false);
        if (len > 1.1) addBox(wallsG, 0.04, WIN_TOP - WIN_SILL, WALL_T + 0.02, m, WIN_SILL, x1, z1, theta, frameMat, false);
        addBox(wallsG, len + 0.12, 0.04, WALL_T + 0.16, m, WIN_SILL - 0.04, x1, z1, theta, trimMat, false);
        colliders.push({ x1: x1 + ux * o.a, z1: z1 + uz * o.a, x2: x1 + ux * o.b, z2: z1 + uz * o.b });
      }
    }
  }

  /* ---------------- rooms: boxes (from AI rectangles, else ray cast from the label) */
  const wallSegsM = plan.walls.map((w) => ({ x1: toX(w.x1), z1: toZ(w.y1), x2: toX(w.x2), z2: toZ(w.y2) }));
  const castBox = (px: number, pz: number) => {
    const hit = (dx: number, dz: number) => {
      let best = 12;
      for (const s of wallSegsM) {
        const sx = s.x2 - s.x1, sz = s.z2 - s.z1;
        const den = dx * sz - dz * sx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((s.x1 - px) * sz - (s.z1 - pz) * sx) / den;
        const u = ((s.x1 - px) * dz - (s.z1 - pz) * dx) / den;
        if (t > 0.05 && u >= -0.02 && u <= 1.02 && t < best) best = t;
      }
      return best;
    };
    return { minX: px - hit(-1, 0), maxX: px + hit(1, 0), minZ: pz - hit(0, -1), maxZ: pz + hit(0, 1) };
  };

  const roomList: (PlanRoomLabel & { kind: RoomKind; bx: { minX: number; maxX: number; minZ: number; maxZ: number } })[] = [];
  for (const r of plan.rooms) {
    const kind = r.kind || roomKind(r.label);
    const bx = r.box
      ? { minX: toX(r.box.x), maxX: toX(r.box.x + r.box.w), minZ: toZ(r.box.y), maxZ: toZ(r.box.y + r.box.h) }
      : castBox(toX(r.x), toZ(r.y));
    if (bx.maxX - bx.minX < 0.8 || bx.maxZ - bx.minZ < 0.8) continue;
    roomList.push({ ...r, kind, bx });
    rooms.push({ id: r.id, label: r.label, kind, cx: (bx.minX + bx.maxX) / 2, cz: (bx.minZ + bx.maxZ) / 2, ...bx });
  }

  /* ---------------- floors */
  const woodTex = woodTexture(finish.wood);
  const tileTex = tileTexture(finish.tile);
  const stoneTex = tileTexture(0xb7b2a6);
  const baseFloor = new THREE.Mesh(new THREE.PlaneGeometry(wM + 0.4, dM + 0.4), mat(0xd9d4c8, 1));
  baseFloor.rotation.x = -Math.PI / 2; baseFloor.position.y = 0.001; baseFloor.receiveShadow = true;
  group.add(baseFloor); floorMeshes.push(baseFloor);
  for (const r of roomList) {
    const w = r.bx.maxX - r.bx.minX, d = r.bx.maxZ - r.bx.minZ;
    const isTile = ['kitchen', 'bath', 'utility'].includes(r.kind);
    const isStone = r.kind === 'balcony';
    const tex = (isStone ? stoneTex : isTile ? tileTex : woodTex).clone();
    tex.needsUpdate = true;
    tex.repeat.set(w / (isTile || isStone ? 0.6 : 1.2), d / (isTile || isStone ? 0.6 : 1.2));
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: isTile ? 0.35 : 0.6, metalness: 0 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    f.rotation.x = -Math.PI / 2;
    f.position.set((r.bx.minX + r.bx.maxX) / 2, 0.004, (r.bx.minZ + r.bx.maxZ) / 2);
    f.receiveShadow = true;
    group.add(f); floorMeshes.push(f);
  }

  /* ---------------- ceiling + light fittings */
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 1, side: THREE.FrontSide });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(wM + 0.3, dM + 0.3), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
  ceilingG.add(ceil);
  const bigRooms = [...roomList].sort((a, bq) => (bq.bx.maxX - bq.bx.minX) * (bq.bx.maxZ - bq.bx.minZ) - (a.bx.maxX - a.bx.minX) * (a.bx.maxZ - a.bx.minZ));
  bigRooms.forEach((r, i) => {
    const px = (r.bx.minX + r.bx.maxX) / 2, pz = (r.bx.minZ + r.bx.maxZ) / 2;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), emissive(0xfff1cf, 1.4));
    panel.position.set(px, H - 0.02, pz);
    ceilingG.add(panel);
    if (i < 7) {
      const L = new THREE.PointLight(0xffe2b0, 5, 7, 1.6);
      L.position.set(px, H - 0.4, pz);
      lights.push(L); group.add(L);
    }
  });

  /* ---------------- furniture machinery */
  type Iv = [number, number];
  interface RoomCtx {
    bx: { minX: number; maxX: number; minZ: number; maxZ: number };
    a: number; d: number;
    used: Record<Side, Iv[]>;
    doors: Record<Side, Iv[]>;
    wins: Record<Side, Iv[]>;
    inset: Record<Side, number>;
  }

  const sideAxisRange = (ctx: RoomCtx, s: Side): Iv => {
    const { bx } = ctx;
    if (s === 'N' || s === 'S') return [bx.minX + ctx.inset.W, bx.maxX - ctx.inset.E];
    return [bx.minZ + ctx.inset.N, bx.maxZ - ctx.inset.S];
  };

  const mk = (ctx: RoomCtx): RoomCtx => ctx;
  const mkCtx = (bx: RoomCtx['bx']): RoomCtx => {
    const ctx = mk({ bx, a: bx.maxX - bx.minX, d: bx.maxZ - bx.minZ, used: { N: [], S: [], E: [], W: [] }, doors: { N: [], S: [], E: [], W: [] }, wins: { N: [], S: [], E: [], W: [] }, inset: { N: 0, S: 0, E: 0, W: 0 } });
    const tol = 0.3;
    for (const o of openingPoints) {
      const list = o.type === 'door' ? ctx.doors : ctx.wins;
      const pad = o.type === 'door' ? 0.55 : 0.05;
      if (o.horizontal) {
        if (o.x < bx.minX - 0.1 || o.x > bx.maxX + 0.1) continue;
        if (Math.abs(o.z - bx.minZ) < tol) list.N.push([o.x - o.w / 2 - pad, o.x + o.w / 2 + pad]);
        if (Math.abs(o.z - bx.maxZ) < tol) list.S.push([o.x - o.w / 2 - pad, o.x + o.w / 2 + pad]);
      } else {
        if (o.z < bx.minZ - 0.1 || o.z > bx.maxZ + 0.1) continue;
        if (Math.abs(o.x - bx.minX) < tol) list.W.push([o.z - o.w / 2 - pad, o.z + o.w / 2 + pad]);
        if (Math.abs(o.x - bx.maxX) < tol) list.E.push([o.z - o.w / 2 - pad, o.z + o.w / 2 + pad]);
      }
    }
    return ctx;
  };

  const free = (ctx: RoomCtx, s: Side, c: number, len: number, tall: boolean) => {
    const lo = c - len / 2, hi = c + len / 2;
    const [r0, r1] = sideAxisRange(ctx, s);
    if (lo < r0 + 0.02 || hi > r1 - 0.02) return false;
    const clash = (arr: Iv[]) => arr.some(([a, bq]) => lo < bq && hi > a);
    return !clash(ctx.doors[s]) && !clash(ctx.used[s]) && !(tall && clash(ctx.wins[s]));
  };

  /** Find a free position along a side. pref: 'center' | 'start' | 'end' */
  const findSpot = (ctx: RoomCtx, s: Side, len: number, tall: boolean, pref: 'center' | 'start' | 'end' = 'center') => {
    const [r0, r1] = sideAxisRange(ctx, s);
    if (r1 - r0 < len + 0.04) return null;
    const mid = (r0 + r1) / 2;
    const cands: number[] = [];
    for (let c = r0 + len / 2 + 0.03; c <= r1 - len / 2 - 0.03; c += 0.1) cands.push(c);
    cands.sort((p, q) => (pref === 'center' ? Math.abs(p - mid) - Math.abs(q - mid) : pref === 'start' ? p - q : q - p));
    for (const c of cands) if (free(ctx, s, c, len, tall)) return c;
    return null;
  };

  const sideLen = (ctx: RoomCtx, s: Side) => (s === 'N' || s === 'S' ? ctx.a : ctx.d);
  const perpLen = (ctx: RoomCtx, s: Side) => (s === 'N' || s === 'S' ? ctx.d : ctx.a);

  /** Put an item (local: width on x, depth on z, back at -z) against a side at `along`, add its footprint as a collider. */
  const putOnSide = (ctx: RoomCtx, item: THREE.Object3D, s: Side, along: number, w: number, d: number, solid = true, gap = 0.02) => {
    const { bx } = ctx;
    let x = 0, z = 0, rot = 0;
    if (s === 'N') { x = along; z = bx.minZ + WALL_T / 2 + gap + d / 2; rot = 0; }
    if (s === 'S') { x = along; z = bx.maxZ - WALL_T / 2 - gap - d / 2; rot = Math.PI; }
    if (s === 'W') { x = bx.minX + WALL_T / 2 + gap + d / 2; z = along; rot = Math.PI / 2; }
    if (s === 'E') { x = bx.maxX - WALL_T / 2 - gap - d / 2; z = along; rot = -Math.PI / 2; }
    item.position.set(x, 0, z);
    item.rotation.y = rot;
    group.add(item);
    ctx.used[s].push([along - w / 2, along + w / 2]);
    ctx.inset[s] = Math.max(ctx.inset[s], d + WALL_T / 2 + gap + 0.05);
    if (solid) {
      const hw = (s === 'N' || s === 'S' ? w : d) / 2, hd = (s === 'N' || s === 'S' ? d : w) / 2;
      pushRect(x - hw, z - hd, x + hw, z + hd);
    }
    return { x, z };
  };

  const pushRect = (x0: number, z0: number, x1: number, z1: number) => {
    colliders.push({ x1: x0, z1: z0, x2: x1, z2: z0 }, { x1: x1, z1: z0, x2: x1, z2: z1 }, { x1: x1, z1: z1, x2: x0, z2: z1 }, { x1: x0, z1: z1, x2: x0, z2: z0 });
  };

  /** Place a free-standing item (centered) and register collider. */
  const putAt = (item: THREE.Object3D, x: number, z: number, rot = 0, w = 0, d = 0, solid = false) => {
    item.position.set(x, 0, z); item.rotation.y = rot; group.add(item);
    if (solid && w && d) {
      const sw = Math.abs(Math.cos(rot)) > 0.5 ? w : d, sd = Math.abs(Math.cos(rot)) > 0.5 ? d : w;
      pushRect(x - sw / 2, z - sd / 2, x + sw / 2, z + sd / 2);
    }
  };

  /* ---------------- furniture parts */
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    return mesh;
  };
  const cyl = (r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 20) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };
  const sphere = (r: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
    mesh.position.set(x, y, z); mesh.castShadow = true;
    return mesh;
  };

  const woodM = mat(finish.wood, 0.55);
  const darkWood = mat(new THREE.Color(finish.wood).multiplyScalar(0.62).getHex(), 0.55);
  const sofaM = mat(finish.sofa, 0.95);
  const bedM = mat(finish.bed, 0.95);
  const fabricM = mat(finish.fabric, 0.95);
  const accentM = mat(finish.accent, 0.8);
  const whiteM = mat(0xf6f6f4, 0.45);
  const steelM = mat(0xc9ced4, 0.3, 0.7);
  const blackM = mat(0x141417, 0.3, 0.2);
  const stoneTop = mat(0x3a3d42, 0.35, 0.1);
  const leafM = mat(0x3f7d4e, 0.85);
  const potM = mat(0xb98b62, 0.8);

  const bedItem = (w: number, d: number) => {
    const g = new THREE.Group();
    g.add(box(w + 0.06, 0.28, d, darkWood, 0, 0, 0));
    g.add(box(w - 0.04, 0.22, d - 0.12, bedM, 0, 0.28, 0.04));
    g.add(box(w + 0.06, 1.0, 0.08, darkWood, 0, 0, -d / 2 + 0.04));
    g.add(box(w - 0.05, 0.62, 0.06, accentM, 0, 0.32, -d / 2 + 0.09));
    const pw = w > 1.4 ? 2 : 1;
    for (let i = 0; i < pw; i++) {
      const px = pw === 1 ? 0 : (i === 0 ? -1 : 1) * (w / 4);
      const p = box(w / pw - 0.16, 0.12, 0.38, mat(0xffffff, 0.95), px, 0.5, -d / 2 + 0.38);
      p.rotation.x = -0.22; g.add(p);
    }
    g.add(box(w - 0.02, 0.06, d * 0.58, accentM, 0, 0.5, d * 0.17));
    g.add(box(w - 0.04, 0.025, 0.34, fabricM, 0, 0.55, d / 2 - 0.35));
    return g;
  };
  const bedside = () => {
    const g = new THREE.Group();
    g.add(box(0.45, 0.45, 0.4, woodM));
    g.add(box(0.4, 0.02, 0.36, darkWood, 0, 0.45, 0));
    g.add(cyl(0.05, 0.02, blackM, 0, 0.47, 0));
    g.add(cyl(0.015, 0.2, blackM, 0, 0.49, 0));
    const shade2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.15, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd58a, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    shade2.position.set(0, 0.76, 0); g.add(shade2);
    return g;
  };
  const wardrobe = (w: number) => {
    const g = new THREE.Group();
    g.add(box(w, 2.15, 0.6, woodM));
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 1; i < n; i++) g.add(box(0.012, 2.05, 0.01, darkWood, -w / 2 + (w / n) * i, 0.05, 0.3, false));
    for (let i = 0; i < n; i += 1) g.add(box(0.02, 0.35, 0.02, steelM, -w / 2 + (w / n) * (i + 0.5) + (i % 2 ? -0.05 : 0.05), 0.95, 0.315, false));
    return g;
  };
  const sofaItem = (w: number) => {
    const g = new THREE.Group();
    g.add(box(w, 0.42, 0.92, sofaM, 0, 0.08, 0));
    g.add(box(w, 0.5, 0.2, sofaM, 0, 0.42, -0.36));
    g.add(box(0.2, 0.3, 0.92, sofaM, -w / 2 + 0.1, 0.42, 0));
    g.add(box(0.2, 0.3, 0.92, sofaM, w / 2 - 0.1, 0.42, 0));
    const n = Math.max(2, Math.round((w - 0.4) / 0.62));
    for (let i = 0; i < n; i++) g.add(box((w - 0.4) / n - 0.02, 0.14, 0.62, sofaM, -((w - 0.4) / 2) + ((w - 0.4) / n) * (i + 0.5), 0.5, 0.1));
    g.add(box(0.4, 0.4, 0.12, accentM, -w / 2 + 0.4, 0.55, 0.0)).rotation.set(-0.2, 0.2, 0);
    g.add(box(0.4, 0.4, 0.12, fabricM, w / 2 - 0.4, 0.55, 0.0)).rotation.set(-0.2, -0.2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, 0.08, 0.05, darkWood, sx * (w / 2 - 0.08), 0, sz * 0.38));
    return g;
  };
  const coffeeTable = () => {
    const g = new THREE.Group();
    g.add(box(1.0, 0.04, 0.55, woodM, 0, 0.38, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.04, 0.38, 0.04, darkWood, sx * 0.44, 0, sz * 0.22));
    g.add(cyl(0.07, 0.1, whiteM, 0.2, 0.42, 0));
    g.add(sphere(0.06, leafM, 0.2, 0.58, 0));
    return g;
  };
  const rug = (w: number, d: number, color: number) => {
    const m = box(w, 0.012, d, mat(color, 1), 0, 0, 0, false); m.receiveShadow = true; return m;
  };
  const tvUnit = (w: number) => {
    const g = new THREE.Group();
    g.add(box(w, 0.45, 0.4, woodM));
    g.add(box(w - 0.1, 0.02, 0.36, darkWood, 0, 0.45, 0));
    const tv = box(Math.min(1.5, w - 0.2), 0.85, 0.05, blackM, 0, 0.95, -0.15);
    g.add(tv);
    g.add(box(Math.min(1.5, w - 0.2) - 0.08, 0.77, 0.005, mat(0x0d1a2b, 0.2, 0.5), 0, 0.99, -0.12, false));
    g.add(box(0.5, 0.04, 0.2, steelM, 0, 0.45, 0.02));
    return g;
  };
  const diningSet = (w: number, d: number, chairs: number) => {
    const g = new THREE.Group();
    g.add(box(w, 0.05, d, woodM, 0, 0.72, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, 0.72, 0.07, darkWood, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)));
    const perSide = Math.max(1, Math.floor(chairs / 2));
    for (let i = 0; i < perSide; i++) for (const sz of [-1, 1]) {
      const x = perSide === 1 ? 0 : -w / 2 + (w / perSide) * (i + 0.5);
      const ch = new THREE.Group();
      ch.add(box(0.42, 0.05, 0.42, accentM, 0, 0.45, 0));
      ch.add(box(0.42, 0.5, 0.04, accentM, 0, 0.5, -0.19));
      for (const lx of [-1, 1]) for (const lz of [-1, 1]) ch.add(box(0.035, 0.45, 0.035, darkWood, lx * 0.18, 0, lz * 0.18));
      ch.position.set(x, 0, sz * (d / 2 + 0.28));
      ch.rotation.y = sz > 0 ? Math.PI : 0;
      g.add(ch);
    }
    g.add(cyl(0.1, 0.08, accentM, 0, 0.77, 0));
    return g;
  };
  const pendant = (px: number, pz: number, y = 1.9) => {
    const g = new THREE.Group();
    g.add(cyl(0.005, H - y - 0.1, blackM, 0, y + 0.1, 0, 6));
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, 0.22, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xf4e7cc, emissive: 0xffd58a, emissiveIntensity: 1.1, side: THREE.DoubleSide }));
    lamp.position.set(0, y, 0); g.add(lamp);
    g.position.set(px, 0, pz); ceilingG.add(g);
  };
  const plant = (h = 0.9) => {
    const g = new THREE.Group();
    g.add(cyl(0.18, 0.32, potM));
    g.add(sphere(0.3 * (h / 0.9) + 0.05, leafM, 0, 0.32 + h * 0.5, 0));
    g.add(sphere(0.2, mat(0x56a066, 0.85), 0.12, 0.32 + h * 0.75, 0.05));
    return g;
  };
  const wallArt = (w: number, h: number) => {
    const g = new THREE.Group();
    g.add(box(w, h, 0.03, blackM, 0, 0, 0, false));
    g.add(box(w - 0.06, h - 0.06, 0.012, accentM, 0, 0.03, 0.012, false));
    g.add(box((w - 0.06) * 0.5, (h - 0.06) * 0.5, 0.014, fabricM, 0.0, 0.05 + (h - 0.06) * 0.2, 0.016, false));
    return g;
  };
  const counterRun = (len: number, withHob: boolean, withSink: boolean) => {
    const g = new THREE.Group();
    g.add(box(len, 0.86, 0.58, whiteM, 0, 0.04, 0));
    g.add(box(len + 0.02, 0.04, 0.62, stoneTop, 0, 0.9, 0.01));
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 1; i < n; i++) g.add(box(0.008, 0.8, 0.01, mat(0x999999, 0.6), -len / 2 + (len / n) * i, 0.06, 0.295, false));
    g.add(box(len, 0.1, 0.5, darkWood, 0, 0, 0.02, false));
    if (withHob) {
      const hx = -len / 2 + Math.min(len - 0.4, 0.5 + len * 0.25);
      g.add(box(0.6, 0.012, 0.5, blackM, hx, 0.94, 0.02, false));
      for (const bx2 of [-1, 1]) for (const bz of [-1, 1]) g.add(cyl(0.07, 0.01, mat(0x555a60, 0.4, 0.6), hx + bx2 * 0.14, 0.946, 0.02 + bz * 0.11, 16));
      g.add(box(0.62, 0.3, 0.34, steelM, hx, 1.6, -0.12));
    }
    if (withSink) {
      const sx2 = len / 2 - Math.min(0.55, len * 0.3);
      g.add(box(0.5, 0.012, 0.4, steelM, sx2, 0.94, 0.02, false));
      g.add(cyl(0.012, 0.22, steelM, sx2, 0.94, -0.2, 8));
      const spout = box(0.015, 0.015, 0.14, steelM, sx2, 1.14, -0.13, false); g.add(spout);
    }
    return g;
  };
  const wallCabinets = (len: number) => {
    const g = new THREE.Group();
    g.add(box(len, 0.7, 0.34, whiteM, 0, 1.45, 0));
    const n = Math.max(2, Math.round(len / 0.55));
    for (let i = 1; i < n; i++) g.add(box(0.008, 0.66, 0.01, mat(0x999999, 0.6), -len / 2 + (len / n) * i, 1.47, 0.175, false));
    return g;
  };
  const fridge = () => {
    const g = new THREE.Group();
    g.add(box(0.72, 1.85, 0.7, steelM));
    g.add(box(0.012, 0.6, 0.012, blackM, 0.28, 1.15, 0.356, false));
    g.add(box(0.012, 0.9, 0.012, blackM, 0.28, 0.1, 0.356, false));
    g.add(box(0.7, 0.01, 0.01, mat(0x444, 0.5), 0, 1.0, 0.355, false));
    return g;
  };
  const wcItem = () => {
    const g = new THREE.Group();
    g.add(box(0.4, 0.78, 0.2, whiteM, 0, 0.0, -0.2));
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.4, 24), whiteM);
    bowl.scale.set(0.9, 1, 1.35); bowl.position.set(0, 0.2, 0.05); bowl.castShadow = true; g.add(bowl);
    g.add(box(0.36, 0.03, 0.46, mat(0xeeeeee, 0.4), 0, 0.41, 0.06));
    return g;
  };
  const vanity = () => {
    const g = new THREE.Group();
    g.add(box(0.7, 0.8, 0.45, darkWood));
    g.add(box(0.72, 0.03, 0.47, mat(0xe9e9e6, 0.3), 0, 0.8, 0));
    const basin = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), whiteM);
    basin.rotation.x = Math.PI; basin.position.set(0, 0.83, 0.02); g.add(basin);
    g.add(cyl(0.012, 0.2, steelM, 0, 0.83, -0.16, 8));
    const mirror = box(0.6, 0.8, 0.02, mat(0xbfd7e6, 0.05, 0.9), 0, 1.15, -0.215, false); g.add(mirror);
    return g;
  };
  const showerBox = () => {
    const g = new THREE.Group();
    g.add(box(0.95, 0.04, 0.95, mat(0xdcdcd8, 0.4), 0, 0, 0, false));
    g.add(box(0.95, 1.95, 0.02, glass, 0, 0.04, 0.46, false));
    g.add(box(0.02, 1.95, 0.95, glass, 0.46, 0.04, 0, false));
    g.add(cyl(0.015, 0.8, steelM, -0.44, 1.2, -0.44, 8));
    g.add(cyl(0.09, 0.02, steelM, -0.44, 2.0, -0.36, 14));
    return g;
  };
  const deskItem = (w: number) => {
    const g = new THREE.Group();
    g.add(box(w, 0.04, 0.65, woodM, 0, 0.72, 0));
    g.add(box(0.04, 0.72, 0.6, darkWood, -w / 2 + 0.03, 0, 0)); g.add(box(0.04, 0.72, 0.6, darkWood, w / 2 - 0.03, 0, 0));
    g.add(box(0.55, 0.36, 0.02, blackM, 0, 0.9, -0.1, false)); g.add(box(0.06, 0.15, 0.04, blackM, 0, 0.76, -0.1, false));
    const chair = new THREE.Group();
    chair.add(box(0.45, 0.06, 0.45, blackM, 0, 0.46, 0)); chair.add(box(0.42, 0.5, 0.05, blackM, 0, 0.5, -0.22)); chair.add(cyl(0.025, 0.4, steelM, 0, 0.06, 0, 8)); chair.add(cyl(0.22, 0.03, blackM, 0, 0.02, 0, 5));
    chair.position.set(0, 0, 0.7); chair.rotation.y = Math.PI; g.add(chair);
    return g;
  };
  const shelf = (w: number) => {
    const g = new THREE.Group();
    g.add(box(w, 1.9, 0.32, woodM));
    for (let i = 0; i < 4; i++) { g.add(box(w - 0.06, 0.02, 0.3, darkWood, 0, 0.35 + i * 0.45, 0.01, false)); g.add(box(0.12 + (i % 3) * 0.05, 0.28, 0.2, i % 2 ? accentM : fabricM, -w / 4 + i * 0.1, 0.37 + i * 0.45, 0.02, false)); }
    return g;
  };
  const chairOutdoor = () => {
    const g = new THREE.Group();
    g.add(box(0.5, 0.05, 0.5, woodM, 0, 0.42, 0)); g.add(box(0.5, 0.45, 0.04, woodM, 0, 0.47, -0.23));
    for (const lx of [-1, 1]) for (const lz of [-1, 1]) g.add(box(0.04, 0.42, 0.04, darkWood, lx * 0.21, 0, lz * 0.21));
    return g;
  };
  const washer = () => {
    const g = new THREE.Group();
    g.add(box(0.6, 0.85, 0.6, whiteM));
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24), mat(0x7aa0bb, 0.1, 0.3));
    door.rotation.x = Math.PI / 2; door.position.set(0, 0.42, 0.31); g.add(door);
    return g;
  };
  const mandir = (w: number) => {
    const g = new THREE.Group();
    g.add(box(w, 0.85, 0.4, woodM)); g.add(box(w - 0.1, 0.7, 0.3, mat(0x2b1d14, 0.6), 0, 0.9, 0));
    g.add(box(w, 0.1, 0.42, darkWood, 0, 1.6, 0));
    const glow = emissive(0xffb347, 1.6); g.add(sphere(0.05, glow, 0, 1.25, 0.05));
    const L = new THREE.PointLight(0xffa94d, 1.2, 2.5, 1.8); L.position.set(0, 1.3, 0.2); g.add(L);
    return g;
  };
  const curtain = (w: number, color: number) => box(w, H - 0.25, 0.06, mat(color, 1), 0, 0.15, 0, false);
  const console2 = () => {
    const g = new THREE.Group();
    g.add(box(1.0, 0.04, 0.32, woodM, 0, 0.78, 0));
    for (const sx of [-1, 1]) g.add(box(0.04, 0.78, 0.28, darkWood, sx * 0.46, 0, 0));
    g.add(cyl(0.05, 0.14, accentM, -0.3, 0.82, 0));
    return g;
  };

  /* ---------------- fill each room */
  for (const r of roomList) {
    const ctx = mkCtx(r.bx);
    const { a, d } = ctx;
    const minDim = Math.min(a, d);
    const area = a * d;
    const kind = r.kind;
    const sidesByLen = [...SIDES].sort((p, q) => sideLen(ctx, q) - sideLen(ctx, p));

    if (kind === 'bedroom' || kind === 'master') {
      const bw = kind === 'master' && minDim > 3 ? 1.8 : area > 11 ? 1.6 : 1.4;
      const bd = 2.05;
      let bedSide: Side | null = null, bedAt = 0;
      for (const s of sidesByLen) {
        if (perpLen(ctx, s) < bd + 0.7) continue;
        const along = findSpot(ctx, s, bw + 1.0, false, 'center') ?? findSpot(ctx, s, bw + 0.04, false, 'center');
        if (along !== null) { bedSide = s; bedAt = along; break; }
      }
      if (bedSide) {
        const withTables = free(ctx, bedSide, bedAt, bw + 1.0, false);
        putOnSide(ctx, bedItem(bw, bd), bedSide, bedAt, bw, bd);
        if (withTables) for (const sg of [-1, 1]) putOnSide(ctx, bedside(), bedSide, bedAt + sg * (bw / 2 + 0.28), 0.45, 0.4);
        // art above the headboard
        const art = wallArt(bw * 0.6, 0.55);
        const off = WALL_T / 2 + 0.03;
        const px = bedSide === 'W' ? r.bx.minX + off : bedSide === 'E' ? r.bx.maxX - off : bedAt;
        const pz = bedSide === 'N' ? r.bx.minZ + off : bedSide === 'S' ? r.bx.maxZ - off : bedAt;
        art.position.set(px, 1.5, pz);
        art.rotation.y = bedSide === 'N' ? 0 : bedSide === 'S' ? Math.PI : bedSide === 'W' ? Math.PI / 2 : -Math.PI / 2;
        group.add(art);
        // rug at the foot
        const alongX = bedSide === 'N' || bedSide === 'S';
        const rx = bedSide === 'W' ? r.bx.minX + bd * 0.6 + 0.6 : bedSide === 'E' ? r.bx.maxX - bd * 0.6 - 0.6 : bedAt;
        const rz = bedSide === 'N' ? r.bx.minZ + bd * 0.6 + 0.6 : bedSide === 'S' ? r.bx.maxZ - bd * 0.6 - 0.6 : bedAt;
        if (minDim > 2.9) putAt(rug(alongX ? bw + 0.9 : 2.2, alongX ? 2.2 : bw + 0.9, finish.fabric), rx, rz);
      }
      const wardW = kind === 'master' && a * d > 14 ? 2.4 : area > 10 ? 1.8 : 1.2;
      for (const s of sidesByLen) {
        if (s === bedSide) continue;
        if (perpLen(ctx, s) < 1.9) continue;
        const along = findSpot(ctx, s, wardW, true, 'start') ?? findSpot(ctx, s, 1.2, true, 'start');
        if (along !== null) { const wl = free(ctx, s, along, wardW, true) ? wardW : 1.2; putOnSide(ctx, wardrobe(wl), s, along, wl, 0.6); break; }
      }
      // armchair + plant in generous rooms
      if (area > 15) { const s = sidesByLen.find((x) => x !== bedSide && findSpot(ctx, x, 0.9, false, 'end') !== null); if (s) { const al = findSpot(ctx, s, 0.9, false, 'end')!; putOnSide(ctx, plant(0.9), s, al, 0.5, 0.5); } }
    }

    else if (kind === 'living') {
      const sw = area > 20 ? 2.4 : area > 13 ? 2.1 : 1.8;
      let placed = false;
      for (const s of sidesByLen) {
        const o = OPP[s];
        if (perpLen(ctx, s) < 3.2) continue;
        const sa = findSpot(ctx, s, sw, false, 'center');
        const tw = Math.min(1.8, sideLen(ctx, o) - 0.5);
        const ta = tw > 1.1 ? findSpot(ctx, o, tw, true, 'center') : null;
        if (sa !== null) {
          putOnSide(ctx, sofaItem(sw), s, sa, sw, 0.92);
          if (ta !== null) putOnSide(ctx, tvUnit(tw), o, ta, tw, 0.4);
          // coffee table + rug between
          const mx = s === 'W' ? r.bx.minX + 0.92 + 1.1 : s === 'E' ? r.bx.maxX - 0.92 - 1.1 : sa;
          const mz = s === 'N' ? r.bx.minZ + 0.92 + 1.1 : s === 'S' ? r.bx.maxZ - 0.92 - 1.1 : sa;
          const alongX = s === 'N' || s === 'S';
          putAt(rug(alongX ? sw + 0.6 : 2.4, alongX ? 2.4 : sw + 0.6, finish.fabric), mx, mz);
          putAt(coffeeTable(), mx, mz, alongX ? 0 : Math.PI / 2, 1.0, 0.55, true);
          placed = true; break;
        }
      }
      if (!placed && minDim > 2) { const s = sidesByLen[0]; const sa = findSpot(ctx, s, 1.8, false); if (sa !== null) putOnSide(ctx, sofaItem(1.8), s, sa, 1.8, 0.92); }
      for (const s of sidesByLen) { const al = findSpot(ctx, s, 0.5, false, 'end'); if (al !== null && area > 14) { putOnSide(ctx, plant(1.1), s, al, 0.5, 0.5); break; } }
      if (area > 24) { // dining zone in big open living rooms
        const s = sidesByLen.find((x) => perpLen(ctx, x) > 3.4 && findSpot(ctx, x, 1.7, false) !== null);
        if (s) { const al = findSpot(ctx, s, 1.7, false)!; const dpos = putOnSide(ctx, new THREE.Group(), s, al, 1.7, 1.5, false); void dpos; const g = diningSet(1.5, 0.85, 4); const off = 0.55; const gx = s === 'W' ? r.bx.minX + off : s === 'E' ? r.bx.maxX - off : al; const gz = s === 'N' ? r.bx.minZ + off : s === 'S' ? r.bx.maxZ - off : al; putAt(g, gx, gz, (s === 'E' || s === 'W') ? Math.PI / 2 : 0, 1.5, 1.7, true); }
      }
    }

    else if (kind === 'dining') {
      if (minDim > 2.2) {
        const tw = area > 14 ? 1.8 : 1.4, chairs = area > 14 ? 6 : 4;
        const g = diningSet(tw, 0.9, chairs);
        const alongX = a >= d;
        putAt(g, (r.bx.minX + r.bx.maxX) / 2, (r.bx.minZ + r.bx.maxZ) / 2, alongX ? 0 : Math.PI / 2, tw, 1.7, true);
        putAt(rug(alongX ? tw + 1 : 2.6, alongX ? 2.6 : tw + 1, finish.fabric), (r.bx.minX + r.bx.maxX) / 2, (r.bx.minZ + r.bx.maxZ) / 2);
        pendant((r.bx.minX + r.bx.maxX) / 2, (r.bx.minZ + r.bx.maxZ) / 2);
      }
      const s = sidesByLen.find((x) => perpLen(ctx, x) > 3.2 && findSpot(ctx, x, 1.2, true) !== null);
      if (s) putOnSide(ctx, console2(), s, findSpot(ctx, s, 1.0, true)!, 1.0, 0.32);
    }

    else if (kind === 'kitchen') {
      // main run along the longest side without a door/window in the way
      let first: Side | null = null;
      for (const s of sidesByLen) {
        if (perpLen(ctx, s) < 1.6) continue;
        const range = sideAxisRange(ctx, s);
        const runLen = Math.min(3.6, range[1] - range[0] - 0.08);
        if (runLen < 1.5) continue;
        const along = findSpot(ctx, s, runLen, false, 'start') ?? findSpot(ctx, s, 1.8, false, 'start');
        if (along !== null) {
          const L = free(ctx, s, along, runLen, false) ? runLen : 1.8;
          const fr = free(ctx, s, along - L / 2 - 0.37, 0.74, true) && !ctx.doors[s].length ? true : false;
          putOnSide(ctx, counterRun(L, true, true), s, along, L, 0.6);
          const wc = wallCabinets(L); const place = (fn: () => void) => fn();
          place(() => { const off = WALL_T / 2 + 0.03; const wx = s === 'W' ? r.bx.minX + off + 0.17 : s === 'E' ? r.bx.maxX - off - 0.17 : along; const wz = s === 'N' ? r.bx.minZ + off + 0.17 : s === 'S' ? r.bx.maxZ - off - 0.17 : along; wc.position.set(wx, 0, wz); wc.rotation.y = s === 'N' ? 0 : s === 'S' ? Math.PI : s === 'W' ? Math.PI / 2 : -Math.PI / 2; ctx.wins[s].some(([x0, x1]) => along - L / 2 < x1 && along + L / 2 > x0) ? 0 : group.add(wc); });
          if (fr) putOnSide(ctx, fridge(), s, along - L / 2 - 0.37, 0.72, 0.7);
          first = s; break;
        }
      }
      // second leg (L shape) on an adjacent side
      if (first && minDim > 2.1) {
        const adj: Side[] = first === 'N' || first === 'S' ? ['W', 'E'] : ['N', 'S'];
        for (const s of adj) {
          const al = findSpot(ctx, s, 1.4, false, first === 'N' || first === 'W' ? 'end' : 'start');
          if (al !== null && perpLen(ctx, s) > 2.2) { putOnSide(ctx, counterRun(1.4, false, false), s, al, 1.4, 0.6); break; }
        }
      }
    }

    else if (kind === 'bath') {
      // shower in the corner farthest from the door
      const doorPts = openingPoints.filter((o) => o.type === 'door');
      const corners = [
        { x: r.bx.minX + 0.55, z: r.bx.minZ + 0.55, rot: Math.PI, sides: ['N', 'W'] as Side[] },
        { x: r.bx.maxX - 0.55, z: r.bx.minZ + 0.55, rot: Math.PI, sides: ['N', 'E'] as Side[] },
        { x: r.bx.minX + 0.55, z: r.bx.maxZ - 0.55, rot: 0, sides: ['S', 'W'] as Side[] },
        { x: r.bx.maxX - 0.55, z: r.bx.maxZ - 0.55, rot: 0, sides: ['S', 'E'] as Side[] },
      ];
      const dist = (c: { x: number; z: number }) => Math.min(99, ...doorPts.filter((o) => o.x >= r.bx.minX - 0.3 && o.x <= r.bx.maxX + 0.3 && o.z >= r.bx.minZ - 0.3 && o.z <= r.bx.maxZ + 0.3).map((o) => Math.hypot(o.x - c.x, o.z - c.z)));
      const okCorner = minDim >= 1.5 ? corners.filter((c) => c.sides.every((s) => free(ctx, s, s === 'N' || s === 'S' ? c.x : c.z, 0.9, false))).sort((p, q) => dist(q) - dist(p))[0] : undefined;
      if (okCorner) {
        const g = showerBox();
        // orient so the glass faces into the room
        const sx = okCorner.sides.includes('W') ? -1 : 1, sz = okCorner.sides.includes('N') ? -1 : 1;
        g.scale.set(sx === -1 ? -1 : 1, 1, sz === -1 ? -1 : 1);
        // mirror of the default (glass at +z and +x) -> glass must sit on the room side
        g.scale.set(-sx, 1, -sz);
        putAt(g, okCorner.x, okCorner.z, 0, 0.95, 0.95, true);
        for (const s of okCorner.sides) ctx.used[s].push([(s === 'N' || s === 'S' ? okCorner.x : okCorner.z) - 0.5, (s === 'N' || s === 'S' ? okCorner.x : okCorner.z) + 0.5]);
      }
      for (const s of sidesByLen) {
        const al = findSpot(ctx, s, 0.72, true, 'center');
        if (al !== null && perpLen(ctx, s) > 1.4) { putOnSide(ctx, vanity(), s, al, 0.7, 0.45); break; }
      }
      for (const s of sidesByLen) {
        const al = findSpot(ctx, s, 0.5, false, 'end') ?? findSpot(ctx, s, 0.5, false, 'start');
        if (al !== null && perpLen(ctx, s) > 1.3) { putOnSide(ctx, wcItem(), s, al, 0.42, 0.7); break; }
      }
    }

    else if (kind === 'study') {
      for (const s of sidesByLen) {
        const al = findSpot(ctx, s, 1.4, false, 'center');
        if (al !== null && perpLen(ctx, s) > 2.4) { putOnSide(ctx, deskItem(1.4), s, al, 1.4, 1.3); break; }
      }
      for (const s of sidesByLen) { const al = findSpot(ctx, s, 1.0, true, 'start'); if (al !== null && perpLen(ctx, s) > 1.6) { putOnSide(ctx, shelf(1.0), s, al, 1.0, 0.32); break; } }
    }

    else if (kind === 'balcony') {
      if (minDim > 0.9) {
        const s = sidesByLen.find((x) => findSpot(ctx, x, 1.4, false, 'center') !== null);
        if (s && minDim > 1.3) {
          const al = findSpot(ctx, s, 1.4, false, 'center')!;
          putOnSide(ctx, chairOutdoor(), s, al - 0.5, 0.5, 0.5);
          putOnSide(ctx, chairOutdoor(), s, al + 0.5, 0.5, 0.5);
          const t = new THREE.Group(); t.add(cyl(0.25, 0.04, woodM, 0, 0.5, 0)); t.add(cyl(0.03, 0.5, darkWood, 0, 0, 0)); putOnSide(ctx, t, s, al, 0.1, 0.1, false, 0.45);
        }
        const pAl = sidesByLen.map((x) => ({ x, al: findSpot(ctx, x, 0.5, false, 'end') })).find((v) => v.al !== null);
        if (pAl) putOnSide(ctx, plant(1.0), pAl.x, pAl.al!, 0.5, 0.5);
      }
      // low parapet / glass rail on outer edges
      for (const s of SIDES) {
        const px = s === 'W' ? r.bx.minX : s === 'E' ? r.bx.maxX : (r.bx.minX + r.bx.maxX) / 2;
        const pz = s === 'N' ? r.bx.minZ : s === 'S' ? r.bx.maxZ : (r.bx.minZ + r.bx.maxZ) / 2;
        const outsideX = px + (s === 'W' ? -0.4 : s === 'E' ? 0.4 : 0), outsideZ = pz + (s === 'N' ? -0.4 : s === 'S' ? 0.4 : 0);
        const isOuter = !roomList.some((o) => o !== r && outsideX > o.bx.minX && outsideX < o.bx.maxX && outsideZ > o.bx.minZ && outsideZ < o.bx.maxZ) && (outsideX < bounds.minX - 0.1 || outsideX > bounds.maxX + 0.1 || outsideZ < bounds.minZ - 0.1 || outsideZ > bounds.maxZ + 0.1 || true);
        if (!isOuter) continue;
        const horiz = s === 'N' || s === 'S';
        const len = horiz ? a : d;
        const rail = box(horiz ? len : 0.03, 1.0, horiz ? 0.03 : len, glass, px, 0, pz, false);
        const cap = box(horiz ? len : 0.05, 0.04, horiz ? 0.05 : len, steelM, px, 1.0, pz, false);
        wallsG.add(rail, cap);
        colliders.push(horiz ? { x1: r.bx.minX, z1: pz, x2: r.bx.maxX, z2: pz } : { x1: px, z1: r.bx.minZ, x2: px, z2: r.bx.maxZ });
      }
    }

    else if (kind === 'pooja') {
      const s = sidesByLen.find((x) => findSpot(ctx, x, 0.9, true, 'center') !== null);
      if (s) putOnSide(ctx, mandir(0.8), s, findSpot(ctx, s, 0.9, true, 'center')!, 0.8, 0.4);
    }

    else if (kind === 'utility') {
      const s = sidesByLen.find((x) => findSpot(ctx, x, 0.7, false, 'start') !== null && perpLen(ctx, x) > 1.0);
      if (s) putOnSide(ctx, washer(), s, findSpot(ctx, s, 0.7, false, 'start')!, 0.6, 0.6);
    }

    else if (kind === 'hall' || kind === 'other') {
      if (minDim > 1.3 && area > 3.5) {
        const s = sidesByLen.find((x) => findSpot(ctx, x, 1.0, true, 'center') !== null && perpLen(ctx, x) > 1.2);
        if (s) putOnSide(ctx, console2(), s, findSpot(ctx, s, 1.0, true, 'center')!, 1.0, 0.32);
      }
    }

    // curtains on bedroom / living windows
    if (['bedroom', 'master', 'living', 'study'].includes(kind)) {
      for (const o of openingPoints) {
        if (o.type !== 'window') continue;
        const inside = o.x > r.bx.minX - 0.3 && o.x < r.bx.maxX + 0.3 && o.z > r.bx.minZ - 0.3 && o.z < r.bx.maxZ + 0.3;
        if (!inside) continue;
        const onN = o.horizontal && Math.abs(o.z - r.bx.minZ) < 0.3, onS = o.horizontal && Math.abs(o.z - r.bx.maxZ) < 0.3;
        const onW = !o.horizontal && Math.abs(o.x - r.bx.minX) < 0.3, onE = !o.horizontal && Math.abs(o.x - r.bx.maxX) < 0.3;
        if (!(onN || onS || onW || onE)) continue;
        const nx = onW ? 1 : onE ? -1 : 0, nz = onN ? 1 : onS ? -1 : 0;
        for (const sg of [-1, 1]) {
          const c = curtain(0.45, finish.fabric);
          const ox = o.horizontal ? sg * (o.w / 2 + 0.05) : 0, oz = o.horizontal ? 0 : sg * (o.w / 2 + 0.05);
          c.position.set(o.x + ox + nx * 0.14, c.position.y, o.z + oz + nz * 0.14);
          if (!o.horizontal) c.rotation.y = Math.PI / 2;
          wallsG.add(c);
        }
        const rod = box(o.horizontal ? o.w + 1.2 : 0.02, 0.02, o.horizontal ? 0.02 : o.w + 1.2, blackM, o.x + nx * 0.14, 0, o.z + nz * 0.14, false);
        rod.position.y = H - 0.18; wallsG.add(rod);
      }
    }
  }

  return { group, walls: wallsG, ceiling: ceilingG, lights, glass, rooms, colliders, floorMeshes, doors: openingPoints.filter((o) => o.type === 'door').map((o) => ({ x: o.x, z: o.z })), size: { w: wM, d: dM }, bounds, H };
}

export function disposeModel(obj: THREE.Object3D) {
  obj.traverse((o: any) => {
    o.geometry?.dispose?.();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m: any) => { m.map?.dispose?.(); m.dispose?.(); });
  });
}
