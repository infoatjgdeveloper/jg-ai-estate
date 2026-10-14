import type { FloorPlan, PlanOpening, PlanParse, PlanWall } from './types';

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

/** Convert the AI's normalized detection into editable plan geometry. Always treated as a draft. */
export function applyPlanParse(plan: FloorPlan, parse: PlanParse): FloorPlan {
  const W = plan.imageW;
  const H = plan.imageH;
  const walls: PlanWall[] = (parse.walls || [])
    .slice(0, 400)
    .map((w) => ({
      id: uid('w'),
      x1: clamp01(w.x1) * W,
      y1: clamp01(w.y1) * H,
      x2: clamp01(w.x2) * W,
      y2: clamp01(w.y2) * H,
    }))
    .filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 6);

  const openings: PlanOpening[] = [];
  const place = (list: { x: number; y: number; width?: number }[] | undefined, type: 'door' | 'window') => {
    for (const o of (list || []).slice(0, 200)) {
      const near = nearestWall(walls, clamp01(o.x) * W, clamp01(o.y) * H, Math.max(W, H) * 0.04);
      if (!near) continue;
      const width = Number(o.width);
      openings.push({
        id: uid('o'),
        wallId: near.wall.id,
        t: near.t,
        width: isFinite(width) && width > 0.5 && width < 3 ? width : type === 'door' ? 0.9 : 1.2,
        type,
      });
    }
  };
  place(parse.doors, 'door');
  place(parse.windows, 'window');

  const rooms = (parse.rooms || []).slice(0, 60).map((r) => ({
    id: uid('r'),
    label: String(r.label || '').slice(0, 40),
    x: clamp01(r.x) * W,
    y: clamp01(r.y) * H,
  }));

  const next: FloorPlan = { ...plan, walls, openings, rooms };
  if (parse.areaSqft && isFinite(parse.areaSqft) && parse.areaSqft > 100 && parse.areaSqft < 20000) next.areaSqft = Math.round(parse.areaSqft);
  if (parse.unitType && !plan.name) next.name = String(parse.unitType).slice(0, 60);

  // Estimate scale from an overall width the model read off the dimensions (never trusted blindly).
  const b = planBounds(next);
  if (b && parse.overallWidthM && parse.overallWidthM > 3 && parse.overallWidthM < 60 && b.w > 20) {
    next.pxPerMeter = b.w / parse.overallWidthM;
    next.scaleConfirmed = false;
  }
  return next;
}

export const inr = (n: number) => n.toLocaleString('en-IN');
