import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Skyline from '../ui/Skyline';
import { PublicHeader, VideoList, Reveal } from '../ui/kit';
import { getBuilder, listPublishedProjects } from './studioApi';
import type { BuilderProfile, StudioProject } from './types';

export default function BuilderPage() {
  const { id = '' } = useParams();
  const [b, setB] = useState<BuilderProfile | null | undefined>(undefined);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  useEffect(() => {
    getBuilder(id).then((x) => setB(x && x.published ? x : null)).catch(() => setB(null));
    listPublishedProjects(id).then(setProjects).catch(() => {});
  }, [id]);
  if (b === undefined) return <div className="grid min-h-screen place-items-center bg-night text-sm font-bold text-white/70">Loading…</div>;
  if (!b) return <div className="grid min-h-screen place-items-center bg-night p-6 text-center text-white"><div><h1 className="font-serif text-3xl">Builder not found</h1><Link to="/" className="mt-4 inline-block font-bold text-gold-300">Back to JGEstate</Link></div></div>;
  const site = b.website && /^https?:\/\//i.test(b.website) ? b.website : b.website ? `https://${b.website}` : '';
  return (
    <div className="min-h-screen bg-stone-50">
      <section className="relative h-80 overflow-hidden bg-ink text-white">
        <Skyline /><PublicHeader />
        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-end px-5 pb-8 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-gold-300">Builder</p>
          <h1 className="font-serif text-4xl sm:text-5xl">{b.name}</h1>
          {b.tagline && <p className="mt-1 text-white/70">{b.tagline}</p>}
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-10 px-5 py-10 sm:px-6">
        <Reveal>
          <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
            <div>{b.about && <p className="whitespace-pre-line leading-relaxed text-stone-600">{b.about}</p>}</div>
            <div className="space-y-1.5 rounded-3xl bg-white p-5 text-sm font-semibold text-stone-600 ring-1 ring-stone-200">
              {(b.city || b.country) && <p>📍 {[b.city, b.country].filter(Boolean).join(', ')}</p>}
              {!!b.yearsInBusiness && <p>🏗 {b.yearsInBusiness} years in business</p>}
              {b.reraId && <p>RERA: {b.reraId} <span className="text-stone-400">(as given by the builder)</span></p>}
              {site && <p><a href={site} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-600 underline">Website ↗</a></p>}
            </div>
          </div>
        </Reveal>
        <Reveal>
          <h2 className="font-serif text-3xl text-brand-900">Projects</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Link key={p.id} to={`/tour/${p.id}`} className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg">
                <p className="font-serif text-2xl text-brand-900">{p.name}</p>
                <p className="text-sm text-stone-500">{[p.city, p.address].filter(Boolean).join(' · ')}</p>
                <p className="mt-3 text-xs font-extrabold text-brand-600">Enter the 3D tour →</p>
              </Link>
            ))}
            {!projects.length && <p className="text-sm font-semibold text-stone-400">No published projects yet.</p>}
          </div>
        </Reveal>
        {!!b.videos?.length && <Reveal><h2 className="mb-4 font-serif text-3xl text-brand-900">Videos</h2><VideoList videos={b.videos} /></Reveal>}
      </div>
    </div>
  );
}
