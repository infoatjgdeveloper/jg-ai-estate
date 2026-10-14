import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBuilders, listPublishedProjects } from './studioApi';
import { DEMO_PROJECT } from './demo';
import { PublicHeader, btnPrimary, input } from './ui';
import type { BuilderProfile, StudioProject } from './types';

export function ProjectCard({ p, builderName }: { p: StudioProject; builderName?: string }) {
  const types = Array.from(new Set(p.plans.map((x) => x.bhk).filter(Boolean)));
  return (
    <Link to={`/tour/${p.id}`} className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-stone-200 transition-shadow hover:shadow-lg">
      <span className="w-fit rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-700">3D tour</span>
      <h3 className="mt-3 font-serif text-lg font-bold text-stone-900 group-hover:text-brand-700">{p.name}</h3>
      {(builderName || p.developerName) && <p className="text-xs font-bold text-stone-500">{builderName || p.developerName}</p>}
      <p className="mt-1 line-clamp-1 text-xs font-medium text-stone-500">{[p.city, p.address].filter(Boolean).join(' · ')}</p>
      <p className="mt-3 text-xs font-semibold text-stone-600">{types.length ? types.join(' · ') : `${p.plans.length} floor plan${p.plans.length === 1 ? '' : 's'}`}</p>
      <span className="mt-4 text-xs font-extrabold text-brand-700">Walk through →</span>
    </Link>
  );
}

export function BuilderCard({ b, count }: { b: BuilderProfile; count: number }) {
  return (
    <Link to={`/builders/${b.id}`} className="group flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 transition-shadow hover:shadow-lg">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 font-serif text-xl font-bold text-brand-700">
        {b.logoUrl ? <img src={b.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : b.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-serif text-lg font-bold text-stone-900 group-hover:text-brand-700">{b.name}</h3>
        <p className="truncate text-xs font-medium text-stone-500">{[b.city, b.country].filter(Boolean).join(', ') || 'Builder'}</p>
        {b.tagline && <p className="mt-1 line-clamp-2 text-xs font-medium text-stone-600">{b.tagline}</p>}
        <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wider text-stone-400">{count} live project{count === 1 ? '' : 's'}</p>
      </div>
    </Link>
  );
}

export default function Directory() {
  const [builders, setBuilders] = useState<BuilderProfile[] | null>(null);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    document.title = 'JGEstate · Explore new projects in 3D';
    Promise.all([listBuilders(), listPublishedProjects()])
      .then(([b, p]) => { setBuilders(b); setProjects(p); })
      .catch((e) => { console.warn(e); setBuilders([]); });
  }, []);

  const names = useMemo(() => new Map((builders || []).map((b) => [b.id, b.name])), [builders]);
  const needle = q.trim().toLowerCase();
  const fp = projects.filter((p) => !needle || [p.name, p.city, p.address, p.developerName, names.get(p.ownerId)].join(' ').toLowerCase().includes(needle));
  const fb = (builders || []).filter((b) => !needle || [b.name, b.city, b.country].join(' ').toLowerCase().includes(needle));
  const countFor = (id: string) => projects.filter((p) => p.ownerId === id).length;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <PublicHeader />
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-600">Builder showcase</p>
          <h1 className="mt-2 max-w-3xl font-serif text-3xl font-bold leading-tight text-stone-900 sm:text-5xl">Walk through new projects in 3D before you visit.</h1>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-stone-600 sm:text-base">
            See each builder's floor plans in 3D, watch their project videos, check what is nearby on the map, and send your question straight to the builder.
          </p>
          <div className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search builder, project or city" className={input} />
            <Link to="/tour/demo" className={`${btnPrimary} text-center`}>See a sample tour</Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        {builders === null ? (
          <p className="text-sm font-semibold text-stone-500">Loading…</p>
        ) : (
          <>
            <section>
              <h2 className="mb-4 font-serif text-2xl font-bold text-stone-900">Projects with a 3D tour</h2>
              {fp.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fp.map((p) => <ProjectCard key={p.id} p={p} builderName={names.get(p.ownerId)} />)}</div>
              ) : (
                <div className="rounded-2xl bg-white p-8 ring-1 ring-stone-200">
                  <p className="text-sm font-semibold text-stone-600">{needle ? 'Nothing matches that search.' : 'No builders have published a tour yet. Here is a sample so you can see how it works:'}</p>
                  {!needle && <div className="mt-4 max-w-sm"><ProjectCard p={DEMO_PROJECT} builderName="Sample Builder" /></div>}
                </div>
              )}
            </section>

            {fb.length > 0 && (
              <section>
                <h2 className="mb-4 font-serif text-2xl font-bold text-stone-900">Builders</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fb.map((b) => <BuilderCard key={b.id} b={b} count={countFor(b.id)} />)}</div>
              </section>
            )}

            <section className="rounded-3xl bg-stone-900 p-8 text-white sm:p-10">
              <h2 className="font-serif text-2xl font-bold sm:text-3xl">Are you a builder?</h2>
              <p className="mt-2 max-w-xl text-sm font-medium text-stone-300">Create your profile, upload your brochure, and get a shareable 3D tour page. Enquiries land in your dashboard.</p>
              <Link to="/studio" className="mt-5 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-bold text-stone-900 hover:bg-stone-200">List your projects</Link>
            </section>
          </>
        )}
      </main>
      <footer className="border-t border-stone-200 bg-white px-4 py-6 text-center text-[11px] font-medium text-stone-400">
        JGEstate shows information provided by builders. 3D views are approximate. Always check approved plans and agreements before you decide.
      </footer>
    </div>
  );
}
