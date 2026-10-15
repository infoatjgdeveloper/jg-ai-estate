import * as React from 'react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import QRCode from 'qrcode';
import { DEMO_ID, DEMO_PROJECT } from './demo';
import { getBuilder, getProject, submitLead } from './studioApi';
import type { BuilderProfile, FloorPlan, StudioProject } from './types';
import { footprintSqft, inr } from './geometry';
import { btnGold, input, label, Logo, Reveal, VideoList } from '../ui/kit';
import BuildingViewer from './BuildingViewer';
const UnitViewer = lazy(() => import('./UnitViewer'));
const StudioMap = lazy(() => import('./StudioMap'));

const onFloor = (p: FloorPlan, f: number) => (!p.floorFrom && !p.floorTo) || (f >= (p.floorFrom || 1) && f <= (p.floorTo || 999));

export default function TourPage() {
  const { id = '' } = useParams();
  const [project, setProject] = useState<StudioProject | null | undefined>(undefined);
  const [builder, setBuilder] = useState<BuilderProfile | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const p = id === DEMO_ID ? DEMO_PROJECT : await getProject(id);
        if (!live) return;
        setProject(p && (p.published || id === DEMO_ID) ? p : null);
        if (p && p.id !== DEMO_ID) getBuilder(p.ownerId).then((b) => live && setBuilder(b && b.published ? b : null)).catch(() => {});
      } catch { if (live) setProject(null); }
    })();
    return () => { live = false; };
  }, [id]);

  const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
  useEffect(() => { if (showQr && !qr) QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setQr).catch(() => {}); }, [showQr, qr, url]);

  const floors = useMemo(() => {
    if (!project) return 12;
    const fromPlans = Math.max(0, ...project.plans.map((p) => p.floorTo || 0));
    return project.building?.floors || fromPlans || 12;
  }, [project]);

  if (project === undefined) return <div className="grid min-h-screen place-items-center bg-night text-sm font-bold text-white/70">Loading tour…</div>;
  if (!project) return (
    <div className="grid min-h-screen place-items-center bg-night p-6 text-center text-white">
      <div><Logo /><h1 className="mt-8 font-serif text-3xl">This tour isn’t available</h1><p className="mt-2 text-white/60">The link may be wrong, or the builder hasn’t published it yet.</p><Link to="/" className={`${btnGold} mt-6`}>Explore JGEstate</Link></div>
    </div>
  );

  const plans = project.plans;
  const active = plans.find((p) => p.id === planId) || null;
  const here = floor ? plans.filter((p) => onFloor(p, floor)) : [];
  const waText = encodeURIComponent(`${project.name} — walk through it in 3D: ${url}`);
  const share = async () => { try { if (navigator.share) { await navigator.share({ title: project.name, url }); return; } await navigator.clipboard.writeText(url); alert('Link copied'); } catch { /* cancelled */ } };

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* stage */}
      <section className="relative h-[82vh] min-h-[540px] bg-night">
        {!active ? (
          <BuildingViewer className="absolute inset-0" floors={floors} towers={project.building?.towers} selected={floor} onSelect={(f) => setFloor(f)} />
        ) : (
          <Suspense fallback={<div className="grid h-full place-items-center text-sm font-bold text-white/70">Loading 3D…</div>}>
            <UnitViewer key={active.id} className="absolute inset-0" plan={active} onExit={() => setPlanId(null)} initialMode="dollhouse" topPad="pt-16" title={`${active.name}${floor ? ` · Floor ${floor}` : ''}`} />
          </Suspense>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-night/80 to-transparent p-4">
          <div className="pointer-events-auto"><Logo /></div>
          <div className="pointer-events-auto ml-auto flex gap-2">
            <button onClick={share} className="rounded-full bg-white/12 px-4 py-2 text-xs font-extrabold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20">Share</button>
            <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer" className="hidden rounded-full bg-white/12 px-4 py-2 text-xs font-extrabold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 sm:inline">WhatsApp</a>
            <button onClick={() => setShowQr(true)} className="rounded-full bg-white/12 px-4 py-2 text-xs font-extrabold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20">QR</button>
          </div>
        </div>

        {!active && (
          <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} className="absolute bottom-4 left-4 right-4 z-10 max-w-md rounded-3xl bg-night/80 p-5 text-white ring-1 ring-white/15 backdrop-blur-xl sm:bottom-6 sm:left-6 sm:right-auto">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-gold-300">{project.developerName || 'Project'} · {project.city || ''}</p>
            <h1 className="mt-1 font-serif text-3xl leading-tight">{project.name}</h1>
            {plans.length === 0 ? (
              <p className="mt-3 text-sm text-white/65">The builder hasn’t added floor plans yet.</p>
            ) : !floor ? (
              <p className="mt-3 text-sm text-white/75">👆 Tap any floor on the tower to see the homes available there.</p>
            ) : (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-gold-300">Floor {floor}</p>
                  <div className="flex gap-1.5">
                    <button aria-label="Floor down" onClick={() => setFloor(Math.max(1, floor - 1))} className="h-8 w-8 rounded-full bg-white/10 text-lg font-bold hover:bg-white/20">−</button>
                    <button aria-label="Floor up" onClick={() => setFloor(Math.min(floors, floor + 1))} className="h-8 w-8 rounded-full bg-white/10 text-lg font-bold hover:bg-white/20">+</button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {here.length === 0 && <p className="text-sm text-white/60">No homes listed on this floor. Try another one.</p>}
                  {here.map((p) => (
                    <button key={p.id} onClick={() => setPlanId(p.id)} className="group flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left ring-1 ring-white/10 transition hover:bg-gold-400 hover:text-night">
                      <span><span className="block text-sm font-extrabold">{p.name}</span><span className="block text-xs opacity-70">{p.areaSqft ? `${inr(p.areaSqft)} sq.ft` : `≈ ${inr(Math.round(footprintSqft(p) || 0))} sq.ft`} · {p.rooms.length} rooms</span></span>
                      <span className="text-xs font-extrabold">Walk inside →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </section>

      {/* details */}
      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
        <Reveal>
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="font-serif text-3xl text-brand-900">About {project.name}</h2>
              {project.description && <p className="mt-3 leading-relaxed text-stone-600">{project.description}</p>}
              <p className="mt-3 text-sm font-semibold text-stone-500">📍 {[project.address, project.city].filter(Boolean).join(', ')}</p>
              {project.reraId && <p className="mt-1 text-sm font-semibold text-stone-500">RERA: {project.reraId} <span className="text-stone-400">(as given by the builder)</span></p>}
              {!!project.highlights?.length && <div className="mt-4 flex flex-wrap gap-2">{project.highlights.map((h) => <span key={h} className="rounded-full bg-gold-300/30 px-3 py-1 text-xs font-bold text-brand-800">{h}</span>)}</div>}
            </div>
            {!!project.amenities.length && (
              <div className="rounded-3xl bg-white p-5 ring-1 ring-stone-200">
                <p className={label}>Amenities</p>
                <div className="flex flex-wrap gap-2">{project.amenities.map((a) => <span key={a} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{a}</span>)}</div>
              </div>
            )}
          </div>
        </Reveal>

        {!!plans.length && (
          <Reveal>
            <h2 className="font-serif text-2xl text-brand-900">Home types</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <button key={p.id} onClick={() => { setPlanId(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-3xl bg-white p-5 text-left ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <p className="font-serif text-xl text-brand-900">{p.name}</p>
                  <p className="mt-1 text-sm text-stone-500">{p.areaSqft ? `${inr(p.areaSqft)} sq.ft` : ''}{p.floorFrom ? ` · Floors ${p.floorFrom}–${p.floorTo || floors}` : ''}</p>
                  <p className="mt-3 text-xs font-extrabold text-brand-600">Take the 3D walkthrough →</p>
                </button>
              ))}
            </div>
          </Reveal>
        )}

        {!!project.videos?.length && <Reveal><h2 className="mb-4 font-serif text-2xl text-brand-900">Videos</h2><VideoList videos={project.videos} /></Reveal>}

        {project.lat && project.lng && (
          <Reveal>
            <h2 className="mb-4 font-serif text-2xl text-brand-900">Location &amp; nearby</h2>
            <Suspense fallback={<div className="h-80 rounded-3xl bg-stone-200" />}><StudioMap lat={project.lat} lng={project.lng} name={project.name} className="overflow-hidden rounded-3xl ring-1 ring-stone-200" /></Suspense>
          </Reveal>
        )}

        <Reveal>
          <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
            <div className="rounded-3xl bg-night p-6 text-white">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-gold-300">Builder</p>
              <h3 className="mt-1 font-serif text-2xl">{builder?.name || project.developerName || 'Builder'}</h3>
              {builder?.tagline && <p className="mt-1 text-sm text-white/65">{builder.tagline}</p>}
              {builder && <Link to={`/builders/${builder.id}`} className="mt-4 inline-block text-sm font-extrabold text-gold-300 hover:underline">View builder profile →</Link>}
              <p className="mt-6 text-xs leading-relaxed text-white/50">3D views are an approximate visualisation made from the builder’s brochure. Furniture is illustrative. Please verify sizes and details with the builder before deciding.</p>
            </div>
            <EnquiryForm project={project} planName={active?.name} />
          </div>
        </Reveal>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-night/90 p-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <p className="hidden text-sm font-bold text-white/80 sm:block">Like what you see? Talk to the builder.</p>
          <a href="#enquire" onClick={(e) => { e.preventDefault(); document.getElementById('enquire')?.scrollIntoView({ behavior: 'smooth' }); }} className={`${btnGold} ml-auto w-full sm:w-auto`}>Enquire now</a>
        </div>
      </div>

      <AnimatePresence>
        {showQr && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setShowQr(false)}>
            <div className="rounded-3xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
              {qr ? <img src={qr} alt="QR code for this tour" className="mx-auto h-56 w-56" /> : <div className="h-56 w-56" />}
              <p className="mt-3 text-sm font-bold text-brand-900">Scan to open this 3D tour</p>
              <button onClick={() => setShowQr(false)} className="mt-3 text-xs font-bold text-stone-500">Close</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EnquiryForm({ project, planName }: { project: StudioProject; planName?: string }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', visit: '', message: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim().length > 1 && f.phone.replace(/\D/g, '').length >= 8;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setState('busy');
    try {
      await submitLead(project, { name: f.name, phone: f.phone, email: f.email, planName, message: [f.visit ? `Preferred site visit: ${f.visit}` : '', f.message].filter(Boolean).join('\n') });
      setState('done');
    } catch { setState('error'); }
  };
  return (
    <form id="enquire" onSubmit={send} className="rounded-3xl bg-white p-6 ring-1 ring-stone-200">
      <h3 className="font-serif text-2xl text-brand-900">Enquire about this project</h3>
      <p className="mt-1 text-xs font-semibold text-stone-500">Your details go to the builder, tagged as an enquiry from JGEstate.</p>
      {state === 'done' ? (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-800">✓ Sent! The builder will contact you soon.</div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div><label className={label}>Your name</label><input className={input} value={f.name} onChange={set('name')} autoComplete="name" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Phone</label><input className={input} value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></div>
            <div><label className={label}>Email (optional)</label><input className={input} value={f.email} onChange={set('email')} type="email" autoComplete="email" /></div>
          </div>
          <div><label className={label}>Preferred site-visit date (optional)</label><input className={input} type="date" value={f.visit} onChange={set('visit')} /></div>
          <div><label className={label}>Message (optional)</label><textarea className={input} rows={2} value={f.message} onChange={set('message')} placeholder={planName ? `Interested in ${planName}` : ''} /></div>
          {state === 'error' && <p className="text-xs font-bold text-red-600">Couldn’t send. Please try again.</p>}
          <button disabled={!ok || state === 'busy'} className={`${btnGold} disabled:opacity-50`}>{state === 'busy' ? 'Sending…' : 'Send enquiry'}</button>
          {project.id === DEMO_ID && <p className="text-[11px] font-semibold text-stone-400">This is a sample project — nothing is stored.</p>}
        </div>
      )}
    </form>
  );
}
