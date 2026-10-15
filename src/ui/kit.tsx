import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { toVideoEmbed } from '../studio/media';

export const input = 'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';
export const label = 'mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-stone-400';
export const btnPrimary = 'inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50';
export const btnGhost = 'inline-flex items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-bold text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:opacity-50';
export const btnGold = 'btn-gold inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-extrabold';

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect x="3" y="12" width="9" height="17" rx="1.5" fill="#EFBF5A" />
        <rect x="12.5" y="4" width="9" height="25" rx="1.5" fill={light ? '#fff' : '#1F3A7A'} />
        <rect x="22" y="16" width="7" height="13" rx="1.5" fill="#F6D58B" />
        {[8, 12, 16, 20, 24].map((y) => <rect key={y} x="15" y={y} width="4" height="2" rx=".5" fill={light ? '#1F3A7A' : '#EFBF5A'} />)}
      </svg>
      <span className={`font-serif text-xl font-semibold tracking-tight ${light ? 'text-white' : 'text-brand-800'}`}>JGEstate</span>
    </Link>
  );
}

/** Fades + lifts its children in when scrolled into view. */
export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

/** Header for public pages. Sits over the dark hero by default. */
export function PublicHeader({ dark = true }: { dark?: boolean }) {
  const { user, openAuthModal } = useAuth();
  const txt = dark ? 'text-white/85 hover:text-white' : 'text-stone-700 hover:text-brand-700';
  return (
    <header className={`${dark ? 'absolute inset-x-0 top-0' : 'sticky top-0 border-b border-stone-200 bg-white/90 backdrop-blur'} z-30`}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <Logo light={dark} />
        <nav className="ml-auto flex items-center gap-4">
          <Link to="/tour/demo" className={`hidden text-sm font-bold sm:inline ${txt}`}>Sample tour</Link>
          {user ? (
            <Link to="/studio" className={dark ? btnGold.replace('px-6 py-3', 'px-5 py-2.5') : btnPrimary}>My dashboard</Link>
          ) : (
            <>
              <button onClick={() => openAuthModal('signin')} className={`text-sm font-bold ${txt}`}>Sign in</button>
              <Link to="/studio" className={dark ? btnGold.replace('px-6 py-3', 'px-5 py-2.5') : btnPrimary}>For builders</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function VideoList({ videos }: { videos?: string[] }) {
  const items = (videos || []).map((v) => ({ v, e: toVideoEmbed(v) })).filter((x) => x.e);
  if (!items.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(({ v, e }) => (
        <div key={v} className="overflow-hidden rounded-2xl bg-black ring-1 ring-stone-200">
          {e!.kind === 'iframe' && <iframe src={e!.src} title="Project video" className="aspect-video w-full" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
          {e!.kind === 'file' && <video src={e!.src} controls preload="metadata" className="aspect-video w-full" />}
          {e!.kind === 'link' && <a href={e!.src} target="_blank" rel="noopener noreferrer nofollow" className="flex aspect-video items-center justify-center bg-stone-900 px-4 text-center text-sm font-bold text-white underline">Watch video ↗</a>}
        </div>
      ))}
    </div>
  );
}
