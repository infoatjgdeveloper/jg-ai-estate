import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import type { BrochureParse, BuilderProfile, PlanParse, StudioLead, StudioProject } from './types';

const PROJECTS = 'studioProjects';
const LEADS = 'studioLeads';
const BUILDERS = 'builderProfiles';

/** Firestore rejects `undefined`, so strip it before saving. */
const clean = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const millis = (v: any) => (v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0);

export async function listMyProjects(ownerId: string): Promise<StudioProject[]> {
  const snap = await getDocs(query(collection(db, PROJECTS), where('ownerId', '==', ownerId)));
  return snap.docs
    .map((d) => ({ ...(d.data() as StudioProject), id: d.id }))
    .sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
}

export async function getProject(id: string): Promise<StudioProject | null> {
  const snap = await getDoc(doc(db, PROJECTS, id));
  return snap.exists() ? ({ ...(snap.data() as StudioProject), id: snap.id }) : null;
}

export async function createProject(data: Omit<StudioProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const r = doc(collection(db, PROJECTS));
  await setDoc(r, { ...clean(data), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return r.id;
}

export async function saveProject(p: StudioProject) {
  const { id, createdAt, updatedAt, ...rest } = p;
  await setDoc(doc(db, PROJECTS, id), { ...clean(rest), createdAt: createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function deleteProject(id: string) {
  await deleteDoc(doc(db, PROJECTS, id));
}

/** Best-effort: the tracing image is a convenience, the project still works without it. */
export async function uploadPlanImage(ownerId: string, projectId: string, planId: string, dataUrl: string): Promise<string | undefined> {
  try {
    const r = ref(storage, `studio/${ownerId}/${projectId}/${planId}.jpg`);
    await uploadString(r, dataUrl, 'data_url');
    return await getDownloadURL(r);
  } catch (e) {
    console.warn('Plan image upload skipped:', e);
    return undefined;
  }
}

export async function submitLead(project: StudioProject, lead: { name: string; phone: string; email?: string; message?: string; planName?: string }) {
  if (project.id === 'demo') return; // sample tour: nothing is stored
  await addDoc(collection(db, LEADS), clean({
    projectId: project.id,
    ownerId: project.ownerId,
    projectName: project.name,
    name: lead.name.trim().slice(0, 80),
    phone: lead.phone.trim().slice(0, 30),
    email: lead.email?.trim().slice(0, 120) || undefined,
    message: lead.message?.trim().slice(0, 600) || undefined,
    planName: lead.planName?.slice(0, 80) || undefined,
    status: 'new',
    source: 'jgestate',
    refCode: 'JGE-' + project.id.slice(0, 4).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase(),
    createdAt: serverTimestamp(),
  }));
}

export async function listMyLeads(ownerId: string): Promise<StudioLead[]> {
  const snap = await getDocs(query(collection(db, LEADS), where('ownerId', '==', ownerId)));
  return snap.docs
    .map((d) => ({ ...(d.data() as StudioLead), id: d.id }))
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}

export async function setLeadStatus(id: string, status: 'new' | 'contacted' | 'closed') {
  await updateDoc(doc(db, LEADS, id), { status });
}

export const leadTime = (l: StudioLead) => {
  const ms = millis(l.createdAt);
  return ms ? new Date(ms).toLocaleString() : '';
};

// ---------- AI (server function) ----------

async function callAi<T>(task: 'brochure' | 'plan', images: string[]): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in first.');
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch('/api/parse-brochure', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ task, images }),
    });
  } catch {
    throw new Error('Could not reach the AI service. You can still add details and trace plans by hand.');
  }
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    throw new Error(body?.error || (res.status === 404 ? 'AI reading is not available in this environment.' : `AI service error (${res.status}).`));
  }
  return body as T;
}

export const parseBrochure = (images: string[]) => callAi<BrochureParse>('brochure', images);
export const parsePlan = (image: string) => callAi<PlanParse>('plan', [image]);

// ---------- Location ----------

export async function geocode(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = address.trim();
  if (q.length < 4) return null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j: any[] = await r.json();
    if (!j.length) return null;
    const lat = parseFloat(j[0].lat);
    const lng = parseFloat(j[0].lon);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat, lng, label: String(j[0].display_name || '') };
  } catch {
    return null;
  }
}

export type PlaceCategory = 'school' | 'health' | 'shopping' | 'transit' | 'food' | 'park' | 'bank';

export interface NearbyPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  meters: number;
}

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  school: 'Schools',
  health: 'Hospitals & clinics',
  shopping: 'Shopping',
  transit: 'Transit',
  food: 'Food & cafes',
  park: 'Parks',
  bank: 'Banks',
};

const toRad = (d: number) => (d * Math.PI) / 180;
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const formatMeters = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
/** About 80 m per minute walking, measured in a straight line (so real routes are longer). */
export const walkMinutes = (m: number) => Math.max(1, Math.round(m / 80));

const cache = new Map<string, NearbyPlace[]>();

/** Live OpenStreetMap lookup. Named places only, straight-line distance, nothing invented. */
export async function fetchNearby(lat: number, lng: number): Promise<NearbyPlace[]> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key)!;
  const q = `[out:json][timeout:20];(
    nwr["amenity"~"^(school|college|kindergarten)$"](around:2500,${lat},${lng});
    nwr["amenity"~"^(hospital|clinic|pharmacy)$"](around:3000,${lat},${lng});
    nwr["shop"~"^(supermarket|mall|department_store|convenience)$"](around:2500,${lat},${lng});
    nwr["railway"~"^(station|subway_entrance)$"](around:3500,${lat},${lng});
    nwr["public_transport"="station"](around:3000,${lat},${lng});
    nwr["highway"="bus_stop"]["name"](around:1000,${lat},${lng});
    nwr["amenity"~"^(restaurant|cafe)$"](around:1500,${lat},${lng});
    nwr["leisure"~"^(park|garden)$"](around:2000,${lat},${lng});
    nwr["amenity"~"^(bank|atm)$"](around:2000,${lat},${lng});
  );out center 400;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data: { elements: any[] } = await res.json();
  const seen = new Set<string>();
  const out: NearbyPlace[] = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    const name: string | undefined = t.name;
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (!name || typeof pLat !== 'number' || typeof pLng !== 'number') continue;
    let category: PlaceCategory | null = null;
    if (/^(school|college|kindergarten)$/.test(t.amenity)) category = 'school';
    else if (/^(hospital|clinic|pharmacy)$/.test(t.amenity)) category = 'health';
    else if (/^(supermarket|mall|department_store|convenience)$/.test(t.shop)) category = 'shopping';
    else if (t.railway || t.public_transport || t.highway === 'bus_stop') category = 'transit';
    else if (/^(restaurant|cafe)$/.test(t.amenity)) category = 'food';
    else if (/^(park|garden)$/.test(t.leisure)) category = 'park';
    else if (/^(bank|atm)$/.test(t.amenity)) category = 'bank';
    if (!category) continue;
    const dedupe = `${category}:${name.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ id: `${el.type}${el.id}`, name: name.slice(0, 80), category, lat: pLat, lng: pLng, meters: haversine(lat, lng, pLat, pLng) });
  }
  out.sort((a, b) => a.meters - b.meters);
  // Keep the closest few per category so the list stays readable.
  const counts: Record<string, number> = {};
  const trimmed = out.filter((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1;
    return counts[p.category] <= 4;
  });
  cache.set(key, trimmed);
  return trimmed;
}


// ---------- Builder profiles + public directory ----------

export async function getBuilder(id: string): Promise<BuilderProfile | null> {
  const snap = await getDoc(doc(db, BUILDERS, id));
  return snap.exists() ? ({ ...(snap.data() as BuilderProfile), id: snap.id }) : null;
}

export async function saveBuilder(b: BuilderProfile) {
  const { id, createdAt, updatedAt, ...rest } = b;
  await setDoc(doc(db, BUILDERS, id), { ...clean(rest), createdAt: createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function listBuilders(): Promise<BuilderProfile[]> {
  const snap = await getDocs(query(collection(db, BUILDERS), where('published', '==', true)));
  return snap.docs
    .map((d) => ({ ...(d.data() as BuilderProfile), id: d.id }))
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}

export async function listPublishedProjects(ownerId?: string): Promise<StudioProject[]> {
  const q = ownerId
    ? query(collection(db, PROJECTS), where('published', '==', true), where('ownerId', '==', ownerId))
    : query(collection(db, PROJECTS), where('published', '==', true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...(d.data() as StudioProject), id: d.id }))
    .sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
}
