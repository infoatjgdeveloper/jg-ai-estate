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

export type RoomKind =
  | 'living' | 'bedroom' | 'master' | 'kitchen' | 'dining' | 'bath' | 'balcony'
  | 'study' | 'pooja' | 'utility' | 'hall' | 'other';

export interface PlanRoomLabel {
  id: string;
  label: string;
  x: number;
  y: number;
  kind?: RoomKind;
  /** Room rectangle in plan pixels (top-left + size). Present when read by AI from room outlines. */
  box?: { x: number; y: number; w: number; h: number };
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
  /** Tracing aid. Only kept in the builder's session (not stored in the database). */
  imageUrl?: string;
  /** Floors this unit type is on, for the building view (e.g. 3 to 18). Empty = all floors. */
  floorFrom?: number;
  floorTo?: number;
  /** Built-up or carpet area as printed in the brochure */
  facing?: string;
}

export interface BuildingInfo {
  floors: number;
  towers?: number;
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
  building?: BuildingInfo;
  contactPhone?: string;
  contactEmail?: string;
  /** Video links (YouTube, Vimeo or direct mp4) */
  videos?: string[];
  /** Short selling points shown on the tour page, e.g. "5 min to metro" */
  highlights?: string[];
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
  /** Attribution: every enquiry comes through JGEstate */
  source?: string;
  refCode?: string;
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
  /** Tower / building facts as printed */
  floors?: number;
  towers?: number;
  units?: { name: string; bhk?: string; areaSqft?: number; floorFrom?: number; floorTo?: number }[];
  /** 0-based page indexes the model thinks are floor plans */
  floorPlanPages?: number[];
}

export interface PlanRoomParse {
  label: string;
  kind?: RoomKind;
  /** Normalized 0..1 rectangle of the room on the page */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One unit layout read from a page (a page may hold several). Coordinates are normalized 0..1. */
export interface PlanItem {
  name?: string;
  bhk?: string;
  areaSqft?: number;
  overallWidthM?: number;
  floorFrom?: number;
  floorTo?: number;
  rooms: PlanRoomParse[];
  doors: { x: number; y: number; width?: number }[];
  windows: { x: number; y: number; width?: number }[];
}

export interface PlanParse {
  plans: PlanItem[];
}

/** A builder's public profile. Document id is the builder's auth uid. */
export interface BuilderProfile {
  id: string;
  ownerId: string;
  name: string;
  tagline?: string;
  about?: string;
  city?: string;
  country?: string;
  website?: string;
  phone?: string;
  email?: string;
  reraId?: string;
  yearsInBusiness?: number;
  logoUrl?: string;
  videos?: string[];
  agreedTermsAt?: any;
  published: boolean;
  createdAt?: any;
  updatedAt?: any;
}
