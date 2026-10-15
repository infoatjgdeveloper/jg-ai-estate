import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Skyline from '../ui/Skyline';
import { btnGold, Logo, PublicHeader, Reveal } from '../ui/kit';
import { listBuilders, listPublishedProjects } from './studioApi';
import type { BuilderProfile, StudioProject } from './types';
import { useAuth } from '../AuthContext';

const STEPS = [
  { n: '1', t: 'Upload your brochure', d: 'Drop in the PDF you already have. That’s all we need.' },
  { n: '2', t: 'AI builds the tower', d: 'We read every floor plan and build your building and furnished homes in 3D.' },
  { n: '3', t: 'Share one link', d: 'Buyers pick a floor, step inside a home and enquire straight to you.' },
];

export default function Home() {
  const { user, openAuthModal } = useAuth();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [builders, setBuilders] = useState<BuilderProfile[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    listPublishedProjects().then(setProjects).catch(() => {});
    listBuilders().then(setBuilders).catch(() => {});
  }, []);
  const term = q.trim().toLowerCase();
  const fp = useMemo(() => projects.filter((p) => !term || `${p.name} ${p.city} ${p.developerName} ${p.address}`.toLowerCase().includes(term)), [projects, term]);
  const fb = useMemo(() => builders.filter((b) => !term || `${b.name} ${b.city}`.toLowerCase().includes(term)), [builders, term]);

  return (
    <div className="bg-stone-50">
      <section className="relative min-h-[100svh] overflow-hidden bg-ink text-white">
        <Skyline />
        <PublicHeader />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-5 pb-40 pt-28 sm:px-6">
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-gold-300 ring-1 ring-white/15 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" /> 3D showcase for builders
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }} className="max-w-3xl font-serif text-5xl font-medium leading-[1.05] sm:text-7xl">
            Turn a brochure into a <span className="gold-text">walkable 3D&nbsp;tower</span>.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="mt-5 max-w-xl text-lg font-medium text-white/70">
            Upload your brochure. We build the whole building, every floor plan furnished — buyers choose a floor and walk through their future home.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-wrap gap-3">
            <Link to="/tour/demo" className={btnGold}>▶ See a live 3D tour</Link>
            {user ? <Link to="/studio" className="inline-flex items-center rounded-full bg-white/10 px-6 py-3 text-sm font-extrabold ring-1 ring-white/25 backdrop-blur hover:bg-white/20">Open my dashboard</Link>
              : <button onClick={() => openAuthModal('signup')} className="inline-flex items-center rounded-full bg-white/10 px-6 py-3 text-sm font-extrabold ring-1 ring-white/25 backdrop-blur hover:bg-white/20">I’m a builder — start free</button>}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <Reveal><h2 className="text-center font-serif text-4xl text-brand-900">Three steps. That’s it.</h2></Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="h-full rounded-3xl bg-white p-7 ring-1 ring-stone-200">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-night font-serif text-xl text-gold-300">{s.n}</span>
                <h3 className="mt-4 font-serif text-2xl text-brand-900">{s.t}</h3>
                <p className="mt-2 text-stone-500">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-serif text-4xl text-brand-900">Explore projects</h2>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search builder, project or city" className="w-full rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:w-80" />
          </div>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card to="/tour/demo" title="Skyline Heights (sample)" sub="Ahmedabad · Sample Builders" tag="Demo tour" />
          {fp.map((p) => <Card key={p.id} to={`/tour/${p.id}`} title={p.name} sub={[p.city, p.developerName].filter(Boolean).join(' · ')} tag={p.plans.length ? `${p.plans.length} home types` : 'New'} />)}
        </div>
        {!!fb.length && (
          <>
            <h3 className="mt-14 font-serif text-3xl text-brand-900">Builders</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fb.map((b) => (
                <Link key={b.id} to={`/builders/${b.id}`} className="rounded-3xl bg-white p-5 ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <p className="font-serif text-xl text-brand-900">{b.name}</p>
                  <p className="text-sm text-stone-500">{[b.city, b.country].filter(Boolean).join(', ')}</p>
                  {b.tagline && <p className="mt-2 line-clamp-2 text-sm text-stone-600">{b.tagline}</p>}
                </Link>
              ))}
            </div>
          </>
        )}
        {!projects.length && <p className="mt-8 text-center text-sm font-semibold text-stone-400">New builders are joining — be the first to publish your tower.</p>}
      </section>

      <section className="relative overflow-hidden bg-ink px-5 py-20 text-center text-white">
        <Skyline className="opacity-60" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="font-serif text-4xl sm:text-5xl">Show your project like <span className="gold-text">nobody else</span>.</h2>
          <p className="mt-4 text-white/65">Free to list. Enquiries land in your dashboard, tagged from JGEstate.</p>
          <button onClick={() => (user ? (window.location.href = '/studio') : openAuthModal('signup'))} className={`${btnGold} mt-7`}>Create my builder page</button>
        </div>
      </section>
      <footer className="bg-ink px-5 py-8 text-center text-xs font-semibold text-white/40"><div className="mb-2 flex justify-center"><Logo /></div>© JGEstate · 3D views are approximate visualisations from builder brochures.</footer>
    </div>
  );
}

function Card({ to, title, sub, tag }: { to: string; title: string; sub: string; tag: string }) {
  return (
    <Link to={to} className="group relative overflow-hidden rounded-3xl bg-ink ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="relative h-44 overflow-hidden"><Skyline /><span className="absolute left-4 top-4 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-extrabold text-night">{tag}</span></div>
      <div className="p-5 text-white"><p className="font-serif text-xl">{title}</p><p className="text-sm text-white/60">{sub}</p><p className="mt-3 text-xs font-extrabold text-gold-300 transition group-hover:translate-x-1">Enter the 3D tour →</p></div>
    </Link>
  );
}
