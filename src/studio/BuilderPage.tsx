import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBuilder, listPublishedProjects } from './studioApi';
import { ProjectCard } from './Directory';
import { PublicHeader, VideoList } from './ui';
import type { BuilderProfile, StudioProject } from './types';

export default function BuilderPage() {
  const { id } = useParams();
  const [b, setB] = useState<BuilderProfile | null>(null);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!id) { setState('missing'); return; }
    Promise.all([getBuilder(id), listPublishedProjects(id)])
      .then(([bp, ps]) => {
        if (!bp) { setState('missing'); return; }
        setB(bp); setProjects(ps); setState('ready');
        document.title = `${bp.name} · JGEstate`;
      })
      .catch(() => setState('missing'));
  }, [id]);

  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm font-semibold text-stone-500">Loading…</div>;
  if (state === 'missing' || !b) {
    return (
      <div className="min-h-screen bg-stone-50"><PublicHeader />
        <div className="mx-auto mt-20 max-w-md px-6 text-center">
          <h1 className="font-serif text-2xl font-bold text-stone-900">Builder not found</h1>
          <Link to="/" className="mt-4 inline-block text-sm font-bold text-brand-700 underline">Back to all builders</Link>
        </div>
      </div>
    );
  }

  const link = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : u ? `https://${u}` : '');
  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <PublicHeader />
      <section className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 font-serif text-3xl font-bold text-brand-700">
            {b.logoUrl ? <img src={b.logoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : b.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-bold text-stone-900 sm:text-4xl">{b.name}</h1>
            {b.tagline && <p className="mt-1 text-sm font-medium text-stone-600">{b.tagline}</p>}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-500">
              {[b.city, b.country].filter(Boolean).length > 0 && <span>{[b.city, b.country].filter(Boolean).join(', ')}</span>}
              {b.yearsInBusiness ? <span>{b.yearsInBusiness}+ years in business</span> : null}
              {b.reraId ? <span>RERA ID given by builder: {b.reraId}</span> : null}
              {b.website && <a href={link(b.website)} target="_blank" rel="noopener noreferrer nofollow" className="underline">Website</a>}
            </p>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        {b.about && <section><h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-stone-400">About</h2><p className="max-w-3xl whitespace-pre-line text-sm font-medium leading-relaxed text-stone-700">{b.about}</p></section>}
        <section>
          <h2 className="mb-4 font-serif text-2xl font-bold text-stone-900">Projects</h2>
          {projects.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} p={p} builderName={b.name} />)}</div>
          ) : <p className="rounded-2xl bg-white p-6 text-sm font-semibold text-stone-500 ring-1 ring-stone-200">No live projects yet.</p>}
        </section>
        {b.videos && b.videos.length > 0 && <section><h2 className="mb-4 font-serif text-2xl font-bold text-stone-900">Videos</h2><VideoList videos={b.videos} /></section>}
        <p className="text-[11px] font-medium text-stone-400">To ask a question, open a project and use the enquiry form. Your message goes to the builder through JGEstate.</p>
      </main>
    </div>
  );
}
