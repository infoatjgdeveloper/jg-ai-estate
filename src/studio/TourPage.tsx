import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Plan3DViewer from './Plan3DViewer';
import StudioMap from './StudioMap';
import { getProject, submitLead } from './studioApi';
import type { FloorPlan, StudioProject } from './types';

type Tab = 'tour' | 'area' | 'details';

export default function TourPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<StudioProject | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [tab, setTab] = useState<Tab>('tour');
  const [planId, setPlanId] = useState<string>('');

  useEffect(() => {
    let off = false;
    if (!id) { setState('missing'); return; }
    getProject(id)
      .then((p) => {
        if (off) return;
        if (!p) { setState('missing'); return; }
        setProject(p);
        setPlanId(p.plans.find((pl) => pl.walls.length)?.id || p.plans[0]?.id || '');
        setState('ready');
      })
      .catch(() => { if (!off) setState('missing'); });
    return () => { off = true; };
  }, [id]);

  useEffect(() => {
    if (project) document.title = `${project.name} · 3D tour`;
  }, [project]);

  const plan: FloorPlan | undefined = useMemo(() => project?.plans.find((p) => p.id === planId), [project, planId]);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm font-semibold text-stone-500">Loading tour…</div>;
  }
  if (state === 'missing' || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-50 px-6 text-center">
        <h1 className="font-serif text-2xl font-bold text-stone-900">This tour isn't available</h1>
        <p className="max-w-sm text-sm font-medium text-stone-500">The link may be wrong, or the builder has not published it yet.</p>
        <Link to="/" className="mt-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">Browse JGEstate</Link>
      </div>
    );
  }

  const isOwner = !!user && user.uid === project.ownerId;
  const hasLocation = typeof project.lat === 'number' && typeof project.lng === 'number';
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {!project.published && isOwner && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-900">
          Preview only. This tour is not published yet, so only you can see it.{' '}
          <Link to={`/studio/${project.id}`} className="underline">Back to Studio</Link>
        </div>
      )}

      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 sm:px-6">
          {project.developerName && <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-600">{project.developerName}</p>}
          <h1 className="font-serif text-2xl font-bold text-stone-900 sm:text-4xl">{project.name}</h1>
          <p className="text-sm font-medium text-stone-500">
            {[project.address, project.city].filter(Boolean).join(', ')}
            {project.reraId ? <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-600">RERA ID given by builder: {project.reraId}</span> : null}
          </p>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {([
            ['tour', '3D Tour'],
            ['area', 'Map & Neighborhood'],
            ['details', 'Details'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {tab === 'tour' && (
            <>
              {project.plans.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.plans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlanId(p.id)}
                      className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${p.id === planId ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100'}`}
                    >
                      {p.name || 'Unit type'}
                    </button>
                  ))}
                </div>
              )}
              {plan ? (
                <>
                  <Plan3DViewer plan={plan} className="h-[56vh] min-h-[320px] w-full" />
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-stone-700">
                    <span className="font-bold text-stone-900">{plan.name}</span>
                    {plan.bhk && <span>{plan.bhk}</span>}
                    {plan.areaSqft ? <span>{plan.areaSqft.toLocaleString('en-IN')} sq ft (as stated by the builder)</span> : null}
                  </div>
                  <p className="text-[11px] font-medium text-stone-400">
                    The 3D view is an approximate visualisation drawn from the builder's floor plan. Check the approved plan and your agreement for exact sizes and finishes.
                  </p>
                </>
              ) : (
                <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-stone-500 ring-1 ring-stone-200">No floor plans added yet.</div>
              )}
            </>
          )}

          {tab === 'area' &&
            (hasLocation ? (
              <StudioMap lat={project.lat!} lng={project.lng!} name={project.name} />
            ) : (
              <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-stone-500 ring-1 ring-stone-200">The builder has not set the map location yet.</div>
            ))}

          {tab === 'details' && (
            <div className="space-y-6">
              {project.description && <p className="text-base font-medium leading-relaxed text-stone-700">{project.description}</p>}
              {project.amenities.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-stone-400">Amenities</h2>
                  <div className="flex flex-wrap gap-2">
                    {project.amenities.map((a, i) => (
                      <span key={i} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200">{a}</span>
                    ))}
                  </div>
                </section>
              )}
              {project.plans.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-stone-400">Unit types</h2>
                  <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
                    {project.plans.map((p) => (
                      <button key={p.id} onClick={() => { setPlanId(p.id); setTab('tour'); }} className="flex w-full items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 text-left last:border-0 hover:bg-stone-50">
                        <span className="text-sm font-bold text-stone-800">{p.name}</span>
                        <span className="text-xs font-semibold text-stone-500">{[p.bhk, p.areaSqft ? `${p.areaSqft.toLocaleString('en-IN')} sq ft` : ''].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <EnquiryCard project={project} planName={plan?.name} disabled={!project.published} />
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard?.writeText(shareUrl)}
              className="flex-1 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100"
            >
              Copy link
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${project.name} – 3D tour: ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-full bg-emerald-600 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-emerald-700"
            >
              Share on WhatsApp
            </a>
          </div>
          <p className="text-center text-[11px] font-semibold text-stone-400">Tour made with <Link to="/" className="underline">JGEstate</Link></p>
        </aside>
      </main>
    </div>
  );
}

function EnquiryCard({ project, planName, disabled }: { project: StudioProject; planName?: string; disabled?: boolean }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) { setErr('Please enter your name.'); return; }
    if (!/^[+0-9()\-\s]{7,20}$/.test(form.phone.trim())) { setErr('Please enter a valid phone number.'); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setErr('That email looks wrong.'); return; }
    setErr('');
    setStatus('sending');
    try {
      await submitLead(project, { ...form, planName });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const contact = project.contactPhone || project.contactEmail;

  if (status === 'sent') {
    return (
      <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-stone-200">
        <p className="font-serif text-lg font-bold text-stone-900">Thank you</p>
        <p className="mt-1 text-sm font-medium text-stone-600">The builder's team has your details and will contact you.</p>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="font-serif text-lg font-bold text-stone-900">Interested? Ask the builder</h2>
      <input value={form.name} onChange={set('name')} placeholder="Your name" maxLength={80} className={input} />
      <input value={form.phone} onChange={set('phone')} placeholder="Phone number" inputMode="tel" maxLength={20} className={input} />
      <input value={form.email} onChange={set('email')} placeholder="Email (optional)" type="email" maxLength={120} className={input} />
      <textarea value={form.message} onChange={set('message')} placeholder={planName ? `I'm interested in ${planName}` : 'Message (optional)'} rows={3} maxLength={600} className={input} />
      <p className="text-[11px] font-medium leading-snug text-stone-400">By sending, you agree that {project.developerName || 'the builder'} may contact you about this project. Your details are shared only with them.</p>
      {err && <p className="text-xs font-bold text-brand-700">{err}</p>}
      {status === 'error' && <p className="text-xs font-bold text-brand-700">Could not send right now. Please try again{contact ? ` or contact ${project.contactPhone || project.contactEmail}` : ''}.</p>}
      <button disabled={disabled || status === 'sending'} className="w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
        {status === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>
      {disabled && <p className="text-[11px] font-semibold text-amber-700">Enquiries open once the tour is published.</p>}
      {contact && <p className="text-center text-xs font-semibold text-stone-500">Or contact: {[project.contactPhone, project.contactEmail].filter(Boolean).join(' · ')}</p>}
    </form>
  );
}

const input = 'w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200';
