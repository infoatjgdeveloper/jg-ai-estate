import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { toVideoEmbed } from './media';

export const input = 'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-200';
export const label = 'mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-stone-400';
export const btnPrimary = 'rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50';
export const btnGhost = 'rounded-full bg-white px-4 py-2.5 text-sm font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50';

/** Header for the public pages (directory, builder profile). */
export function PublicHeader() {
  const { user, openAuthModal } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="font-serif text-xl font-bold text-brand-700">JGEstate</Link>
        <nav className="ml-auto flex items-center gap-2">
          <Link to="/tour/demo" className="hidden text-sm font-bold text-stone-600 hover:text-brand-700 sm:inline">Sample tour</Link>
          {user ? (
            <Link to="/studio" className={btnPrimary}>Builder dashboard</Link>
          ) : (
            <>
              <button onClick={() => openAuthModal('signin')} className="text-sm font-bold text-stone-700 hover:text-brand-700">Sign in</button>
              <Link to="/studio" className={btnPrimary}>For builders</Link>
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
          {e!.kind === 'iframe' && (
            <iframe src={e!.src} title="Project video" className="aspect-video w-full" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          )}
          {e!.kind === 'file' && <video src={e!.src} controls preload="metadata" className="aspect-video w-full" />}
          {e!.kind === 'link' && (
            <a href={e!.src} target="_blank" rel="noopener noreferrer nofollow" className="flex aspect-video items-center justify-center bg-stone-900 px-4 text-center text-sm font-bold text-white underline">Watch video ↗</a>
          )}
        </div>
      ))}
    </div>
  );
}
