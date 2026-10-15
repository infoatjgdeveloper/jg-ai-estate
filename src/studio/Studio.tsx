import * as React from 'react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../AuthContext';
import Skyline from '../ui/Skyline';
import { btnGhost, btnGold, btnPrimary, input, label, Logo } from '../ui/kit';
import { filesToPages, shrinkDataUrl } from './files';
import { emptyPlan, planFromItem } from './geometry';
import { createProject, deleteProject, geocode, getBuilder, leadTime, listMyLeads, listMyProjects, parseBrochure, parsePlan, saveBuilder, saveProject, setLeadStatus } from './studioApi';
import { splitLines } from './media';
import type { BuilderProfile, FloorPlan, StudioLead, StudioProject } from './types';
const UnitViewer = lazy(() => import('./UnitViewer'));

type Tab = 'projects' | 'leads' | 'profile';

export default function Studio() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const [builder, setBuilder] = useState<BuilderProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('projects');

  useEffect(() => {
    if (!user) { setBuilder(undefined); return; }
    getBuilder(user.uid).then(setBuilder).catch(() => setBuilder(null));
  }, [user]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-night text-sm font-bold text-white/70">Loading…</div>;

  if (!user) return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink p-6 text-center text-white">
      <Skyline />
      <div className="relative z-10 max-w-lg">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <h1 className="font-serif text-4xl sm:text-5xl">Your tower, in <span className="gold-text">3D</span>.</h1>
        <p className="mt-4 text-white/70">Sign in to upload your brochure and get a shareable, walkable 3D tour.</p>
        <div className="mt-7 flex justify-center gap-3">
          <button onClick={() => openAuthModal('signup')} className={btnGold}>Create builder account</button>
          <button onClick={() => openAuthModal('signin')} className="rounded-full bg-white/10 px-6 py-3 text-sm font-extrabold ring-1 ring-white/25 hover:bg-white/20">Sign in</button>
        </div>
      </div>
    </div>
  );

  if (builder === undefined) return <div className="grid min-h-screen place-items-center bg-night text-sm font-bold text-white/70">Loading…</div>;
  if (!builder) return <Onboarding uid={user.uid} email={user.email || ''} onDone={setBuilder} />;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="ml-4 flex gap-1">
            {(['projects', 'leads', 'profile'] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-extrabold capitalize ${tab === t ? 'bg-gold-400 text-night' : 'text-white/70 hover:text-white'}`}>{t}</button>)}
          </nav>
          <button onClick={() => signOut()} className="ml-auto text-xs font-bold text-white/60 hover:text-white">Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {tab === 'projects' && <Projects uid={user.uid} builder={builder} />}
        {tab === 'leads' && <Leads uid={user.uid} />}
        {tab === 'profile' && <ProfileForm builder={builder} onSaved={setBuilder} />}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- onboarding / profile */

function ProfileFields({ v, set }: { v: Partial<BuilderProfile>; set: (k: keyof BuilderProfile, val: any) => void }) {
  return (
    <div className="grid gap-4">
      <div><label className={label}>Company name *</label><input className={input} value={v.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label}>City *</label><input className={input} value={v.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
        <div><label className={label}>Phone for enquiries *</label><input className={input} inputMode="tel" value={v.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      <div><label className={label}>One-line tagline</label><input className={input} value={v.tagline || ''} onChange={(e) => set('tagline', e.target.value)} placeholder="Building homes families love since 2005" /></div>
      <div><label className={label}>About your company</label><textarea className={input} rows={3} value={v.about || ''} onChange={(e) => set('about', e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={label}>Years in business</label><input className={input} inputMode="numeric" value={v.yearsInBusiness ?? ''} onChange={(e) => set('yearsInBusiness', Number(e.target.value.replace(/\D/g, '')) || undefined)} /></div>
        <div><label className={label}>Website</label><input className={input} value={v.website || ''} onChange={(e) => set('website', e.target.value)} /></div>
        <div><label className={label}>RERA no. (optional)</label><input className={input} value={v.reraId || ''} onChange={(e) => set('reraId', e.target.value)} /></div>
      </div>
    </div>
  );
}

function Onboarding({ uid, email, onDone }: { uid: string; email: string; onDone: (b: BuilderProfile) => void }) {
  const [v, setV] = useState<Partial<BuilderProfile>>({ country: 'India' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ok = !!v.name?.trim() && !!v.city?.trim() && !!v.phone?.trim() && agree;
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const b: BuilderProfile = { ...(v as BuilderProfile), id: uid, ownerId: uid, name: v.name!.trim(), email, published: true, agreedTermsAt: new Date().toISOString() };
      await saveBuilder(b);
      onDone(b);
    } catch { setErr('Could not save. Check your connection and try again.'); setBusy(false); }
  };
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink px-4 py-10">
      <Skyline />
      <div className="relative z-10 mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-2xl">
        <Logo light={false} />
        <h1 className="mt-5 font-serif text-3xl text-brand-900">Set up your builder page</h1>
        <p className="mb-6 mt-1 text-sm text-stone-500">Takes a minute. Buyers see this on your public page.</p>
        <ProfileFields v={v} set={(k, val) => setV((o) => ({ ...o, [k]: val }))} />
        <label className="mt-5 flex items-start gap-3 text-xs font-semibold text-stone-600">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>I confirm the details are correct and agree that enquiries received through JGEstate are tagged as JGEstate leads, under the commission terms agreed with JGEstate.</span>
        </label>
        {err && <p className="mt-3 text-xs font-bold text-red-600">{err}</p>}
        <button disabled={!ok || busy} onClick={go} className={`${btnPrimary} mt-5 w-full`}>{busy ? 'Saving…' : 'Create my page'}</button>
      </div>
    </div>
  );
}

function ProfileForm({ builder, onSaved }: { builder: BuilderProfile; onSaved: (b: BuilderProfile) => void }) {
  const [v, setV] = useState<BuilderProfile>(builder);
  const [msg, setMsg] = useState('');
  const save = async () => { try { await saveBuilder(v); onSaved(v); setMsg('Saved ✓'); } catch { setMsg('Could not save'); } };
  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200">
      <h2 className="mb-5 font-serif text-2xl text-brand-900">Company profile</h2>
      <ProfileFields v={v} set={(k, val) => setV((o) => ({ ...o, [k]: val }))} />
      <div className="mt-4"><label className={label}>Company videos (one link per line)</label><textarea className={input} rows={2} value={(v.videos || []).join('\n')} onChange={(e) => setV({ ...v, videos: splitLines(e.target.value) })} placeholder="https://youtu.be/…" /></div>
      <div className="mt-5 flex items-center gap-3"><button onClick={save} className={btnPrimary}>Save</button><Link to={`/builders/${builder.id}`} className={btnGhost}>View public page</Link><span className="text-sm font-bold text-emerald-700">{msg}</span></div>
    </div>
  );
}

/* ---------------------------------------------------------------- projects */

function Projects({ uid, builder }: { uid: string; builder: BuilderProfile }) {
  const [list, setList] = useState<StudioProject[] | null>(null);
  const [open, setOpen] = useState<StudioProject | null>(null);
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const refresh = useCallback(() => listMyProjects(uid).then(setList).catch(() => setList([])), [uid]);
  useEffect(() => { refresh(); }, [refresh]);

  if (open) return <ProjectEditor key={open.id} project={open} onClose={() => { setOpen(null); refresh(); }} />;
  if (mode === 'new') return <NewProject uid={uid} builder={builder} onCancel={() => setMode('list')} onCreated={(p) => { setMode('list'); setOpen(p); }} />;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl text-brand-900">Your projects</h1>
        <button onClick={() => setMode('new')} className={btnPrimary}>+ New from brochure</button>
      </div>
      {list === null ? <p className="text-sm font-semibold text-stone-400">Loading…</p> : list.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="font-serif text-2xl text-brand-900">Upload your first brochure</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">We’ll read it and build your tower and furnished homes in 3D.</p>
          <button onClick={() => setMode('new')} className={`${btnGold} mt-5`}>Upload brochure</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)} className="rounded-3xl bg-white p-5 text-left ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${p.published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.published ? 'Live' : 'Draft'}</span>
              <p className="mt-2 font-serif text-2xl text-brand-900">{p.name}</p>
              <p className="text-sm text-stone-500">{p.plans.length} home types{p.building ? ` · ${p.building.floors} floors` : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const pick = <T,>(arr: T[], n: number) => (arr.length <= n ? arr.map((v, i) => ({ v, i })) : Array.from({ length: n }, (_, k) => { const i = Math.round((k * (arr.length - 1)) / (n - 1)); return { v: arr[i], i }; }));

async function plansFromPages(pages: { dataUrl: string; width: number; height: number }[], log: (s: string) => void): Promise<FloorPlan[]> {
  const out: FloorPlan[] = [];
  for (let k = 0; k < pages.length; k++) {
    log(`Reading floor plan page ${k + 1} of ${pages.length}…`);
    try {
      const img = await shrinkDataUrl(pages[k].dataUrl, 1500, 0.78);
      const r = await parsePlan(img);
      for (const item of r.plans || []) {
        const base = emptyPlan(item.name || 'Home', pages[k].width, pages[k].height);
        const p = planFromItem(base, item);
        if (p.walls.length) out.push(p);
      }
    } catch (e: any) {
      if (/not configured|sign in|Too many/i.test(e?.message || '')) throw e;
    }
  }
  return out;
}

function NewProject({ uid, builder, onCancel, onCreated }: { uid: string; builder: BuilderProfile; onCancel: () => void; onCreated: (p: StudioProject) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const run = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      setMsg('Opening your brochure…');
      const pages = await filesToPages(files, (d, t) => setMsg(`Opening brochure… page ${d} of ${t}`));
      if (!pages.length) throw new Error('Could not read that file. Use a PDF or images.');
      setMsg('AI is reading your brochure…');
      const sel = pick(pages, 30);
      const thumbs = await Promise.all(sel.map((s) => shrinkDataUrl(s.v.dataUrl, 700, 0.55)));
      const b = await parseBrochure(thumbs);
      const planIdx = (b.floorPlanPages || []).map((i) => sel[i]?.i).filter((i): i is number => i !== undefined).slice(0, 8);
      const planPages = planIdx.map((i) => pages[i]);
      const plans = planPages.length ? await plansFromPages(planPages, setMsg) : [];
      const maxFloor = Math.max(0, ...plans.map((p) => p.floorTo || 0), b.floors || 0);
      setMsg('Building your 3D tower…');
      const data = {
        ownerId: uid, ownerName: builder.name,
        name: b.name || 'My project', developerName: b.developer || builder.name, reraId: b.reraId || builder.reraId,
        address: b.address || '', city: b.city || builder.city, description: b.description,
        amenities: b.amenities || [], plans, building: { floors: maxFloor || 12, towers: b.towers || 1 },
        contactPhone: builder.phone, contactEmail: builder.email, videos: [], highlights: [], published: false,
      } as Omit<StudioProject, 'id' | 'createdAt' | 'updatedAt'>;
      const id = await createProject(data);
      onCreated({ ...data, id });
    } catch (e: any) { setErr(e?.message || 'Something went wrong.'); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-xl">
      <button onClick={onCancel} className="mb-4 text-sm font-bold text-stone-500">← Back</button>
      <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-center text-white">
        <Skyline className="opacity-70" />
        <div className="relative z-10">
          <h1 className="font-serif text-3xl">Upload your brochure</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/70">PDF or page images. AI reads the details, floors and every floor plan.</p>
          {busy ? (
            <div className="mt-8"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-gold-400" /><p className="mt-4 text-sm font-bold text-gold-300">{msg}</p><p className="mt-1 text-xs text-white/50">This can take a minute or two. Keep this page open.</p></div>
          ) : (
            <label className={`${btnGold} mt-8 cursor-pointer`}>Choose brochure<input type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => run(Array.from(e.target.files || []))} /></label>
          )}
          {err && <p className="mt-4 rounded-xl bg-red-500/20 p-3 text-sm font-bold text-red-100">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function ProjectEditor({ project, onClose }: { project: StudioProject; onClose: () => void }) {
  const [p, setP] = useState<StudioProject>(project);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState<FloorPlan | null>(null);
  const [qr, setQr] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const url = `${window.location.origin}/tour/${p.id}`;
  useEffect(() => { if (p.published) QRCode.toDataURL(url, { margin: 1, width: 300 }).then(setQr).catch(() => {}); }, [p.published, url]);
  const set = <K extends keyof StudioProject>(k: K, val: StudioProject[K]) => setP((o) => ({ ...o, [k]: val }));
  const save = async (next = p) => { try { await saveProject(next); setMsg('Saved ✓'); } catch { setMsg('Could not save — try again'); } setTimeout(() => setMsg(''), 2500); };
  const setPlan = (id: string, patch: Partial<FloorPlan>) => set('plans', p.plans.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const locate = async () => { const g = await geocode([p.address, p.city].filter(Boolean).join(', ')); if (g) { setP((o) => ({ ...o, lat: g.lat, lng: g.lng })); setMsg('Location found ✓'); } else setMsg('Could not find that address'); };
  const addPages = async (files: File[]) => {
    if (!files.length) return;
    setAdding(true);
    try {
      const pages = await filesToPages(files);
      const more = await plansFromPages(pages.slice(0, 6), setAddMsg);
      setP((o) => ({ ...o, plans: [...o.plans, ...more] }));
      setAddMsg(more.length ? `Added ${more.length} home type${more.length > 1 ? 's' : ''}` : 'No floor plans found on those pages');
    } catch (e: any) { setAddMsg(e?.message || 'Failed'); }
    setAdding(false);
  };
  const num = (s: string) => Number(s.replace(/\D/g, '')) || undefined;

  return (
    <div>
      <button onClick={onClose} className="mb-4 text-sm font-bold text-stone-500">← All projects</button>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl text-brand-900">{p.name || 'Project'}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${p.published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.published ? 'Live' : 'Draft'}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-bold text-emerald-700">{msg}</span>
          <button onClick={() => save()} className={btnGhost}>Save</button>
          <button onClick={() => { const n = { ...p, published: !p.published }; setP(n); save(n); }} className={p.published ? btnGhost : btnGold}>{p.published ? 'Unpublish' : 'Publish'}</button>
        </div>
      </div>

      {p.published && (
        <div className="mb-6 flex flex-wrap items-center gap-5 rounded-3xl bg-night p-5 text-white">
          {qr && <img src={qr} alt="QR" className="h-24 w-24 rounded-xl bg-white p-1" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-widest text-gold-300">Your share link</p>
            <p className="mt-1 break-all text-sm font-bold">{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => navigator.clipboard.writeText(url).then(() => setMsg('Link copied ✓'))} className={btnGold.replace('px-6 py-3', 'px-4 py-2')}>Copy link</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(p.name + ' — walk through it in 3D: ' + url)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold ring-1 ring-white/25">WhatsApp</a>
              <Link to={`/tour/${p.id}`} className="rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold ring-1 ring-white/25">Open tour</Link>
            </div>
          </div>
        </div>
      )}

      <section className="mb-6 rounded-3xl bg-white p-6 ring-1 ring-stone-200">
        <h2 className="mb-1 font-serif text-xl text-brand-900">Check what AI read</h2>
        <p className="mb-4 text-xs font-semibold text-stone-500">AI can make mistakes — please correct anything wrong before you publish.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Project name</label><input className={input} value={p.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><label className={label}>Developer</label><input className={input} value={p.developerName || ''} onChange={(e) => set('developerName', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={label}>Address</label><div className="flex gap-2"><input className={input} value={p.address} onChange={(e) => set('address', e.target.value)} /><button onClick={locate} className={btnGhost}>Find on map</button></div></div>
          <div><label className={label}>City</label><input className={input} value={p.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
          <div><label className={label}>RERA no.</label><input className={input} value={p.reraId || ''} onChange={(e) => set('reraId', e.target.value)} /></div>
          <div><label className={label}>Number of floors</label><input className={input} inputMode="numeric" value={p.building?.floors ?? ''} onChange={(e) => set('building', { ...p.building, floors: Math.min(120, num(e.target.value) || 1) })} /></div>
          <div><label className={label}>Number of towers</label><input className={input} inputMode="numeric" value={p.building?.towers ?? ''} onChange={(e) => set('building', { floors: p.building?.floors || 12, towers: Math.min(10, num(e.target.value) || 1) })} /></div>
          <div className="sm:col-span-2"><label className={label}>Description</label><textarea className={input} rows={3} value={p.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
          <div><label className={label}>Amenities (one per line)</label><textarea className={input} rows={4} value={p.amenities.join('\n')} onChange={(e) => set('amenities', splitLines(e.target.value))} /></div>
          <div><label className={label}>Highlights (one per line)</label><textarea className={input} rows={4} value={(p.highlights || []).join('\n')} onChange={(e) => set('highlights', splitLines(e.target.value))} placeholder="5 min to metro" /></div>
          <div className="sm:col-span-2"><label className={label}>Project videos (YouTube / Vimeo links, one per line)</label><textarea className={input} rows={2} value={(p.videos || []).join('\n')} onChange={(e) => set('videos', splitLines(e.target.value))} /></div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl bg-white p-6 ring-1 ring-stone-200">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl text-brand-900">Home types ({p.plans.length})</h2>
          <label className={`${btnGhost} cursor-pointer`}>{adding ? addMsg || 'Reading…' : '+ Add plan pages'}<input type="file" accept="application/pdf,image/*" multiple className="hidden" disabled={adding} onChange={(e) => addPages(Array.from(e.target.files || []))} /></label></div>
        {!adding && addMsg && <p className="mb-3 text-xs font-bold text-stone-500">{addMsg}</p>}
        {p.plans.length === 0 && <p className="text-sm font-semibold text-stone-500">No floor plans were found. Use “Add plan pages” to upload the pages that show your unit layouts.</p>}
        <div className="space-y-3">
          {p.plans.map((pl) => (
            <div key={pl.id} className="grid items-end gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <div><label className={label}>Name</label><input className={input} value={pl.name} onChange={(e) => setPlan(pl.id, { name: e.target.value })} /></div>
              <div><label className={label}>Area sq.ft</label><input className={input} inputMode="numeric" value={pl.areaSqft ?? ''} onChange={(e) => setPlan(pl.id, { areaSqft: num(e.target.value) })} /></div>
              <div><label className={label}>From floor</label><input className={input} inputMode="numeric" value={pl.floorFrom ?? ''} onChange={(e) => setPlan(pl.id, { floorFrom: num(e.target.value) })} /></div>
              <div><label className={label}>To floor</label><input className={input} inputMode="numeric" value={pl.floorTo ?? ''} onChange={(e) => setPlan(pl.id, { floorTo: num(e.target.value) })} /></div>
              <div className="flex gap-2"><button onClick={() => setView(pl)} className={btnPrimary}>Preview 3D</button><button aria-label="Remove" onClick={() => confirm('Remove this home type?') && set('plans', p.plans.filter((x) => x.id !== pl.id))} className={btnGhost}>✕</button></div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-stone-400">Leave floors empty if a home type is on every floor.</p>
      </section>

      <button onClick={async () => { if (confirm('Delete this project permanently?')) { await deleteProject(p.id); onClose(); } }} className="text-xs font-bold text-red-600">Delete project</button>

      {view && (
        <div className="fixed inset-0 z-50 bg-black/80 p-3 sm:p-8">
          <Suspense fallback={null}><UnitViewer plan={view} className="h-full w-full rounded-3xl" onExit={() => setView(null)} /></Suspense>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- leads */

function Leads({ uid }: { uid: string }) {
  const [list, setList] = useState<StudioLead[] | null>(null);
  useEffect(() => { listMyLeads(uid).then(setList).catch(() => setList([])); }, [uid]);
  const mark = async (l: StudioLead, s: 'new' | 'contacted' | 'closed') => { await setLeadStatus(l.id, s); setList((o) => o && o.map((x) => (x.id === l.id ? { ...x, status: s } : x))); };
  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl text-brand-900">Enquiries</h1>
      <p className="mb-6 text-sm font-semibold text-stone-500">Every enquiry below came through JGEstate and carries its reference code.</p>
      {list === null ? <p className="text-sm text-stone-400">Loading…</p> : list.length === 0 ? <p className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-stone-500 ring-1 ring-stone-200">No enquiries yet. Share your tour link to get them.</p> : (
        <div className="space-y-3">
          {list.map((l) => (
            <div key={l.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
              <div className="flex flex-wrap items-center gap-2"><p className="font-extrabold text-brand-900">{l.name}</p><span className="rounded-full bg-gold-300/40 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-800">via JGEstate · {l.refCode}</span><span className="ml-auto text-xs text-stone-400">{leadTime(l)}</span></div>
              <p className="mt-1 text-sm font-semibold text-stone-600">{l.projectName}{l.planName ? ` · ${l.planName}` : ''}</p>
              <p className="mt-1 text-sm"><a href={`tel:${l.phone}`} className="font-bold text-brand-600">{l.phone}</a>{l.email && <> · <a href={`mailto:${l.email}`} className="text-brand-600">{l.email}</a></>}</p>
              {l.message && <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{l.message}</p>}
              <div className="mt-3 flex gap-1.5">{(['new', 'contacted', 'closed'] as const).map((s) => <button key={s} onClick={() => mark(l, s)} className={`rounded-full px-3 py-1 text-xs font-extrabold capitalize ${(l.status || 'new') === s ? 'bg-night text-white' : 'bg-stone-100 text-stone-500'}`}>{s}</button>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
