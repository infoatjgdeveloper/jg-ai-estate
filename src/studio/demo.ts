import type { FloorPlan, PlanItem, StudioProject } from './types';
import { emptyPlan, planFromItem } from './geometry';

/** Built-in sample so anyone can preview a finished tour without an account or database. */
export const DEMO_ID = 'demo';

type R = [string, number, number, number, number]; // label, x, y, w, h  (metres)

function make(id: string, name: string, bhk: string, areaSqft: number, widthM: number, heightM: number, rooms: R[], floorFrom: number, floorTo: number): FloorPlan {
  const PPM = 50;
  const base = { ...emptyPlan(name, Math.round(widthM * PPM), Math.round(heightM * PPM)), id };
  const item: PlanItem = {
    name, bhk, areaSqft, overallWidthM: widthM, floorFrom, floorTo,
    rooms: rooms.map(([label, x, y, w, h]) => ({ label, x: x / widthM, y: y / heightM, w: w / widthM, h: h / heightM })),
    doors: [], windows: [],
  };
  const p = planFromItem(base, item);
  return { ...p, id, scaleConfirmed: true };
}

const oneBhk = make('demo-1bhk', '1 BHK - Type C', '1 BHK', 620, 7.4, 6, [
  ['Living', 0, 0, 4, 3.6], ['Kitchen', 0, 3.6, 2.4, 2.4], ['Balcony', 2.4, 3.6, 1.6, 2.4],
  ['Bedroom', 4, 0, 3.4, 3.6], ['Bath', 4, 3.6, 2, 2.4],
], 1, 8);

const twoBhk = make('demo-2bhk', '2 BHK - Type B', '2 BHK', 1050, 11.2, 8.8, [
  ['Living', 0, 0, 5.2, 4.4], ['Kitchen', 0, 4.4, 3, 3.2], ['Dining', 3, 4.4, 2.2, 3.2], ['Balcony', 0, 7.6, 5.2, 1.2],
  ['Master Bedroom', 5.2, 0, 3.8, 3.8], ['Bath', 9, 0, 2.2, 2.6], ['Pooja', 9, 2.6, 2.2, 1.2],
  ['Passage', 5.2, 3.8, 6, 1.2],
  ['Bedroom 2', 5.2, 5, 3.6, 3.8], ['Bath 2', 8.8, 5, 2.4, 2.4], ['Balcony 2', 8.8, 7.4, 2.4, 1.4],
], 3, 18);

const threeBhk = make('demo-3bhk', '3 BHK - Type A', '3 BHK', 1550, 12, 8.8, [
  ['Living', 0, 0, 5.6, 4.6], ['Dining', 0, 4.6, 3, 3], ['Kitchen', 3, 4.6, 2.6, 3], ['Balcony', 0, 7.6, 5.6, 1.2],
  ['Master Bedroom', 5.6, 0, 4, 4], ['Master Bath', 9.6, 0, 2.4, 2.6], ['Common Bath', 9.6, 2.6, 2.4, 1.4],
  ['Passage', 5.6, 4, 6.4, 1.1],
  ['Bedroom 2', 5.6, 5.1, 3.2, 3.7], ['Bedroom 3', 8.8, 5.1, 3.2, 3.7],
], 10, 18);

export const DEMO_PROJECT: StudioProject = {
  id: DEMO_ID,
  ownerId: 'demo',
  name: 'Skyline Heights (sample)',
  developerName: 'Sample Builders',
  address: 'SG Highway, Ahmedabad',
  city: 'Ahmedabad',
  lat: 23.0225,
  lng: 72.5714,
  description: 'A sample project so you can see how a brochure becomes a shareable 3D tour: pick a floor on the tower, choose a home and walk through it furnished. Layouts and details are made up.',
  amenities: ['Clubhouse', 'Swimming pool', 'Gym', 'Kids play area', 'Covered parking', '24x7 security', 'Landscaped garden'],
  highlights: ['5 min to metro station', 'On SG Highway', 'Schools within 1 km'],
  building: { floors: 18, towers: 2 },
  videos: [],
  published: true,
  plans: [oneBhk, twoBhk, threeBhk],
};
