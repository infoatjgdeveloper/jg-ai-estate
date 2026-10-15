import type { FloorPlan, PlanItem, PlanOpening, PlanRoomLabel, PlanWall, RoomKind } from './types';

let counter = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const FT_PER_M = 3.28084;

export function emptyPlan(name: string, imageW: number, imageH: number, imageUrl?: string): FloorPlan {
  return {
    id: uid('plan'),
    name,
    imageW,
    imageH,
    // Placeholder: assume the page is ~14 m wide. The builder must set the real scale.
    pxPerMeter: imageW / 14,
    scaleConfirmed: false,
    wallHeight: 2.9,
    walls: [],
    openings: [],
    rooms: [],
    imageUrl,
  };
}

export function wallLength(w: PlanWall) {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

/** Closest point on a wall to (x,y): returns t (0..1) and distance in px. */
export function projectOnWall(w: PlanWall, x: number, y: number) {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((x - w.x1) * dx + (y - w.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = w.x1 + t * dx;
  const py = w.y1 + t * dy;
  return { t, dist: Math.hypot(x - px, y - py), px, py };
}

export function nearestWall(walls: PlanWall[], x: number, y: number, maxDist: number) {
  let best: { wall: PlanWall; t: number; dist: number } | null = null;
  for (const w of walls) {
    const r = projectOnWall(w, x, y);
    if (r.dist <= maxDist && (!best || r.dist < best.dist)) best = { wall: w, t: r.t, dist: r.dist };
  }
  return best;
}

export function planBounds(plan: FloorPlan) {
  if (!plan.walls.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    minX = Math.min(minX, w.x1, w.x2);
    maxX = Math.max(maxX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2);
    maxY = Math.max(maxY, w.y1, w.y2);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Footprint of the traced walls' bounding box in sq ft (a rough guide, not carpet area). */
export function footprintSqft(plan: FloorPlan) {
  const b = planBounds(plan);
  if (!b) return 0;
  const wm = b.w / plan.pxPerMeter;
  const hm = b.h / plan.pxPerMeter;
  return Math.round(wm * hm * FT_PER_M * FT_PER_M);
}

/** Parse "12ft", "3.6 m", "12'" , "12" (assumes feet if plain number > 0 and unit missing = ask caller). */
export function parseLength(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres|ft|feet|foot|')?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  const unit = m[2];
  if (!unit || unit === 'm' || unit.startsWith('met')) return n;
  return n / FT_PER_M;
}

const clamp01 = (n: unknown) => {
  const v = Number(n);
  return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
};

/** Guess what a room is from its printed name. */
export function roomKind(label: string, hint?: string): RoomKind {
  const l = label.toLowerCase();
  if (/master|m\.?\s*br|mbr|main bed/.test(l)) return 'master';
  if (/bath|toilet|wc|w\.c|lavatory|washroom|t\s*&\s*b|powder/.test(l)) return 'bath';
  if (/kitchen|kit\b|pantry/.test(l)) return 'kitchen';
  if (/dining|dinning/.test(l)) return 'dining';
  if (/living|lounge|drawing|hall(?!way)|family/.test(l)) return 'living';
  if (/bed|br\b|guest|kids|child/.test(l)) return 'bedroom';
  if (/balcon|terrace|deck|sit.?out|verandah|patio/.test(l)) return 'balcony';
  if (/study|office|work|library/.test(l)) return 'study';
  if (/pooja|puja|mandir|prayer/.test(l)) return 'pooja';
  if (/utility|store|storage|wash area|laundry|dry/.test(l)) return 'utility';
  if (/passage|corridor|lobby|foyer|entry|entrance|vestibule|lift/.test(l)) return 'hall';
  const h = (hint || '') as RoomKind;
  return ['living', 'bedroom', 'master', 'kitchen', 'dining', 'bath', 'balcony', 'study', 'pooja', 'utility', 'hall', 'other'].includes(h) ? h : 'other';
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

function snapAxis(vals: number[], tol: number) {
  const sorted = [...new Set(vals)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  let group: number[] = [];
  const flush = () => {
    if (!group.length) return;
    const mean = group.reduce((s, v) => s + v, 0) / group.length;
    group.forEach((v) => map.set(v, mean));
    group = [];
  };
  for (const v of sorted) {
    if (group.length && v - group[group.length - 1] > tol) flush();
    group.push(v);
  }
  flush();
  return map;
}

/** Closed wall network from room rectangles: shared edges become one wall, outer edges the envelope. */
export function wallsFromRects(rects: Rect[], tol: number): PlanWall[] {
  const xs = snapAxis(rects.flatMap((r) => [r.x0, r.x1]), tol);
  const ys = snapAxis(rects.flatMap((r) => [r.y0, r.y1]), tol);
  const H = new Map<number, [number, number][]>();
  const V = new Map<number, [number, number][]>();
  const add = (m: Map<number, [number, number][]>, k: number, a: number, b: number) => {
    const key = Math.round(k * 10) / 10;
    (m.get(key) || m.set(key, []).get(key)!).push([Math.min(a, b), Math.max(a, b)]);
  };
  for (const r of rects) {
    const x0 = xs.get(r.x0)!, x1 = xs.get(r.x1)!, y0 = ys.get(r.y0)!, y1 = ys.get(r.y1)!;
    if (x1 - x0 < tol || y1 - y0 < tol) continue;
    add(H, y0, x0, x1); add(H, y1, x0, x1);
    add(V, x0, y0, y1); add(V, x1, y0, y1);
  }
  const out: PlanWall[] = [];
  const merge = (m: Map<number, [number, number][]>, horizontal: boolean) => {
    for (const [k, list] of m) {
      list.sort((a, b) => a[0] - b[0]);
      let cur = [...list[0]] as [number, number];
      const push = () => out.push(horizontal ? { id: uid('w'), x1: cur[0], y1: k, x2: cur[1], y2: k } : { id: uid('w'), x1: k, y1: cur[0], x2: k, y2: cur[1] });
      for (const seg of list.slice(1)) {
        if (seg[0] <= cur[1] + 0.5) cur[1] = Math.max(cur[1], seg[1]);
        else { push(); cur = [...seg] as [number, number]; }
      }
      push();
    }
  };
  merge(H, true);
  merge(V, false);
  return out;
}

/** Room rectangle in px, snapped the same way as the walls (so door/furniture maths lines up). */
function snapRect(r: Rect, xs: Map<number, number>, ys: Map<number, number>): Rect {
  return { x0: xs.get(r.x0) ?? r.x0, x1: xs.get(r.x1) ?? r.x1, y0: ys.get(r.y0) ?? r.y0, y1: ys.get(r.y1) ?? r.y1 };
}

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/**
 * Turn one AI-read unit layout into a complete, editable plan:
 * closed walls from the room outlines, doors/windows where the AI saw them, and — so every room
 * is reachable and has daylight in the model — sensible doors and windows added where the AI missed them.
 * Always a draft: the builder checks it in the 3D preview.
 */
export function planFromItem(base: FloorPlan, item: PlanItem): FloorPlan {
  const W = base.imageW;
  const H = base.imageH;
  const rooms0 = (item.rooms || []).slice(0, 40).map((r) => {
    const x0 = clamp01(r.x) * W, y0 = clamp01(r.y) * H;
    return { label: String(r.label || '').slice(0, 40), kind: roomKind(String(r.label || ''), r.kind), rect: { x0, y0, x1: Math.min(W, x0 + clamp01(r.w) * W), y1: Math.min(H, y0 + clamp01(r.h) * H) } };
  }).filter((r) => r.rect.x1 - r.rect.x0 > 8 && r.rect.y1 - r.rect.y0 > 8);
  if (!rooms0.length) return base;

  const tol = Math.max(W, H) * 0.012;
  const xs = snapAxis(rooms0.flatMap((r) => [r.rect.x0, r.rect.x1]), tol);
  const ys = snapAxis(rooms0.flatMap((r) => [r.rect.y0, r.rect.y1]), tol);
  const rects = rooms0.map((r) => snapRect(r.rect, xs, ys));
  const walls = wallsFromRects(rooms0.map((r) => r.rect), tol);

  // ---- scale
  let ppm = base.pxPerMeter;
  const minX = Math.min(...rects.map((r) => r.x0)), maxX = Math.max(...rects.map((r) => r.x1));
  const interior = rooms0.map((r, i) => ({ k: r.kind, a: (rects[i].x1 - rects[i].x0) * (rects[i].y1 - rects[i].y0) })).filter((r) => r.k !== 'balcony');
  const sumPx = interior.reduce((s, r) => s + r.a, 0);
  if (item.overallWidthM && item.overallWidthM > 3 && item.overallWidthM < 60 && maxX - minX > 20) ppm = (maxX - minX) / item.overallWidthM;
  else if (item.areaSqft && item.areaSqft > 150 && item.areaSqft < 15000 && sumPx > 400) ppm = Math.sqrt(sumPx / ((item.areaSqft / 10.7639) * 0.88));

  // ---- openings from the AI hints
  const openings: PlanOpening[] = [];
  const hint = (list: { x: number; y: number; width?: number }[] | undefined, type: 'door' | 'window') => {
    for (const o of (list || []).slice(0, 80)) {
      const near = nearestWall(walls, clamp01(o.x) * W, clamp01(o.y) * H, Math.max(W, H) * 0.035);
      if (!near) continue;
      const width = Number(o.width);
      openings.push({ id: uid('o'), wallId: near.wall.id, t: Math.min(0.92, Math.max(0.08, near.t)), width: isFinite(width) && width > 0.5 && width < 3 ? width : type === 'door' ? 0.9 : 1.2, type });
    }
  };
  hint(item.doors, 'door');
  hint(item.windows, 'window');

  const wallAt = (x: number, y: number) => nearestWall(walls, x, y, tol * 1.5);
  const opPoint = (o: PlanOpening) => {
    const w = walls.find((q) => q.id === o.wallId)!;
    return { x: w.x1 + (w.x2 - w.x1) * o.t, y: w.y1 + (w.y2 - w.y1) * o.t };
  };
  const touches = (r: Rect, px: number, py: number) => {
    const m = tol * 1.6;
    const inX = px >= r.x0 - m && px <= r.x1 + m, inY = py >= r.y0 - m && py <= r.y1 + m;
    return (inY && (Math.abs(px - r.x0) < m || Math.abs(px - r.x1) < m)) || (inX && (Math.abs(py - r.y0) < m || Math.abs(py - r.y1) < m));
  };
  const addAt = (x: number, y: number, width: number, type: 'door' | 'window') => {
    const n = wallAt(x, y);
    if (!n) return;
    openings.push({ id: uid('o'), wallId: n.wall.id, t: Math.min(0.9, Math.max(0.1, n.t)), width, type });
  };

  // ---- make sure every room can be entered, and living spaces have daylight
  const insideAny = (x: number, y: number) => rects.some((r) => x > r.x0 + 2 && x < r.x1 - 2 && y > r.y0 + 2 && y < r.y1 - 2);
  const hub = (() => { // the most connected room acts as the "front door" room
    let best = 0, bi = 0;
    rects.forEach((a, i) => {
      let c = 0;
      rects.forEach((b, j) => { if (i !== j) c += overlap(a.x0, a.x1, b.x0, b.x1) * (Math.abs(a.y1 - b.y0) < tol * 2 || Math.abs(a.y0 - b.y1) < tol * 2 ? 1 : 0) + overlap(a.y0, a.y1, b.y0, b.y1) * (Math.abs(a.x1 - b.x0) < tol * 2 || Math.abs(a.x0 - b.x1) < tol * 2 ? 1 : 0); });
      if (rooms0[i].kind === 'living' || rooms0[i].kind === 'hall') c *= 1.4;
      if (c > best) { best = c; bi = i; }
    });
    return bi;
  })();

  let entranceDone = false;
  rects.forEach((r, i) => {
    const ops = openings.filter((o) => o.type === 'door').map(opPoint);
    const has = ops.some((p) => touches(r, p.x, p.y));
    if (!has) {
      // longest shared edge with another room (prefer the hub)
      let best: { len: number; x: number; y: number; w: number } | null = null;
      rects.forEach((o, j) => {
        if (i === j) return;
        const bonus = j === hub ? 1.5 : 1;
        const vx = [r.x1, r.x0].find((xv) => Math.abs(xv - (xv === r.x1 ? o.x0 : o.x1)) < tol * 2);
        const hy = [r.y1, r.y0].find((yv) => Math.abs(yv - (yv === r.y1 ? o.y0 : o.y1)) < tol * 2);
        if (vx !== undefined) {
          const ov = overlap(r.y0, r.y1, o.y0, o.y1);
          if (ov * bonus > (best?.len ?? 0)) best = { len: ov * bonus, x: vx, y: (Math.max(r.y0, o.y0) + Math.min(r.y1, o.y1)) / 2, w: ov };
        }
        if (hy !== undefined) {
          const ov = overlap(r.x0, r.x1, o.x0, o.x1);
          if (ov * bonus > (best?.len ?? 0)) best = { len: ov * bonus, x: (Math.max(r.x0, o.x0) + Math.min(r.x1, o.x1)) / 2, y: hy, w: ov };
        }
      });
      if (best && (best as any).w > ppm * 0.9) addAt((best as any).x, (best as any).y, rooms0[i].kind === 'balcony' ? 1.6 : 0.9, 'door');
    }
    // windows: bedrooms, living, kitchen, study, dining on an outside edge
    if (['bedroom', 'master', 'living', 'kitchen', 'study', 'dining', 'bath'].includes(rooms0[i].kind)) {
      const wins = openings.filter((o) => o.type === 'window').map(opPoint);
      if (!wins.some((p) => touches(r, p.x, p.y))) {
        const edges = [
          { x: (r.x0 + r.x1) / 2, y: r.y0, len: r.x1 - r.x0, dx: 0, dy: -1 },
          { x: (r.x0 + r.x1) / 2, y: r.y1, len: r.x1 - r.x0, dx: 0, dy: 1 },
          { x: r.x0, y: (r.y0 + r.y1) / 2, len: r.y1 - r.y0, dx: -1, dy: 0 },
          { x: r.x1, y: (r.y0 + r.y1) / 2, len: r.y1 - r.y0, dx: 1, dy: 0 },
        ].filter((e) => !insideAny(e.x + e.dx * tol * 3, e.y + e.dy * tol * 3)).sort((a, b) => b.len - a.len);
        if (edges[0] && edges[0].len > ppm * 1.1) addAt(edges[0].x, edges[0].y, rooms0[i].kind === 'bath' ? 0.6 : Math.min(1.8, edges[0].len / ppm * 0.45), 'window');
      }
    }
  });
  // main entrance: an outside edge of the hub room if no outside door exists
  {
    const r = rects[hub];
    const ext = [
      { x: (r.x0 + r.x1) / 2, y: r.y0, len: r.x1 - r.x0, dx: 0, dy: -1 },
      { x: (r.x0 + r.x1) / 2, y: r.y1, len: r.x1 - r.x0, dx: 0, dy: 1 },
      { x: r.x0, y: (r.y0 + r.y1) / 2, len: r.y1 - r.y0, dx: -1, dy: 0 },
      { x: r.x1, y: (r.y0 + r.y1) / 2, len: r.y1 - r.y0, dx: 1, dy: 0 },
    ].filter((e) => !insideAny(e.x + e.dx * tol * 3, e.y + e.dy * tol * 3));
    const hasExt = openings.some((o) => o.type === 'door' && ext.some((e) => Math.hypot(opPoint(o).x - e.x, opPoint(o).y - e.y) < Math.max(e.len / 2 + 2, 4)));
    if (!hasExt && ext.length) { const e = ext.sort((a, b) => b.len - a.len)[ext.length > 1 ? 1 : 0]; addAt(e.x + (e.dy !== 0 ? e.len * 0.28 : 0), e.y + (e.dx !== 0 ? e.len * 0.28 : 0), 1.0, 'door'); }
    entranceDone = true;
  }
  void entranceDone;

  const rooms: PlanRoomLabel[] = rooms0.map((r, i) => ({
    id: uid('r'), label: r.label, kind: r.kind,
    x: (rects[i].x0 + rects[i].x1) / 2, y: (rects[i].y0 + rects[i].y1) / 2,
    box: { x: rects[i].x0, y: rects[i].y0, w: rects[i].x1 - rects[i].x0, h: rects[i].y1 - rects[i].y0 },
  }));

  const next: FloorPlan = { ...base, walls, openings, rooms, pxPerMeter: ppm, scaleConfirmed: false };
  if (item.areaSqft && item.areaSqft > 100 && item.areaSqft < 20000) next.areaSqft = Math.round(item.areaSqft);
  if (item.name) next.name = String(item.name).slice(0, 60);
  if (item.bhk) next.bhk = String(item.bhk).slice(0, 20);
  if (item.floorFrom) next.floorFrom = item.floorFrom;
  if (item.floorTo) next.floorTo = item.floorTo;
  return next;
}

export const inr = (n: number) => n.toLocaleString('en-IN');
