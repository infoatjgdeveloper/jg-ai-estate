import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string; // formatted price, shown on the pin
}

interface MapViewProps {
  pins: MapPin[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

// Custom price-pill marker (matches the "€850K" style pins used by ImmoScout24/Zillow)
function priceIcon(label: string, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${active ? '#1E5FE0' : '#ffffff'};
      color:${active ? '#ffffff' : '#0F172A'};
      border:1.5px solid ${active ? '#1E5FE0' : '#E2E8F0'};
      padding:6px 12px;
      border-radius:999px;
      font-weight:700;
      font-family:'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
      font-size:11px;
      white-space:nowrap;
      box-shadow:${active ? '0 6px 16px rgba(30,95,224,.35)' : '0 2px 8px rgba(15,23,42,.15)'};
      transform:translate(-50%,-100%);
      cursor:pointer;
    ">${label}</div>`,
    iconSize: [0, 0],
  });
}

export default function MapView({ pins, activeId, onSelect, onHover }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([30, 10], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers with pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove stale markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!pins.find((p) => p.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    pins.forEach((pin) => {
      const isActive = pin.id === activeId;
      if (markersRef.current[pin.id]) {
        markersRef.current[pin.id].setIcon(priceIcon(pin.label, isActive));
        markersRef.current[pin.id].setZIndexOffset(isActive ? 1000 : 0);
      } else {
        const marker = L.marker([pin.lat, pin.lng], { icon: priceIcon(pin.label, isActive) })
          .addTo(map)
          .on('click', () => onSelect(pin.id))
          .on('mouseover', () => onHover?.(pin.id))
          .on('mouseout', () => onHover?.(null));
        markersRef.current[pin.id] = marker;
      }
    });

    if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, activeId]);

  return <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />;
}
