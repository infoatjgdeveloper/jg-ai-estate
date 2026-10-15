import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CATEGORY_LABEL, fetchNearby, formatMeters, walkMinutes, type NearbyPlace, type PlaceCategory } from './studioApi';

const COLORS: Record<PlaceCategory, string> = {
  school: '#2B7DB8',
  health: '#C0392B',
  shopping: '#B7791F',
  transit: '#6B46C1',
  food: '#DD6B20',
  park: '#2F855A',
  bank: '#4A5568',
};

interface Props {
  lat: number;
  lng: number;
  name: string;
  className?: string;
}

export default function StudioMap({ lat, lng, name, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [active, setActive] = useState<PlaceCategory | 'all'>('all');

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap, © CARTO', maxZoom: 19 }).addTo(map);
    const pin = L.divIcon({
      className: '',
      html: `<div style="transform:translate(-50%,-100%);background:#1F3A7A;color:#fff;padding:6px 12px;border-radius:999px;font:700 12px Manrope,system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 16px rgba(31,58,122,.4)">${escapeHtml(name).slice(0, 40)}</div>`,
      iconSize: [0, 0],
    });
    L.marker([lat, lng], { icon: pin, zIndexOffset: 1000 }).addTo(map);
    L.circle([lat, lng], { radius: 1000, color: '#1F3A7A', weight: 1, fillOpacity: 0.04, dashArray: '4 6' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchNearby(lat, lng)
      .then((p) => { if (!cancelled) { setPlaces(p); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [lat, lng]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    places
      .filter((p) => active === 'all' || p.category === active)
      .forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: COLORS[p.category], fillOpacity: 1 })
          .bindTooltip(`${escapeHtml(p.name)} · ${formatMeters(p.meters)}`)
          .addTo(layer);
      });
  }, [places, active]);

  const cats = (Object.keys(CATEGORY_LABEL) as PlaceCategory[]).filter((c) => places.some((p) => p.category === c));
  const shown = places.filter((p) => active === 'all' || p.category === active);

  return (
    <div className={className}>
      <div ref={ref} className="h-72 w-full overflow-hidden rounded-2xl border border-stone-200 sm:h-96" />
      <div className="mt-4 flex flex-wrap gap-1.5">
        <button onClick={() => setActive('all')} className={chip(active === 'all')}>All</button>
        {cats.map((c) => (
          <button key={c} onClick={() => setActive(c)} className={chip(active === c)}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[c] }} />
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {status === 'loading' && <p className="mt-3 text-xs font-semibold text-stone-500">Loading places nearby…</p>}
      {status === 'error' && <p className="mt-3 text-xs font-semibold text-stone-500">Nearby places could not be loaded right now.</p>}
      {status === 'ready' && !places.length && <p className="mt-3 text-xs font-semibold text-stone-500">No named places found on OpenStreetMap near this location.</p>}
      {status === 'ready' && places.length > 0 && (
        <>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-white px-3.5 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[p.category] }} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-stone-800">{p.name}</span>
                <span className="shrink-0 text-xs font-semibold text-stone-500">{formatMeters(p.meters)} · about {walkMinutes(p.meters)} min walk</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-medium text-stone-400">Live data © OpenStreetMap contributors. Distances are straight-line, so real routes are longer.</p>
        </>
      )}
    </div>
  );
}

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${on ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
