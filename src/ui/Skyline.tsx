import * as React from 'react';
import { useMemo } from 'react';

// Deterministic RNG so the skyline is identical on every render and on the server.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface LayerCfg { seed: number; fill: string; win: string; minH: number; maxH: number; minW: number; maxW: number; speed: number; opacity: number; lit: number; }

function Layer({ cfg, w = 1600, h = 520 }: { cfg: LayerCfg; w?: number; h?: number }) {
  const { shapes, wins } = useMemo(() => {
    const r = rng(cfg.seed);
    const shapes: React.ReactNode[] = [];
    const wins: React.ReactNode[] = [];
    let x = -10;
    let i = 0;
    while (x < w + 10) {
      const bw = cfg.minW + r() * (cfg.maxW - cfg.minW);
      const bh = cfg.minH + r() * (cfg.maxH - cfg.minH);
      const y = h - bh;
      const kind = r();
      shapes.push(<rect key={`b${i}`} x={x} y={y} width={bw} height={bh} fill={cfg.fill} />);
      if (kind > 0.7) shapes.push(<rect key={`t${i}`} x={x + bw * 0.38} y={y - 22} width={bw * 0.24} height={22} fill={cfg.fill} />);
      if (kind > 0.88) shapes.push(<rect key={`a${i}`} x={x + bw * 0.49} y={y - 56} width={2} height={34} fill={cfg.fill} />);
      // lit windows on a loose grid
      const cols = Math.max(2, Math.floor(bw / 9));
      const rows = Math.floor(bh / 12);
      for (let cx = 0; cx < cols; cx++) {
        for (let ry = 1; ry < rows; ry++) {
          if (r() > cfg.lit) continue;
          const tw = r() > 0.82;
          wins.push(
            <rect
              key={`w${i}-${cx}-${ry}`}
              x={x + 4 + cx * ((bw - 8) / cols)}
              y={y + 6 + ry * 12}
              width={4}
              height={6}
              fill={cfg.win}
              style={tw ? { animation: `twinkle ${3 + r() * 5}s ease-in-out ${r() * 6}s infinite` } : { opacity: 0.55 + r() * 0.4 }}
            />,
          );
        }
      }
      x += bw + 1 + r() * 4;
      i++;
    }
    return { shapes, wins };
  }, [cfg, w, h]);

  const one = (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMinYMax slice" className="h-full w-1/2 shrink-0" aria-hidden>
      {shapes}
      {wins}
    </svg>
  );
  return (
    <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden" style={{ opacity: cfg.opacity }}>
      <div className="flex h-full w-[200%]" style={{ animation: `drift ${cfg.speed}s linear infinite` }}>
        {one}
        {one}
      </div>
    </div>
  );
}

const LAYERS: LayerCfg[] = [
  { seed: 11, fill: '#141C3F', win: '#8FA4DB', minH: 120, maxH: 280, minW: 26, maxW: 52, speed: 260, opacity: 0.9, lit: 0.1 },
  { seed: 23, fill: '#0F1632', win: '#F6D58B', minH: 160, maxH: 380, minW: 30, maxW: 64, speed: 190, opacity: 1, lit: 0.16 },
  { seed: 37, fill: '#080D21', win: '#F6D58B', minH: 200, maxH: 470, minW: 36, maxW: 78, speed: 130, opacity: 1, lit: 0.22 },
];

/** Full-bleed animated night skyline: dusk gradient, twinkling stars, glowing moon, three drifting building layers. */
export default function Skyline({ className = '' }: { className?: string }) {
  const stars = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 70 }, (_, i) => ({ i, x: r() * 100, y: r() * 55, s: 1 + r() * 1.6, d: 2 + r() * 5, o: r() * 6 }));
  }, []);
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#050816 0%,#0B1228 38%,#1B2450 68%,#3B3566 84%,#C77B5A 100%)' }} />
      {stars.map((s) => (
        <span key={s.i} className="absolute rounded-full bg-white" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animation: `twinkle ${s.d}s ease-in-out ${s.o}s infinite` }} />
      ))}
      <div className="absolute right-[12%] top-[14%] h-24 w-24 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #fff8e1, #F6D58B 60%, rgba(246,213,139,0) 72%)', boxShadow: '0 0 90px 30px rgba(246,213,139,.22)', animation: 'floaty 9s ease-in-out infinite' }} />
      <div className="absolute inset-x-0 bottom-0 h-[62%] sm:h-[70%]">
        {LAYERS.map((l) => <Layer key={l.seed} cfg={l} />)}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050816] to-transparent" />
    </div>
  );
}
