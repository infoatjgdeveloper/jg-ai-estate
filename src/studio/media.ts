/** Turn a pasted video link into something we can embed safely. Unknown links stay plain links. */
export type VideoEmbed = { kind: 'iframe' | 'file' | 'link'; src: string };

export function toVideoEmbed(raw: string): VideoEmbed | null {
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  let yt = '';
  if (host === 'youtu.be') yt = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (u.pathname === '/watch') yt = u.searchParams.get('v') || '';
    else if (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/')) yt = u.pathname.split('/')[2] || '';
  }
  if (/^[\w-]{6,15}$/.test(yt)) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt}` };
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (/^\d+$/.test(id || '')) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u.pathname + u.search)) return { kind: 'file', src: url };
  return { kind: 'link', src: url };
}

export const splitLines = (s: string) => s.split(/\n+/).map((x) => x.trim()).filter(Boolean);
