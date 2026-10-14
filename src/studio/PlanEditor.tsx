import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FloorPlan, PlanOpening, PlanWall } from './types';
import { footprintSqft, nearestWall, parseLength, projectOnWall, uid, wallLength } from './geometry';

type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'scale' | 'erase';
type Sel = { kind: 'wall' | 'opening' | 'room'; id: string } | null;

interface Props {
  plan: FloorPlan;
  /** Tracing image (data URL or Storage URL). Optional: you can trace on a blank grid. */
  imageSrc?: string;
  onChange: (plan: FloorPlan) => void;
  onAiDetect?: () => void;
  aiBusy?: boolean;
  aiMessage?: string | null;
}

type Snapshot = Pick<FloorPlan, 'walls' | 'openings' | 'rooms' | 'pxPerMeter' | 'scaleConfirmed'>;

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'select', label: 'Select', hint: 'Tap a wall or opening to select it. Drag the round handles to move wall ends. Drag empty space to pan.' },
  { id: 'wall', label: 'Wall', hint: 'Tap to start a wall, tap again to place its end. Keep tapping to continue the chain. Double-tap or press Esc to finish.' },
  { id: 'door', label: 'Door', hint: 'Tap on a wall to place a door.' },
  { id: 'window', label: 'Window', hint: 'Tap on a wall to place a window.' },
  { id: 'room', label: 'Room name', hint: 'Tap inside a room to add its name (Living, Bedroom 1...).' },
  { id: 'scale', label: 'Set scale', hint: 'Tap both ends of something with a known length (a wall with a printed dimension), then enter the real length.' },
  { id: 'erase', label: 'Erase', hint: 'Tap a wall, opening or room name to delete it.' },
];

export default function PlanEditor({ plan, imageSrc, onChange, onAiDetect, aiBusy, aiMessage }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const planRef = useRef(plan);
  planRef.current = plan;

  const [tool, setTool] = useState<Tool>('wall');
  const [sel, setSel] = useState<Sel>(null);
  const [vb, setVb] = useState({ x: 0, y: 0, w: plan.imageW, h: plan.imageH });
  const vbRef = useRef(vb);
  vbRef.current = vb;
  const [svgW, setSvgW] = useState(800);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [scalePts, setScalePts] = useState<{ x: number; y: number }[]>([]);
  const [ask, setAsk] = useState<null | { kind: 'scale' | 'room'; x: number; y: number }>(null);
  const [askValue, setAskValue] = useState('');
  const [askError, setAskError] = useState('');
  const history = useRef<Snapshot[]>([]);
  const [histLen, setHistLen] = useState(0);
  const drag = useRef<null | { type: 'pan'; sx: number; sy: number; vb: typeof vb } | { type: 'handle'; ends: { wallId: string; end: 1 | 2 }[] } | { type: 'room'; id: string }>(null);

  const upp = vb.w / svgW; // svg units per screen pixel

  // Reset the view when switching to a different plan.
  useEffect(() => {
    setVb({ x: 0, y: 0, w: plan.imageW, h: plan.imageH });
    setDraft(null);
    setSel(null);
    setScalePts([]);
    history.current = [];
    setHistLen(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSvgW(el.clientWidth || 800));
    ro.observe(el);
    setSvgW(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom around the cursor (needs a non-passive listener to stop page scroll).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      setVb((v) => {
        const nw = Math.max(80, Math.min(planRef.current.imageW * 3, v.w * f));
        const k = nw / v.w;
        return { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w: nw, h: v.h * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toSvg = useCallback((cx: number, cy: number) => {
    const el = svgRef.current!;
    const r = el.getBoundingClientRect();
    const v = vbRef.current;
    return { x: v.x + ((cx - r.left) / r.width) * v.w, y: v.y + ((cy - r.top) / r.height) * v.h };
  }, []);

  const pushHistory = () => {
    const p = planRef.current;
    history.current.push({
      walls: p.walls.map((w) => ({ ...w })),
      openings: p.openings.map((o) => ({ ...o })),
      rooms: p.rooms.map((r) => ({ ...r })),
      pxPerMeter: p.pxPerMeter,
      scaleConfirmed: p.scaleConfirmed,
    });
    if (history.current.length > 60) history.current.shift();
    setHistLen(history.current.length);
  };

  const undo = useCallback(() => {
    const s = history.current.pop();
    setHistLen(history.current.length);
    if (!s) return;
    setSel(null);
    setDraft(null);
    onChange({ ...planRef.current, ...s });
  }, [onChange]);

  const mutate = (fn: (p: FloorPlan) => FloorPlan) => {
    pushHistory();
    onChange(fn(planRef.current));
  };

  // Snap to nearby wall endpoints, then to horizontal/vertical from the previous point.
  const snap = (x: number, y: number, from?: { x: number; y: number } | null) => {
    const r = 10 * upp;
    let best: { x: number; y: number; d: number } | null = null;
    for (const w of planRef.current.walls) {
      for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]] as const) {
        const d = Math.hypot(px - x, py - y);
        if (d < r && (!best || d < best.d)) best = { x: px, y: py, d };
      }
    }
    if (best) return { x: best.x, y: best.y };
    if (from) {
      const dx = Math.abs(x - from.x);
      const dy = Math.abs(y - from.y);
      if (dy < dx * 0.08) return { x, y: from.y };
      if (dx < dy * 0.08) return { x: from.x, y };
    }
    return { x, y };
  };

  const hit = (x: number, y: number) => {
    const p = planRef.current;
    const r = 12 * upp;
    // endpoints first
    for (const w of p.walls) {
      if (Math.hypot(w.x1 - x, w.y1 - y) < r) return { kind: 'handle' as const, x: w.x1, y: w.y1 };
      if (Math.hypot(w.x2 - x, w.y2 - y) < r) return { kind: 'handle' as const, x: w.x2, y: w.y2 };
    }
    for (const o of p.openings) {
      const w = p.walls.find((q) => q.id === o.wallId);
      if (!w) continue;
      const ox = w.x1 + (w.x2 - w.x1) * o.t;
      const oy = w.y1 + (w.y2 - w.y1) * o.t;
      if (Math.hypot(ox - x, oy - y) < Math.max(r, (o.width * p.pxPerMeter) / 2)) return { kind: 'opening' as const, id: o.id };
    }
    for (const rm of p.rooms) {
      if (Math.hypot(rm.x - x, rm.y - y) < 24 * upp) return { kind: 'room' as const, id: rm.id };
    }
    const n = nearestWall(p.walls, x, y, r);
    if (n) return { kind: 'wall' as const, id: n.wall.id };
    return null;
  };

  const finishChain = () => setDraft(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const pt = toSvg(e.clientX, e.clientY);
    if (tool === 'select') {
      const h = hit(pt.x, pt.y);
      if (h?.kind === 'handle') {
        const ends: { wallId: string; end: 1 | 2 }[] = [];
        for (const w of planRef.current.walls) {
          if (Math.hypot(w.x1 - h.x, w.y1 - h.y) < 0.5) ends.push({ wallId: w.id, end: 1 });
          if (Math.hypot(w.x2 - h.x, w.y2 - h.y) < 0.5) ends.push({ wallId: w.id, end: 2 });
        }
        pushHistory();
        drag.current = { type: 'handle', ends };
        return;
      }
      if (h?.kind === 'room') {
        pushHistory();
        drag.current = { type: 'room', id: h.id };
        setSel({ kind: 'room', id: h.id });
        return;
      }
      if (h) {
        setSel({ kind: h.kind, id: h.id });
        return;
      }
      setSel(null);
      drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vb: vbRef.current };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = toSvg(e.clientX, e.clientY);
    const d = drag.current;
    if (d?.type === 'pan') {
      const k = d.vb.w / (svgRef.current?.clientWidth || 800);
      setVb({ ...d.vb, x: d.vb.x - (e.clientX - d.sx) * k, y: d.vb.y - (e.clientY - d.sy) * k });
      return;
    }
    if (d?.type === 'handle') {
      const s = snap(pt.x, pt.y, null);
      const ids = new Map<string, number[]>();
      d.ends.forEach((en) => ids.set(en.wallId, [...(ids.get(en.wallId) || []), en.end]));
      onChange({
        ...planRef.current,
        walls: planRef.current.walls.map((w) => {
          const ends = ids.get(w.id);
          if (!ends) return w;
          const nw = { ...w };
          if (ends.includes(1)) { nw.x1 = s.x; nw.y1 = s.y; }
          if (ends.includes(2)) { nw.x2 = s.x; nw.y2 = s.y; }
          return nw;
        }),
      });
      return;
    }
    if (d?.type === 'room') {
      onChange({ ...planRef.current, rooms: planRef.current.rooms.map((r) => (r.id === d.id ? { ...r, x: pt.x, y: pt.y } : r)) });
      return;
    }
    if (tool === 'wall') setCursor(snap(pt.x, pt.y, draft));
    else if (tool === 'scale' && scalePts.length === 1) setCursor(pt);
    else setCursor(pt);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasDragging = drag.current;
    drag.current = null;
    if (wasDragging) return;
    const raw = toSvg(e.clientX, e.clientY);
    const p = planRef.current;

    if (tool === 'wall') {
      const pt = snap(raw.x, raw.y, draft);
      if (!draft) {
        setDraft(pt);
        return;
      }
      if (Math.hypot(pt.x - draft.x, pt.y - draft.y) < 6 * upp) {
        finishChain();
        return;
      }
      mutate((pl) => ({ ...pl, walls: [...pl.walls, { id: uid('w'), x1: draft.x, y1: draft.y, x2: pt.x, y2: pt.y }] }));
      setDraft(pt);
      return;
    }

    if (tool === 'door' || tool === 'window') {
      const n = nearestWall(p.walls, raw.x, raw.y, 18 * upp);
      if (!n) return;
      const o: PlanOpening = { id: uid('o'), wallId: n.wall.id, t: n.t, width: tool === 'door' ? 0.9 : 1.2, type: tool };
      mutate((pl) => ({ ...pl, openings: [...pl.openings, o] }));
      setSel({ kind: 'opening', id: o.id });
      return;
    }

    if (tool === 'room') {
      setAsk({ kind: 'room', x: raw.x, y: raw.y });
      setAskValue('');
      setAskError('');
      return;
    }

    if (tool === 'scale') {
      const pt = snap(raw.x, raw.y, null);
      if (scalePts.length === 0) {
        setScalePts([pt]);
      } else {
        const a = scalePts[0];
        if (Math.hypot(pt.x - a.x, pt.y - a.y) < 10 * upp) return;
        setScalePts([a, pt]);
        setAsk({ kind: 'scale', x: pt.x, y: pt.y });
        setAskValue('');
        setAskError('');
      }
      return;
    }

    if (tool === 'erase') {
      const h = hit(raw.x, raw.y);
      if (!h || h.kind === 'handle') {
        if (h?.kind === 'handle') {
          const w = nearestWall(p.walls, h.x, h.y, 2);
          if (w) deleteSel({ kind: 'wall', id: w.wall.id });
        }
        return;
      }
      deleteSel({ kind: h.kind, id: h.id });
    }
  };

  const deleteSel = (s: Sel) => {
    if (!s) return;
    mutate((pl) => {
      if (s.kind === 'wall') return { ...pl, walls: pl.walls.filter((w) => w.id !== s.id), openings: pl.openings.filter((o) => o.wallId !== s.id) };
      if (s.kind === 'opening') return { ...pl, openings: pl.openings.filter((o) => o.id !== s.id) };
      return { ...pl, rooms: pl.rooms.filter((r) => r.id !== s.id) };
    });
    setSel(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        finishChain();
        setScalePts([]);
        setAsk(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        deleteSel(sel);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, undo]);

  const submitAsk = () => {
    if (!ask) return;
    if (ask.kind === 'room') {
      const label = askValue.trim().slice(0, 40);
      if (!label) { setAskError('Type a room name.'); return; }
      mutate((pl) => ({ ...pl, rooms: [...pl.rooms, { id: uid('r'), label, x: ask.x, y: ask.y }] }));
      setAsk(null);
      return;
    }
    const m = parseLength(askValue);
    if (!m) { setAskError('Enter a length like 3.6 m or 12 ft.'); return; }
    const [a, b] = scalePts;
    const px = Math.hypot(b.x - a.x, b.y - a.y);
    mutate((pl) => ({ ...pl, pxPerMeter: px / m, scaleConfirmed: true }));
    setScalePts([]);
    setAsk(null);
  };

  const fit = () => setVb({ x: 0, y: 0, w: plan.imageW, h: plan.imageH });
  const zoom = (f: number) =>
    setVb((v) => {
      const nw = Math.max(80, Math.min(plan.imageW * 3, v.w * f));
      const k = nw / v.w;
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return { x: cx - (nw / 2), y: cy - (v.h * k) / 2, w: nw, h: v.h * k };
    });

  const selectedWall = sel?.kind === 'wall' ? plan.walls.find((w) => w.id === sel.id) : null;
  const selectedOpening = sel?.kind === 'opening' ? plan.openings.find((o) => o.id === sel.id) : null;
  const selectedRoom = sel?.kind === 'room' ? plan.rooms.find((r) => r.id === sel.id) : null;
  const hint = TOOLS.find((t) => t.id === tool)?.hint;
  const sw = 3 * upp;
  const cursorStyle = tool === 'select' ? 'default' : tool === 'erase' ? 'not-allowed' : 'crosshair';

  const openingPos = (o: PlanOpening, w: PlanWall) => {
    const ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
    const half = (o.width * plan.pxPerMeter) / 2;
    const cx = w.x1 + (w.x2 - w.x1) * o.t;
    const cy = w.y1 + (w.y2 - w.y1) * o.t;
    return { x1: cx - Math.cos(ang) * half, y1: cy - Math.sin(ang) * half, x2: cx + Math.cos(ang) * half, y2: cy + Math.sin(ang) * half, cx, cy };
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTool(t.id); finishChain(); setScalePts([]); setAsk(null); }}
            className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${tool === t.id ? 'bg-brand-600 text-white shadow' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50'}`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={undo} disabled={!histLen} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 ring-1 ring-stone-200 disabled:opacity-40">Undo</button>
          <button onClick={() => zoom(1 / 1.3)} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 ring-1 ring-stone-200" aria-label="Zoom in">+</button>
          <button onClick={() => zoom(1.3)} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 ring-1 ring-stone-200" aria-label="Zoom out">−</button>
          <button onClick={fit} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 ring-1 ring-stone-200">Fit</button>
        </div>
      </div>

      {onAiDetect && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <button
            onClick={onAiDetect}
            disabled={aiBusy}
            className="rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {aiBusy ? 'Reading the plan…' : plan.walls.length ? 'Re-run AI draft (replaces walls)' : 'Auto-draft walls with AI'}
          </button>
          <p className="text-[11px] font-semibold leading-snug text-amber-800">
            The AI makes a rough draft only. Always check walls, doors and the scale before you publish.
          </p>
          {aiMessage && <p className="w-full text-xs font-semibold text-stone-700">{aiMessage}</p>}
        </div>
      )}

      <p className="text-xs font-semibold text-stone-500">{hint}</p>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100" style={{ aspectRatio: `${plan.imageW} / ${plan.imageH}`, maxHeight: '70vh', width: '100%' }}>
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="absolute inset-0 h-full w-full select-none"
          style={{ touchAction: 'none', cursor: cursorStyle }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setCursor(null)}
          onDoubleClick={finishChain}
        >
          <defs>
            <pattern id="studio-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d6d0c2" strokeWidth={1 * upp} />
            </pattern>
          </defs>
          <rect x={0} y={0} width={plan.imageW} height={plan.imageH} fill="#fff" />
          {imageSrc ? (
            <image href={imageSrc} x={0} y={0} width={plan.imageW} height={plan.imageH} opacity={0.6} preserveAspectRatio="none" />
          ) : (
            <rect x={0} y={0} width={plan.imageW} height={plan.imageH} fill="url(#studio-grid)" />
          )}

          {/* walls */}
          {plan.walls.map((w) => (
            <line
              key={w.id}
              x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
              stroke={sel?.kind === 'wall' && sel.id === w.id ? '#C9A15A' : '#AF1D2E'}
              strokeWidth={sel?.kind === 'wall' && sel.id === w.id ? sw * 1.8 : sw * 1.4}
              strokeLinecap="round"
            />
          ))}
          {/* openings */}
          {plan.openings.map((o) => {
            const w = plan.walls.find((q) => q.id === o.wallId);
            if (!w) return null;
            const p = openingPos(o, w);
            const selected = sel?.kind === 'opening' && sel.id === o.id;
            return (
              <line
                key={o.id}
                x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
                stroke={o.type === 'door' ? '#B7791F' : '#2B7DB8'}
                strokeWidth={sw * (selected ? 3.4 : 2.6)}
                strokeLinecap="butt"
                opacity={0.95}
              />
            );
          })}
          {/* rooms */}
          {plan.rooms.map((r) => {
            const selected = sel?.kind === 'room' && sel.id === r.id;
            return (
              <g key={r.id}>
                <circle cx={r.x} cy={r.y} r={5 * upp} fill={selected ? '#C9A15A' : '#1A1714'} />
                <text x={r.x + 9 * upp} y={r.y + 4 * upp} fontSize={13 * upp} fontWeight={700} fill="#1A1714" stroke="#fff" strokeWidth={3 * upp} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                  {r.label}
                </text>
              </g>
            );
          })}
          {/* handles in select mode */}
          {tool === 'select' &&
            plan.walls.flatMap((w) => [
              <circle key={`${w.id}a`} cx={w.x1} cy={w.y1} r={5 * upp} fill="#fff" stroke="#AF1D2E" strokeWidth={2 * upp} />,
              <circle key={`${w.id}b`} cx={w.x2} cy={w.y2} r={5 * upp} fill="#fff" stroke="#AF1D2E" strokeWidth={2 * upp} />,
            ])}
          {/* selected wall length */}
          {selectedWall && (
            <text x={(selectedWall.x1 + selectedWall.x2) / 2} y={(selectedWall.y1 + selectedWall.y2) / 2 - 8 * upp} fontSize={13 * upp} fontWeight={700} textAnchor="middle" fill="#69111B" stroke="#fff" strokeWidth={3 * upp} paintOrder="stroke">
              {(wallLength(selectedWall) / plan.pxPerMeter).toFixed(2)} m
            </text>
          )}
          {/* wall preview */}
          {tool === 'wall' && draft && cursor && (
            <>
              <line x1={draft.x} y1={draft.y} x2={cursor.x} y2={cursor.y} stroke="#AF1D2E" strokeWidth={sw * 1.4} strokeDasharray={`${8 * upp} ${6 * upp}`} />
              <text x={(draft.x + cursor.x) / 2} y={(draft.y + cursor.y) / 2 - 8 * upp} fontSize={12 * upp} fontWeight={700} textAnchor="middle" fill="#69111B" stroke="#fff" strokeWidth={3 * upp} paintOrder="stroke">
                {(Math.hypot(cursor.x - draft.x, cursor.y - draft.y) / plan.pxPerMeter).toFixed(2)} m
              </text>
            </>
          )}
          {tool === 'wall' && cursor && <circle cx={cursor.x} cy={cursor.y} r={4 * upp} fill="#AF1D2E" opacity={0.6} />}
          {draft && <circle cx={draft.x} cy={draft.y} r={5 * upp} fill="#AF1D2E" />}
          {/* scale tool */}
          {scalePts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={6 * upp} fill="#2B7DB8" stroke="#fff" strokeWidth={2 * upp} />
          ))}
          {scalePts.length === 2 && <line x1={scalePts[0].x} y1={scalePts[0].y} x2={scalePts[1].x} y2={scalePts[1].y} stroke="#2B7DB8" strokeWidth={sw * 1.4} />}
          {scalePts.length === 1 && cursor && tool === 'scale' && (
            <line x1={scalePts[0].x} y1={scalePts[0].y} x2={cursor.x} y2={cursor.y} stroke="#2B7DB8" strokeWidth={sw} strokeDasharray={`${8 * upp} ${6 * upp}`} />
          )}
        </svg>

        {ask && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
            <p className="mb-2 text-xs font-bold text-stone-800">
              {ask.kind === 'room' ? 'Room name' : 'Real length of the line you drew'}
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={askValue}
                onChange={(e) => { setAskValue(e.target.value); setAskError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && submitAsk()}
                placeholder={ask.kind === 'room' ? 'e.g. Master Bedroom' : 'e.g. 3.6 m or 12 ft'}
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button onClick={submitAsk} className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">Save</button>
              <button onClick={() => { setAsk(null); setScalePts([]); }} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600">Cancel</button>
            </div>
            {askError && <p className="mt-1.5 text-xs font-semibold text-brand-700">{askError}</p>}
          </div>
        )}
      </div>

      {/* Selection panel + facts */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-stone-600">
        <span>{plan.walls.length} walls · {plan.openings.filter((o) => o.type === 'door').length} doors · {plan.openings.filter((o) => o.type === 'window').length} windows</span>
        <span className={plan.scaleConfirmed ? 'text-emerald-700' : 'text-amber-700'}>
          {plan.scaleConfirmed ? 'Scale set' : 'Scale not set yet (sizes are a guess). Use "Set scale".'}
        </span>
        {plan.walls.length > 0 && <span>Footprint about {footprintSqft(plan).toLocaleString('en-IN')} sq ft</span>}
      </div>

      {(selectedWall || selectedOpening || selectedRoom) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
          {selectedOpening && (
            <>
              <span className="text-xs font-bold text-stone-800 capitalize">{selectedOpening.type}</span>
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                Width (m)
                <input
                  type="number" step="0.05" min="0.5" max="3"
                  value={selectedOpening.width}
                  onChange={(e) => {
                    const v = Math.max(0.5, Math.min(3, parseFloat(e.target.value) || 0.9));
                    onChange({ ...plan, openings: plan.openings.map((o) => (o.id === selectedOpening.id ? { ...o, width: v } : o)) });
                  }}
                  className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm"
                />
              </label>
            </>
          )}
          {selectedRoom && (
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
              Name
              <input
                value={selectedRoom.label}
                maxLength={40}
                onChange={(e) => onChange({ ...plan, rooms: plan.rooms.map((r) => (r.id === selectedRoom.id ? { ...r, label: e.target.value } : r)) })}
                className="w-44 rounded-lg border border-stone-200 px-2 py-1 text-sm"
              />
            </label>
          )}
          {selectedWall && <span className="text-xs font-bold text-stone-800">Wall · {(wallLength(selectedWall) / plan.pxPerMeter).toFixed(2)} m</span>}
          <button onClick={() => deleteSel(sel)} className="ml-auto rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100">Delete</button>
        </div>
      )}
    </div>
  );
}
