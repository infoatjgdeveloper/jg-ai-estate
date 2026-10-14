import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../AuthContext';
import PlanEditor from './PlanEditor';
import Plan3DViewer from './Plan3DViewer';
import StudioMap from './StudioMap';
import { applyPlanParse, emptyPlan, footprintSqft, uid } from './geometry';
import { filesToPages, shrinkDataUrl, type PageImage } from './files';
import { loadPlanImage, localImages } from './imageStore';
import {
  createProject, deleteProject, geocode, getBuilder, getProject, saveBuilder, leadTime, listMyLeads, listMyProjects,
  parseBrochure, parsePlan, saveProject, setLeadStatus, uploadPlanImage,
} from './studioApi';
import type { BrochureParse, BuilderProfile, FloorPlan, StudioLead, StudioProject } from './types';
import { serverTimestamp } from 'firebase/firestore';

import { btnGhost, btnPrimary, input, label } from './ui';
import { splitLines } from './media';

function Shell({ children, title, back }: { children: React.ReactNode; title?: string; back?: { to: string; label: string } }) {
  const { user, profile } = useAuth();
  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="font-serif text-lg font-bold text-brand-700">JGEstate</Link>
          <span className="text-stone-300">/</span>
          <Link to="/studio" className="text-sm font-extrabold text-stone-900">Builder Studio</Link>
          {title && <span className="hidden truncate text-sm font-semibold text-stone-500 sm:inline">/ {title}</span>}
          <span className="ml-auto truncate text-xs font-semibold text-stone-500">{user ? profile?.displayName || user.email : ''}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {back && <Link to={back.to} className="mb-4 inline-block text-xs font-bold text-stone-500 hover:text-brand-700">← {back.label}</Link>}
        {children}
      </main>
    </div>
  );
}

function SignInGate() {
  const { openAuthModal, loading } = useAuth();
  return (
    <Shell>
      <div className="mx-auto mt-10 max-w-lg rounded-3xl bg-white p-8 text-center ring-1 ring-stone-200">
        <h1 className="font-serif text-3xl font-bold text-stone-900">Builder Studio</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-stone-600">
          Upload a project brochure, get a 3D walkthrough with map and neighborhood, and share one link with your buyers.
        </p>
        <button onClick={() => openAuthModal('signin')} disabled={loading} className={`${btnPrimary} mt-6`}>Sign in to start</button>
        <a href="/tour/demo" className="mt-3 block text-sm font-bold text-brand-700 hover:underline">See a sample 3D tour first →</a>
      </div>
    </Shell>
  );
}

export default function StudioApp() {
  const { user, isAuthReady } = useAuth();
  const [builder, setBuilder] = useState<BuilderProfile | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    if (!user) { setBuilder(undefined); return; }
    getBuilder(user.uid).then(setBuilder).catch((e) => {
      console.error(e);
      setLoadErr('Could not load your builder profile. The Firestore rules may not be deployed yet.');
      setBuilder(null);
    });
  }, [user]);

  if (!isAuthReady) return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm font-semibold text-stone-500">Loading…</div>;
  if (!user) return <SignInGate />;
  if (builder === undefined) return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm font-semibold text-stone-500">Loading…</div>;
  if (builder === null) return <Shell><Onboarding error={loadErr} onSaved={setBuilder} /></Shell>;
  return (
    <Routes>
      <Route index element={<ProjectList builder={builder} onBuilder={setBuilder} />} />
      <Route path="new" element={<NewProject builder={builder} />} />
      <Route path=":id" element={<Workspace />} />
    </Routes>
  );
}

// ------------------------------------------------------------------ Builder profile (onboarding + edit)

const TERMS =
  'I agree that enquiries I receive through JGEstate are referred by JGEstate, and that a referral commission applies to any sale that results from them, as set out in my written agreement with JGEstate.';

function BuilderForm({ initial, onSaved, onboarding }: { initial: BuilderProfile; onSaved: (b: BuilderProfile) => void; onboarding?: boolean }) {
  const [f, setF] = useState(initial);
  const [videos, setVideos] = useState((initial.videos || []).join('\n'));
  const [agree, setAgree] = useState(!onboarding);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k: keyof BuilderProfile, v: any) => { setF((p) => ({ ...p, [k]: v })); setOk(false); };

  const save = async () => {
    if (!f.name.trim()) { setErr('Please enter your company name.'); return; }
    if (!agree) { setErr('Please accept the referral terms to continue.'); return; }
    setBusy(true); setErr('');
    const next: BuilderProfile = {
      ...f, name: f.name.trim(), published: true,
      videos: splitLines(videos).slice(0, 8),
      agreedTermsAt: f.agreedTermsAt ?? serverTimestamp(),
    };
    try {
      await saveBuilder(next);
      onSaved(next); setOk(true);
    } catch (e) {
      console.error(e);
      setErr('Could not save. If this keeps happening, the Firestore rules may not be deployed yet.');
    }
    setBusy(false);
  };

  const num = (v: string) => { const n = parseInt(v, 10); return isFinite(n) ? n : undefined; };
  return (
    <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><span className={label}>Company name *</span><input className={input} value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} /></div>
        <div className="sm:col-span-2"><span className={label}>One-line tagline</span><input className={input} value={f.tagline || ''} onChange={(e) => set('tagline', e.target.value)} maxLength={140} placeholder="e.g. Quality homes in West Ahmedabad since 1998" /></div>
        <div><span className={label}>City</span><input className={input} value={f.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
        <div><span className={label}>Country</span><input className={input} value={f.country || ''} onChange={(e) => set('country', e.target.value)} /></div>
        <div><span className={label}>Phone</span><input className={input} value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" /></div>
        <div><span className={label}>Email</span><input className={input} value={f.email || ''} onChange={(e) => set('email', e.target.value)} inputMode="email" /></div>
        <div><span className={label}>Website</span><input className={input} value={f.website || ''} onChange={(e) => set('website', e.target.value)} /></div>
        <div><span className={label}>Years in business</span><input className={input} value={f.yearsInBusiness ?? ''} onChange={(e) => set('yearsInBusiness', num(e.target.value))} inputMode="numeric" /></div>
        <div><span className={label}>RERA / registration ID (optional)</span><input className={input} value={f.reraId || ''} onChange={(e) => set('reraId', e.target.value)} /></div>
        <div><span className={label}>Logo image link (optional)</span><input className={input} value={f.logoUrl || ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" /></div>
        <div className="sm:col-span-2"><span className={label}>About your company</span><textarea className={`${input} min-h-[110px]`} value={f.about || ''} onChange={(e) => set('about', e.target.value)} maxLength={2000} /></div>
        <div className="sm:col-span-2"><span className={label}>Company videos (one link per line: YouTube, Vimeo or .mp4)</span><textarea className={`${input} min-h-[80px]`} value={videos} onChange={(e) => { setVideos(e.target.value); setOk(false); }} placeholder="https://www.youtube.com/watch?v=…" /></div>
      </div>
      {onboarding && (
        <label className="flex gap-3 rounded-xl bg-stone-50 p-3.5 text-xs font-medium leading-relaxed text-stone-600">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
          <span>{TERMS}</span>
        </label>
      )}
      {err && <p className="text-xs font-bold text-brand-700">{err}</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : onboarding ? 'Create my profile' : 'Save profile'}</button>
        {ok && <span className="text-xs font-bold text-emerald-700">Saved</span>}
        {!onboarding && <Link to={`/builders/${f.id}`} className="ml-auto text-xs font-bold text-stone-500 underline">View public profile</Link>}
      </div>
    </div>
  );
}

function Onboarding({ onSaved, error }: { onSaved: (b: BuilderProfile) => void; error?: string }) {
  const { user, profile } = useAuth();
  if (!user) return null;
  const initial: BuilderProfile = {
    id: user.uid, ownerId: user.uid, name: '', email: user.email || '', published: true,
  };
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl font-bold text-stone-900">Set up your builder profile</h1>
      <p className="mb-5 mt-2 text-sm font-medium text-stone-600">Hi {profile?.displayName || 'there'}, tell buyers who you are. This becomes your public page on JGEstate, where your projects, videos and 3D tours live.</p>
      {error && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{error}</p>}
      <BuilderForm initial={initial} onSaved={onSaved} onboarding />
    </div>
  );
}

// ------------------------------------------------------------------ Project list + leads

function ProjectList({ builder, onBuilder }: { builder: BuilderProfile; onBuilder: (b: BuilderProfile) => void }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<StudioProject[] | null>(null);
  const [leads, setLeads] = useState<StudioLead[]>([]);
  const [tab, setTab] = useState<'projects' | 'leads' | 'profile'>('projects');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, l] = await Promise.all([listMyProjects(user.uid), listMyLeads(user.uid)]);
      setProjects(p);
      setLeads(l);
    } catch (e) {
      console.error(e);
      setError('Could not load your projects. If this keeps happening, the Firestore rules for Studio may not be deployed yet.');
      setProjects([]);
    }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const remove = async (p: StudioProject) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await deleteProject(p.id);
    load();
  };

  const newLeads = leads.filter((l) => l.status === 'new' || !l.status).length;

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-bold text-stone-900">{builder.name}</h1>
        <Link to="/studio/new" className={`${btnPrimary} ml-auto`}>New project from brochure</Link>
      </div>
      <div className="mb-5 flex gap-1 border-b border-stone-200">
        {(['projects', 'leads', 'profile'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-4 py-2.5 text-sm font-bold capitalize ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500'}`}>
            {t}{t === 'leads' && newLeads ? <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">{newLeads}</span> : null}
          </button>
        ))}
      </div>
      {error && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{error}</p>}

      {tab === 'profile' && <BuilderForm initial={builder} onSaved={onBuilder} />}

      {tab === 'projects' && (
        projects === null ? <p className="text-sm font-semibold text-stone-500">Loading…</p> :
        projects.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-stone-200">
            <p className="font-serif text-xl font-bold text-stone-900">No projects yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium text-stone-500">Upload a brochure PDF (or floor plan images) and we'll set up the project, then you trace the plans into 3D.</p>
            <Link to="/studio/new" className={`${btnPrimary} mt-5 inline-block`}>Upload a brochure</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className="flex flex-col rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                <div className="flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 truncate font-serif text-lg font-bold text-stone-900">{p.name}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${p.published ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>{p.published ? 'Live' : 'Draft'}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-medium text-stone-500">{p.address}</p>
                <p className="mt-3 text-xs font-semibold text-stone-600">{p.plans.length} floor plan{p.plans.length === 1 ? '' : 's'} · {leads.filter((l) => l.projectId === p.id).length} enquiries</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/studio/${p.id}`} className="rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">Open</Link>
                  <Link to={`/tour/${p.id}`} className={btnGhost.replace('px-4 py-2.5 text-sm', 'px-4 py-2 text-xs')}>View tour</Link>
                  <button onClick={() => remove(p)} className="ml-auto text-xs font-bold text-stone-400 hover:text-brand-700">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'leads' && (
        leads.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-stone-500 ring-1 ring-stone-200">No enquiries yet. They show up here when buyers use the form on your tour page.</p> : (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {leads.map((l) => (
              <div key={l.id} className="flex flex-wrap items-start gap-3 border-b border-stone-100 px-4 py-3.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-stone-900">{l.name} <span className="font-semibold text-stone-400">· {l.projectName}{l.planName ? ` · ${l.planName}` : ''}</span></p>
                  <p className="mt-0.5 text-xs font-semibold text-stone-600">
                    <a href={`tel:${l.phone}`} className="underline">{l.phone}</a>{l.email ? <> · <a href={`mailto:${l.email}`} className="underline">{l.email}</a></> : null}
                  </p>
                  {l.message && <p className="mt-1 text-xs font-medium text-stone-500">{l.message}</p>}
                  <p className="mt-1 text-[11px] font-medium text-stone-400">{leadTime(l)}{l.refCode ? ` · Ref ${l.refCode} · via JGEstate` : ' · via JGEstate'}</p>
                </div>
                <select
                  value={l.status || 'new'}
                  onChange={async (e) => { await setLeadStatus(l.id, e.target.value as any); load(); }}
                  className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            ))}
          </div>
        )
      )}
    </Shell>
  );
}

// ------------------------------------------------------------------ New project wizard

interface DetailsForm {
  name: string; developerName: string; address: string; city: string; reraId: string;
  description: string; amenities: string; contactPhone: string; contactEmail: string;
}
const emptyDetails: DetailsForm = { name: '', developerName: '', address: '', city: '', reraId: '', description: '', amenities: '', contactPhone: '', contactEmail: '' };

function DetailsFields({ value, onChange }: { value: DetailsForm; onChange: (v: DetailsForm) => void }) {
  const set = (k: keyof DetailsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><span className={label}>Project name *</span><input className={input} value={value.name} onChange={set('name')} maxLength={120} /></div>
      <div><span className={label}>Developer / builder</span><input className={input} value={value.developerName} onChange={set('developerName')} maxLength={120} /></div>
      <div><span className={label}>RERA / registration ID</span><input className={input} value={value.reraId} onChange={set('reraId')} maxLength={80} placeholder="Only if you have one" /></div>
      <div className="sm:col-span-2"><span className={label}>Address *</span><input className={input} value={value.address} onChange={set('address')} maxLength={240} placeholder="Street, locality, city" /></div>
      <div><span className={label}>City</span><input className={input} value={value.city} onChange={set('city')} maxLength={80} /></div>
      <div><span className={label}>Sales phone</span><input className={input} value={value.contactPhone} onChange={set('contactPhone')} maxLength={30} inputMode="tel" /></div>
      <div className="sm:col-span-2"><span className={label}>Sales email</span><input className={input} value={value.contactEmail} onChange={set('contactEmail')} maxLength={120} type="email" /></div>
      <div className="sm:col-span-2"><span className={label}>Short description</span><textarea className={input} rows={3} value={value.description} onChange={set('description')} maxLength={500} /></div>
      <div className="sm:col-span-2"><span className={label}>Amenities (comma separated)</span><textarea className={input} rows={2} value={value.amenities} onChange={set('amenities')} placeholder="Clubhouse, Swimming pool, Gym, Kids play area" /></div>
    </div>
  );
}

const splitAmenities = (s: string) => s.split(/[,\n]/).map((a) => a.trim()).filter(Boolean).slice(0, 40);

function NewProject({ builder }: { builder: BuilderProfile }) {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PageImage[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [names, setNames] = useState<Record<number, string>>({});
  const [reading, setReading] = useState<string>('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [details, setDetails] = useState<DetailsForm>({ ...emptyDetails, developerName: builder.name, city: builder.city || '', reraId: builder.reraId || '', contactPhone: builder.phone || '', contactEmail: builder.email || '' });
  const [aiUnits, setAiUnits] = useState<BrochureParse['units']>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    setReading('Reading your file…');
    try {
      const out = await filesToPages(Array.from(files), (d, t) => setReading(`Reading page ${d} of ${t}…`));
      if (!out.length) setError('Could not read any pages. Use a PDF, JPG or PNG.');
      setPages(out);
      setPicked(new Set());
    } catch (e) {
      console.error(e);
      setError('That file could not be opened. Try a different PDF or export the plans as images.');
    } finally {
      setReading('');
    }
  };

  const toggle = (i: number) => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const readWithAi = async () => {
    setAiBusy(true);
    setAiNote('');
    try {
      const sample = pages.slice(0, 8);
      const small = await Promise.all(sample.map((p) => shrinkDataUrl(p.dataUrl, 900, 0.65)));
      const r = await parseBrochure(small);
      setDetails((d) => ({
        name: d.name || r.name || '',
        developerName: d.developerName || r.developer || '',
        address: d.address || r.address || '',
        city: d.city || r.city || '',
        reraId: d.reraId || r.reraId || '',
        description: d.description || r.description || '',
        amenities: d.amenities || (r.amenities || []).join(', '),
        contactPhone: d.contactPhone,
        contactEmail: d.contactEmail,
      }));
      setAiUnits(r.units || []);
      if (r.floorPlanPages?.length) {
        setPicked(new Set(r.floorPlanPages.filter((i) => i < pages.length)));
      }
      setAiNote('Filled in what the AI could read. Please check every field. It can make mistakes.');
    } catch (e: any) {
      setAiNote(e?.message || 'AI reading failed. You can fill the details by hand.');
    } finally {
      setAiBusy(false);
    }
  };

  const create = async () => {
    if (!user) return;
    if (!details.name.trim() || !details.address.trim()) { setError('Project name and address are required.'); return; }
    setCreating(true);
    setError('');
    try {
      const chosen = [...picked].sort((a, b) => a - b);
      const plans: FloorPlan[] = chosen.map((pi, n) => {
        const unit = aiUnits?.[n];
        const p = emptyPlan(names[pi]?.trim() || unit?.name || `Unit type ${n + 1}`, pages[pi].width, pages[pi].height);
        if (unit?.bhk) p.bhk = unit.bhk;
        if (unit?.areaSqft) p.areaSqft = unit.areaSqft;
        localImages.set(p.id, pages[pi].dataUrl);
        return p;
      });
      const geo = await geocode([details.address, details.city].filter(Boolean).join(', '));
      const id = await createProject({
        ownerId: user.uid,
        ownerName: profile?.displayName || undefined,
        name: details.name.trim(),
        developerName: details.developerName.trim() || undefined,
        reraId: details.reraId.trim() || undefined,
        address: details.address.trim(),
        city: details.city.trim() || undefined,
        lat: geo?.lat,
        lng: geo?.lng,
        description: details.description.trim() || undefined,
        amenities: splitAmenities(details.amenities),
        contactPhone: details.contactPhone.trim() || undefined,
        contactEmail: details.contactEmail.trim() || undefined,
        plans,
        published: false,
      });
      // Upload tracing images (best effort), then store their URLs.
      if (plans.length) {
        const withUrls = await Promise.all(plans.map(async (p) => ({ ...p, imageUrl: await uploadPlanImage(user.uid, id, p.id, localImages.get(p.id)!) })));
        if (withUrls.some((p) => p.imageUrl)) {
          const fresh = await getProject(id);
          if (fresh) await saveProject({ ...fresh, plans: withUrls });
        }
      }
      nav(`/studio/${id}`);
    } catch (e) {
      console.error(e);
      setError('Could not create the project. Check your connection, and make sure the Studio Firestore rules are deployed.');
      setCreating(false);
    }
  };

  return (
    <Shell title="New project" back={{ to: '/studio', label: 'All projects' }}>
      <h1 className="font-serif text-3xl font-bold text-stone-900">New project from brochure</h1>

      <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
        <h2 className="text-sm font-extrabold text-stone-900">1. Upload the brochure</h2>
        <p className="mt-1 text-xs font-medium text-stone-500">PDF, or JPG/PNG images of the pages. Only upload material you have the right to use.</p>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} className={`${btnGhost} mt-4`} disabled={!!reading}>{pages.length ? 'Choose a different file' : 'Choose brochure file'}</button>
        {reading && <p className="mt-3 text-xs font-bold text-brand-700">{reading}</p>}

        {pages.length > 0 && (
          <>
            <p className="mt-5 text-xs font-bold text-stone-700">Tap the pages that show unit floor plans ({picked.size} selected)</p>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {pages.map((p, i) => (
                <button key={i} onClick={() => toggle(i)} className={`relative overflow-hidden rounded-xl border-2 bg-stone-50 text-left ${picked.has(i) ? 'border-brand-600' : 'border-transparent ring-1 ring-stone-200'}`}>
                  <img src={p.dataUrl} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover object-top" />
                  <span className="absolute left-1.5 top-1.5 rounded bg-stone-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{i + 1}</span>
                  {picked.has(i) && <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">Plan</span>}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={readWithAi} disabled={aiBusy} className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
                {aiBusy ? 'Reading brochure…' : 'Read brochure with AI (optional)'}
              </button>
              {aiNote && <p className="text-xs font-semibold text-stone-600">{aiNote}</p>}
            </div>
          </>
        )}
      </section>

      {picked.size > 0 && (
        <section className="mt-5 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
          <h2 className="text-sm font-extrabold text-stone-900">2. Name each unit type</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...picked].sort((a, b) => a - b).map((pi, n) => (
              <div key={pi} className="flex items-center gap-3">
                <img src={pages[pi].dataUrl} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover object-top ring-1 ring-stone-200" />
                <input className={input} placeholder={aiUnits?.[n]?.name || `Unit type ${n + 1} (e.g. 3 BHK - Type A)`} value={names[pi] || ''} onChange={(e) => setNames((m) => ({ ...m, [pi]: e.target.value }))} maxLength={60} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
        <h2 className="text-sm font-extrabold text-stone-900">{picked.size > 0 ? '3' : '2'}. Project details</h2>
        <div className="mt-4"><DetailsFields value={details} onChange={setDetails} /></div>
        {error && <p className="mt-4 text-xs font-bold text-brand-700">{error}</p>}
        <button onClick={create} disabled={creating} className={`${btnPrimary} mt-6`}>{creating ? 'Creating project…' : 'Create project'}</button>
        <p className="mt-2 text-[11px] font-medium text-stone-400">Next you trace each floor plan into 3D. You can add more plans later.</p>
      </section>
    </Shell>
  );
}

// ------------------------------------------------------------------ Workspace

type WTab = 'details' | 'plans' | 'publish';

function Workspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<StudioProject | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [tab, setTab] = useState<WTab>('plans');
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const dirtyRef = useRef(false);
  const projectRef = useRef<StudioProject | null>(null);
  projectRef.current = project;

  useEffect(() => {
    let off = false;
    if (!id) return;
    getProject(id).then((p) => {
      if (off) return;
      if (!p || p.ownerId !== user?.uid) { setState('missing'); return; }
      setProject(p);
      setState('ready');
    }).catch(() => !off && setState('missing'));
    return () => { off = true; };
  }, [id, user?.uid]);

  const update = useCallback((fn: (p: StudioProject) => StudioProject) => {
    setProject((p) => (p ? fn(p) : p));
    dirtyRef.current = true;
    setSave('dirty');
  }, []);

  const flush = useCallback(async () => {
    const p = projectRef.current;
    if (!p || !dirtyRef.current) return;
    dirtyRef.current = false;
    setSave('saving');
    try {
      await saveProject(p);
      setSave(dirtyRef.current ? 'dirty' : 'saved');
    } catch (e) {
      console.error(e);
      dirtyRef.current = true;
      setSave('error');
    }
  }, []);

  // Autosave 2s after the last change.
  useEffect(() => {
    if (save !== 'dirty') return;
    const t = setTimeout(flush, 2000);
    return () => clearTimeout(t);
  }, [save, project, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  if (state === 'loading') return <Shell><p className="text-sm font-semibold text-stone-500">Loading…</p></Shell>;
  if (state === 'missing' || !project) {
    return <Shell back={{ to: '/studio', label: 'All projects' }}><p className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-stone-600 ring-1 ring-stone-200">Project not found, or it belongs to another account.</p></Shell>;
  }

  return (
    <Shell title={project.name} back={{ to: '/studio', label: 'All projects' }}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate font-serif text-3xl font-bold text-stone-900">{project.name}</h1>
        <span className={`text-xs font-bold ${save === 'error' ? 'text-brand-700' : save === 'saved' ? 'text-emerald-700' : 'text-stone-500'}`}>
          {save === 'saved' ? 'All changes saved' : save === 'saving' ? 'Saving…' : save === 'error' ? 'Could not save. Tap to retry' : 'Unsaved changes'}
        </span>
        {(save === 'dirty' || save === 'error') && <button onClick={flush} className={btnGhost}>Save now</button>}
        <Link to={`/tour/${project.id}`} className={btnGhost}>Preview tour</Link>
      </div>

      <div className="mb-5 flex gap-1 border-b border-stone-200">
        {([['plans', 'Floor plans'], ['details', 'Project details'], ['publish', 'Publish & share']] as [WTab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-4 py-2.5 text-sm font-bold ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500'}`}>{l}</button>
        ))}
      </div>

      {tab === 'plans' && <PlansTab project={project} update={update} />}
      {tab === 'details' && <DetailsTab project={project} update={update} />}
      {tab === 'publish' && <PublishTab project={project} update={update} flush={flush} />}
    </Shell>
  );
}

function PlansTab({ project, update }: { project: StudioProject; update: (fn: (p: StudioProject) => StudioProject) => void }) {
  const { user } = useAuth();
  const [planId, setPlanId] = useState(project.plans[0]?.id || '');
  const [img, setImg] = useState<string | undefined>();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  const plan = project.plans.find((p) => p.id === planId) || project.plans[0];

  useEffect(() => {
    if (!plan) return;
    let off = false;
    setImg(undefined);
    loadPlanImage(plan.id, plan.imageUrl).then((d) => !off && setImg(d));
    return () => { off = true; };
  }, [plan?.id, plan?.imageUrl]);

  // Debounce what the 3D preview sees, so dragging a wall stays smooth.
  const [previewPlan, setPreviewPlan] = useState<FloorPlan | undefined>(plan);
  useEffect(() => {
    const t = setTimeout(() => setPreviewPlan(plan), 250);
    return () => clearTimeout(t);
  }, [plan]);

  const setPlan = (np: FloorPlan) => update((p) => ({ ...p, plans: p.plans.map((x) => (x.id === np.id ? np : x)) }));

  const detect = async () => {
    if (!plan) return;
    if (plan.walls.length && !window.confirm('This replaces the walls, doors and windows you have drawn. Continue?')) return;
    if (!img) { setAiMsg('There is no plan image to read. Add the plan page again with "Add floor plan".'); return; }
    setAiBusy(true);
    setAiMsg(null);
    try {
      const small = await shrinkDataUrl(img, 1200, 0.72);
      const r = await parsePlan(small);
      if (!r.walls.length) { setAiMsg('The AI could not find clear walls on this page. Trace it by hand with the Wall tool.'); return; }
      setPlan(applyPlanParse(plan, r));
      setAiMsg(`Drafted ${r.walls.length} walls. Check them against the plan, fix anything off, then set the scale.`);
    } catch (e: any) {
      setAiMsg(e?.message || 'AI drafting failed. Trace the plan by hand.');
    } finally {
      setAiBusy(false);
    }
  };

  const addPlans = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setAdding(true);
    try {
      const pages = await filesToPages(Array.from(files));
      const fresh: FloorPlan[] = [];
      for (const pg of pages.slice(0, 12)) {
        const p = emptyPlan(`Unit type ${project.plans.length + fresh.length + 1}`, pg.width, pg.height);
        localImages.set(p.id, pg.dataUrl);
        p.imageUrl = await uploadPlanImage(user.uid, project.id, p.id, pg.dataUrl);
        fresh.push(p);
      }
      if (fresh.length) {
        update((p) => ({ ...p, plans: [...p.plans, ...fresh] }));
        setPlanId(fresh[0].id);
      }
    } finally {
      setAdding(false);
    }
  };

  const removePlan = () => {
    if (!plan || !window.confirm(`Remove "${plan.name}"?`)) return;
    update((p) => ({ ...p, plans: p.plans.filter((x) => x.id !== plan.id) }));
    setPlanId(project.plans.find((x) => x.id !== plan.id)?.id || '');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {project.plans.map((p) => (
          <button key={p.id} onClick={() => setPlanId(p.id)} className={`rounded-full px-4 py-2 text-xs font-bold ${p.id === plan?.id ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200'}`}>
            {p.name || 'Unit type'}{p.walls.length ? '' : ' · not traced'}
          </button>
        ))}
        <input ref={addRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => { addPlans(e.target.files); e.target.value = ''; }} />
        <button onClick={() => addRef.current?.click()} disabled={adding} className="rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50">{adding ? 'Adding…' : '+ Add floor plan'}</button>
      </div>

      {!plan ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-stone-500 ring-1 ring-stone-200">No floor plans yet. Tap "Add floor plan" and choose a plan page (image or PDF).</p>
      ) : (
        <>
          <div className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200 sm:grid-cols-4">
            <div className="sm:col-span-2"><span className={label}>Unit type name</span><input className={input} value={plan.name} maxLength={60} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></div>
            <div><span className={label}>BHK / type</span><input className={input} value={plan.bhk || ''} maxLength={20} onChange={(e) => setPlan({ ...plan, bhk: e.target.value })} placeholder="3 BHK" /></div>
            <div><span className={label}>Area (sq ft)</span><input className={input} type="number" min={0} value={plan.areaSqft || ''} onChange={(e) => setPlan({ ...plan, areaSqft: parseInt(e.target.value) || undefined })} /></div>
            <div><span className={label}>Wall height (m)</span><input className={input} type="number" step="0.1" min={2} max={5} value={plan.wallHeight} onChange={(e) => setPlan({ ...plan, wallHeight: Math.max(2, Math.min(5, parseFloat(e.target.value) || 2.9)) })} /></div>
            <div className="flex items-end sm:col-span-3"><button onClick={removePlan} className="text-xs font-bold text-stone-400 hover:text-brand-700">Remove this floor plan</button></div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <PlanEditor plan={plan} imageSrc={img} onChange={setPlan} onAiDetect={detect} aiBusy={aiBusy} aiMessage={aiMsg} />
            <div className="space-y-2 xl:sticky xl:top-20 xl:self-start">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">Live 3D preview</p>
              {previewPlan && <Plan3DViewer plan={previewPlan} className="h-[48vh] min-h-[300px] w-full" />}
              {plan.walls.length > 0 && plan.areaSqft ? (
                <p className="text-[11px] font-medium text-stone-500">
                  Traced footprint is about {footprintSqft(plan).toLocaleString('en-IN')} sq ft vs {plan.areaSqft.toLocaleString('en-IN')} sq ft stated. They differ because footprint includes walls, balconies and gaps. A very large gap usually means the scale needs fixing.
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DetailsTab({ project, update }: { project: StudioProject; update: (fn: (p: StudioProject) => StudioProject) => void }) {
  const [finding, setFinding] = useState(false);
  const [msg, setMsg] = useState('');
  const form: DetailsForm = {
    name: project.name, developerName: project.developerName || '', address: project.address, city: project.city || '',
    reraId: project.reraId || '', description: project.description || '', amenities: project.amenities.join(', '),
    contactPhone: project.contactPhone || '', contactEmail: project.contactEmail || '',
  };
  const onChange = (v: DetailsForm) =>
    update((p) => ({
      ...p, name: v.name, developerName: v.developerName, address: v.address, city: v.city, reraId: v.reraId,
      description: v.description, amenities: splitAmenities(v.amenities), contactPhone: v.contactPhone, contactEmail: v.contactEmail,
    }));

  const find = async () => {
    setFinding(true);
    setMsg('');
    const g = await geocode([project.address, project.city].filter(Boolean).join(', '));
    setFinding(false);
    if (!g) { setMsg('Could not find that address. Try adding the city, or type latitude and longitude by hand.'); return; }
    update((p) => ({ ...p, lat: g.lat, lng: g.lng }));
    setMsg(`Found: ${g.label}`);
  };

  const hasLoc = typeof project.lat === 'number' && typeof project.lng === 'number';
  const num = (v: string) => { const n = parseFloat(v); return isFinite(n) ? n : undefined; };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7"><DetailsFields value={form} onChange={onChange} /></div>
        <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
          <h2 className="text-sm font-extrabold text-stone-900">Videos and highlights</h2>
          <div>
            <span className={label}>Project videos (one link per line: YouTube, Vimeo or .mp4)</span>
            <textarea className={`${input} min-h-[80px]`} defaultValue={(project.videos || []).join('\n')} onChange={(e) => { const v = splitLines(e.target.value).slice(0, 8); update((p) => ({ ...p, videos: v })); }} placeholder="https://www.youtube.com/watch?v=…" />
          </div>
          <div>
            <span className={label}>Highlights (one per line, e.g. "5 min to metro")</span>
            <textarea className={`${input} min-h-[80px]`} defaultValue={(project.highlights || []).join('\n')} onChange={(e) => { const v = splitLines(e.target.value).map((x) => x.slice(0, 80)).slice(0, 12); update((p) => ({ ...p, highlights: v })); }} />
          </div>
        </div>
      </div>
      <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
        <h2 className="text-sm font-extrabold text-stone-900">Map location</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={find} disabled={finding} className={btnGhost}>{finding ? 'Finding…' : 'Find from address'}</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><span className={label}>Latitude</span><input className={input} value={project.lat ?? ''} onChange={(e) => update((p) => ({ ...p, lat: num(e.target.value) }))} inputMode="decimal" /></div>
          <div><span className={label}>Longitude</span><input className={input} value={project.lng ?? ''} onChange={(e) => update((p) => ({ ...p, lng: num(e.target.value) }))} inputMode="decimal" /></div>
        </div>
        {msg && <p className="text-xs font-semibold text-stone-600">{msg}</p>}
        {hasLoc ? (
          <StudioMap key={`${project.lat},${project.lng}`} lat={project.lat!} lng={project.lng!} name={project.name} />
        ) : (
          <p className="text-xs font-semibold text-amber-700">Set the location so buyers can see the map and what is nearby.</p>
        )}
      </div>
    </div>
  );
}

function PublishTab({ project, update, flush }: { project: StudioProject; update: (fn: (p: StudioProject) => StudioProject) => void; flush: () => Promise<void> }) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState('');
  const url = `${window.location.origin}/tour/${project.id}`;
  const embed = `<iframe src="${url}" width="100%" height="760" style="border:0;border-radius:16px" allow="fullscreen" loading="lazy" title="${project.name.replace(/"/g, '')}"></iframe>`;

  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#1A1714', light: '#ffffff' } }).then(setQr).catch(() => setQr('')); }, [url]);

  const traced = project.plans.filter((p) => p.walls.length > 0);
  const checks = useMemo(() => ([
    { ok: !!project.name.trim() && !!project.address.trim(), text: 'Project name and address added' },
    { ok: typeof project.lat === 'number' && typeof project.lng === 'number', text: 'Map location set' },
    { ok: traced.length > 0, text: 'At least one floor plan traced into 3D' },
    { ok: traced.length > 0 && traced.every((p) => p.scaleConfirmed), text: 'Scale set on every traced plan (so sizes are real, not guessed)' },
    { ok: !!(project.contactPhone?.trim() || project.contactEmail?.trim()), text: 'Sales phone or email added' },
  ]), [project, traced]);
  const ready = checks.every((c) => c.ok);

  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(''), 1500); };

  const toggle = async () => {
    update((p) => ({ ...p, published: !p.published }));
    setTimeout(flush, 50);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
        <h2 className="text-sm font-extrabold text-stone-900">Before you publish</h2>
        <ul className="space-y-2">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm font-semibold">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${c.ok ? 'bg-emerald-600' : 'bg-stone-300'}`}>{c.ok ? '✓' : ''}</span>
              <span className={c.ok ? 'text-stone-700' : 'text-stone-500'}>{c.text}</span>
            </li>
          ))}
        </ul>
        <button onClick={toggle} disabled={!project.published && !ready} className={btnPrimary}>
          {project.published ? 'Unpublish (make private)' : 'Publish tour'}
        </button>
        <p className="text-xs font-medium text-stone-500">
          {project.published ? 'Anyone with the link can open the tour and send you an enquiry.' : 'Published tours are public to anyone who has the link. Buyers can send enquiries from the page.'}
        </p>
      </div>

      <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
        <h2 className="text-sm font-extrabold text-stone-900">Share</h2>
        <div>
          <span className={label}>Tour link</span>
          <div className="flex gap-2">
            <input readOnly value={url} className={input} onFocus={(e) => e.target.select()} />
            <button onClick={() => copy('url', url)} className={btnGhost}>{copied === 'url' ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${project.name} – 3D tour: ${url}`)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Send on WhatsApp</a>
          <Link to={`/tour/${project.id}`} className={btnGhost}>Open tour</Link>
        </div>
        <div>
          <span className={label}>Embed on your website</span>
          <textarea readOnly rows={3} value={embed} className={`${input} font-mono text-xs`} onFocus={(e) => e.target.select()} />
          <button onClick={() => copy('embed', embed)} className="mt-2 text-xs font-bold text-brand-700">{copied === 'embed' ? 'Copied' : 'Copy embed code'}</button>
        </div>
        {qr && (
          <div>
            <span className={label}>QR code (for brochures and site boards)</span>
            <img src={qr} alt="QR code for the tour link" className="h-40 w-40 rounded-xl ring-1 ring-stone-200" />
            <a href={qr} download={`${project.name.replace(/[^a-z0-9]+/gi, '-')}-qr.png`} className="mt-2 inline-block text-xs font-bold text-brand-700">Download QR</a>
          </div>
        )}
      </div>
    </div>
  );
}
