import type { StudioProject } from './types';

/** Built-in sample so anyone can preview a finished tour without an account or database. */
export const DEMO_ID = 'demo';

const W = (id: string, x1: number, y1: number, x2: number, y2: number) => ({ id, x1, y1, x2, y2 });

export const DEMO_PROJECT: StudioProject = {
  id: DEMO_ID,
  ownerId: 'demo',
  name: 'Sample Residency (demo)',
  developerName: 'Sample Builder',
  address: 'SG Highway, Gujarat',
  city: 'Ahmedabad',
  lat: 23.0225,
  lng: 72.5714,
  description: 'This is a sample tour so you can see how a builder\'s brochure turns into a shareable 3D walkthrough. Floor plan and details are made up.',
  amenities: ['Clubhouse', 'Swimming pool', 'Gym', 'Kids play area', 'Covered parking', '24x7 security'],
  contactPhone: '',
  published: true,
  plans: [
    {
      id: 'demo-2bhk',
      name: '2 BHK - Type A',
      bhk: '2 BHK',
      areaSqft: 950,
      imageW: 550,
      imageH: 400,
      pxPerMeter: 50,
      scaleConfirmed: true,
      wallHeight: 3,
      walls: [
        W('o1', 0, 0, 550, 0), W('o2', 550, 0, 550, 400), W('o3', 550, 400, 0, 400), W('o4', 0, 400, 0, 0),
        W('d1', 300, 0, 300, 400),
        W('h1', 300, 200, 550, 200),
        W('h2', 0, 250, 300, 250),
        W('b1', 440, 200, 440, 400),
      ],
      openings: [
        { id: 'a1', wallId: 'o3', t: 0.8, width: 1.0, type: 'door' },
        { id: 'a2', wallId: 'd1', t: 0.3, width: 0.9, type: 'door' },
        { id: 'a3', wallId: 'd1', t: 0.85, width: 0.9, type: 'door' },
        { id: 'a4', wallId: 'h2', t: 0.5, width: 1.0, type: 'door' },
        { id: 'a5', wallId: 'b1', t: 0.3, width: 0.8, type: 'door' },
        { id: 'w1', wallId: 'o1', t: 0.3, width: 1.8, type: 'window' },
        { id: 'w2', wallId: 'o1', t: 0.75, width: 1.5, type: 'window' },
        { id: 'w3', wallId: 'o4', t: 0.3, width: 1.5, type: 'window' },
        { id: 'w4', wallId: 'o2', t: 0.8, width: 1.5, type: 'window' },
        { id: 'w5', wallId: 'o3', t: 0.35, width: 1.2, type: 'window' },
      ],
      rooms: [
        { id: 'r1', label: 'Living', x: 150, y: 125 },
        { id: 'r2', label: 'Kitchen', x: 150, y: 325 },
        { id: 'r3', label: 'Master bedroom', x: 425, y: 100 },
        { id: 'r4', label: 'Bedroom 2', x: 370, y: 300 },
        { id: 'r5', label: 'Bath', x: 495, y: 300 },
      ],
    },
  ],
};
