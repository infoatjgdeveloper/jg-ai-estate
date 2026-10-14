/// <reference types="vite/client" />

// Builder Studio data model.
// Plan geometry is stored in the pixel space of the uploaded floor plan image
// (so the builder can trace over it) plus `pxPerMeter` to convert to real size.

export interface PlanWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PlanOpening {
  id: string;
  wallId: string;
  /** Position along the wall, 0..1 (centre of the opening) */
  t: number;
  /** Width in metres */
  width: number;
  type: 'door' | 'window';
}

export interface PlanRoomLabel {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface FloorPlan {
  id: string;
  /** Unit type shown to buyers, e.g. "3 BHK - Type A" */
  name: string;
  bhk?: string;
  areaSqft?: number;
  imageW: number;
  imageH: number;
  pxPerMeter: number;
  /** True once the builder set or confirmed the scale (AI/guessed scale is not trusted) */
  scaleConfirmed?: boolean;
  wallHeight: number;
  walls: PlanWall[];
  openings: PlanOpening[];
  rooms: PlanRoomLabel[];
  /** Firebase Storage URL of the page image (tracing aid), best-effort */
  imageUrl?: string;
}

export interface StudioProject {
  id: string;
  ownerId: string;
  ownerName?: string;
  name: string;
  developerName?: string;
  reraId?: string;
  address: string;
  city?: string;
  lat?: number;
  lng?: number;
  description?: string;
  amenities: string[];
  plans: FloorPlan[];
  contactPhone?: string;
  contactEmail?: string;
  published: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface StudioLead {
  id: string;
  projectId: string;
  ownerId: string;
  projectName: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  planName?: string;
  status?: 'new' | 'contacted' | 'closed';
  createdAt?: any;
}

/** What the AI endpoint returns for a brochure (all untrusted text). */
export interface BrochureParse {
  name?: string;
  developer?: string;
  address?: string;
  city?: string;
  reraId?: string;
  description?: string;
  amenities?: string[];
  units?: { name: string; bhk?: string; areaSqft?: number }[];
  /** 0-based page indexes the model thinks are floor plans */
  floorPlanPages?: number[];
}

/** What the AI endpoint returns for a single floor plan page (normalized 0..1 coords). */
export interface PlanParse {
  walls: { x1: number; y1: number; x2: number; y2: number }[];
  doors: { x: number; y: number; width?: number }[];
  windows: { x: number; y: number; width?: number }[];
  rooms: { label: string; x: number; y: number }[];
  overallWidthM?: number;
  areaSqft?: number;
  unitType?: string;
}
