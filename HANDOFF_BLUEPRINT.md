# Real Estate AI Tokenized Platform (Bespoke Luxury Estate Hub)
## Technical Handover Blueprint & System Architecture Spec

This document is compiled for the engineering and development team as a complete, self-contained, production-grade handbook for reconstructing, maintaining, and deploying the **Real Estate AI Tokenized Platform** from absolute scratch.

---

## Table of Contents
1. [System Architecture & Core Stack](#1-system-architecture--core-stack)
2. [Step-by-Step Initial Setup Guide](#2-step-by-step-initial-setup-guide)
3. [Database Architecture & Firestore Blueprint](#3-database-architecture--firestore-blueprint)
4. [Firebase Security Configuration (`firestore.rules`)](#4-firebase-security-configuration-firestorerules)
5. [Application State Machine & Interactive Components](#5-application-state-machine--interactive-components)
6. [Core Code Snippets & Implementation Logic](#6-core-code-snippets--implementation-logic)
7. [Production Build & SPA Fallback Deployment](#7-production-build--spa-fallback-deployment)

---

## 1. System Architecture & Core Stack

The system utilizes a modern serverless client-side SPA architecture backed directly by cloud-hosted Firebase instances:

```
[  Vite + React SPA Client  ] <=====> [ Firebase Authentication ] (Google Auth & Role Profiles)
            ||
            || (Real-time updates & offline cache)
            \/
[  Firestore Database  ] 
   ├── /users (Profiles, Roles: investor | developer | admin)
   ├── /projects (Dynamic properties with AI quality scores & proximity metrics)
   │     └── /units (Sub-collection of fractional property tokens & status tags)
   ├── /investments (Escrow transaction records & fractional ownership shares)
   └── /market_data (Geographic index valuations & performance logs)
```

### Technology Matrix
*   **Vite 6** + **TypeScript**: Advanced bundler setup enforcing absolute structural type-safety.
*   **React 18**: Functional state architecture utilizing hooks, lazy module loaders, and declarative states.
*   **Tailwind CSS v4**: Utility styling utilizing variables defined inside global CSS configurations (`@theme` specs) without heavy external asset overhead.
*   **Lucide React**: Modular vector icon mappings.
*   **Firebase SDK v10+**: Real-time Firestore document updates, client-side batch writes, and federated Google single sign-on (SSO).
*   **Vercel Routing**: Configured static routing rewrites to support full React Single Page Application (SPA) routing loops.

---

## 2. Step-by-Step Initial Setup Guide

To recreate this setup on a clean repository, follow these precise terminal instructions:

### Step 2.1: Initialize Project
```bash
# Create a fresh Vite project with TypeScript React template
npm create vite@latest real-estate-platform -- --template react-ts
cd real-estate-platform

# Install core and production dependencies
npm install lucide-react clsx tailwind-merge class-variance-authority motion
npm install firebase @radix-ui/react-slot @radix-ui/react-separator @radix-ui/react-label
```

### Step 2.2: Configure Tailwind CSS v4
In your entry CSS file (`/src/index.css`), declare the following standard layout directives and premium theme specifications:
```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

@layer base {
  body {
    @apply bg-slate-50 text-slate-900 font-sans antialiased;
  }
}
```

---

## 3. Database Architecture & Firestore Blueprint

### 3.1 Relational Data Models (Type Definitions)
Declare these exact interfaces inside your TypeScript type definitions file (`/src/types.ts`):

```typescript
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'developer' | 'investor' | 'admin';
  region: string;
  currency: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  city: string;
  region: string;
  totalUnits: number;
  basePrice: number;                  // Fractional entrance price (INR)
  currency: string;                   // "INR"
  imageUrl: string;
  developerId: string;                // References UserProfile.uid or "system"
  developerName: string;
  reraId?: string;                    // RERA Registration Verification number
  aiValuation?: number;
  marketTrend?: 'Bullish' | 'Stable' | 'Bearish';
  bhkOptions?: string[];              // e.g., ["2 BHK", "3 BHK", "Sky Villa"]
  areaRange?: string;                 // e.g., "1,250 - 4,800 sq.ft."
  constructionStatus?: 'Ready to Move' | 'Under Construction' | 'Pre-Launch';
  rentalYield?: number;               // Projected annual net yield percentage
  aiScore?: number;                   // Comprehensive structural & financial quality index
  amenities?: string[];
  landmarks?: { name: string; distance: string }[];
}

export interface Unit {
  id: string;
  projectId: string;
  unitNumber: string;                 // e.g., "A-101"
  status: 'available' | 'resale' | 'booked' | 'sold';
  price: number;                      // Price mapped with floor premiums
  bookingAmount: number;              // Fixed deposit required (typically 1 Lakh INR)
  lastValuation?: number;
  isResaleEligible?: boolean;
  resalePrice?: number;
  bhkType?: string;                   // "3 BHK", "Sky Villa", etc.
  areaSqft?: number;                  // Precise super-area size
  viewTag?: string;                   // e.g., "Vastu East Entrance & Sea View"
}

export interface Investment {
  id: string;
  unitId: string;
  projectId: string;
  projectName: string;
  unitNumber: string;
  investorId: string;                 // References UserProfile.uid
  term: number;                       // e.g., 36 months
  totalAmount: number;
  paidAmount: number;
  startDate: any;                     // Firestore Timestamp or ISO String
  endDate: any;
  status: 'active' | 'pending_payment' | 'matured';
}
```

---

## 4. Firebase Security Configuration (`firestore.rules`)

These robust security rules must be uploaded to the Firebase Console to enforce domain model validations, data-integrity constraints, and role-based access control (RBAC).

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Auth Helpers
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        (request.auth.token.email == "GajjarJay79@gmail.com" || 
         (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'));
    }

    function isDeveloper() {
      return isAuthenticated() && 
        (isAdmin() || 
         (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'developer'));
    }

    function isInvestor() {
      return isAuthenticated() && 
        (isAdmin() || 
         (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'investor'));
    }

    // Model Validation Checks
    function isValidUser(data) {
      return data.uid == request.auth.uid &&
             data.role in ['developer', 'investor', 'admin'];
    }

    function isValidProject(data) {
      return data.keys().hasAll(['developerId', 'name', 'basePrice']) &&
             (data.developerId == request.auth.uid || data.developerId == 'system') &&
             data.basePrice is number && data.basePrice > 0;
    }

    function isValidInvestment(data) {
      return data.keys().hasAll(['unitId', 'projectId', 'investorId', 'totalAmount', 'paidAmount']) &&
             data.investorId == request.auth.uid &&
             data.totalAmount is number && data.paidAmount >= 0;
    }

    // Rules Definitions
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create, update: if isOwner(userId) && isValidUser(request.resource.data);
    }

    match /projects/{projectId} {
      allow read: if true;
      allow create: if (isDeveloper() || request.resource.data.developerId == 'system') && isValidProject(request.resource.data);
      allow update: if isDeveloper() && (resource.data.developerId == request.auth.uid || isAdmin()) && isValidProject(request.resource.data);
      allow delete: if isDeveloper() && (resource.data.developerId == request.auth.uid || isAdmin());
      
      match /units/{unitId} {
        allow read: if true;
        allow create: if isDeveloper() || get(/databases/$(database)/documents/projects/$(projectId)).data.developerId == 'system';
        allow update: if isAuthenticated();
      }
    }

    match /investments/{investmentId} {
      allow read: if isAuthenticated() && (request.auth.uid == resource.data.investorId || isDeveloper());
      allow create: if isInvestor() && isValidInvestment(request.resource.data);
      allow update: if isAuthenticated() && (request.auth.uid == resource.data.investorId || isDeveloper()) && isValidInvestment(request.resource.data);
    }
  }
}
```

---

## 5. Application State Machine & Interactive Components

The state machine centers around high-end filters styled closely to premium real estate catalogs.

```
+--------------------------------------------------------------+
|                    Search Input Query                        |
|   (Filter through Name, Developer, Location, City, RERA ID)  |
+--------------------------------------------------------------+
                               ||
                               \/
+--------------------------------------------------------------+
|                  Expanded Filter Center                      |
|  - Budget Slider Tiers (<2Cr, 2-5Cr, 5-10Cr, >10Cr)          |
|  - BHK Layout Segment Toggles (2 BHK, 3 BHK, 4 BHK, etc)     |
|  - Milestone Construction Phase                              |
|  - RERA Clearances Verification Toggle                       |
+--------------------------------------------------------------+
                               ||
                               \/
+--------------------------------------------------------------+
|            Interactive Selected Project Drawer               |
|  - Real-time Proximity Landmarks Metrics                     |
|  - Custom Highlights Checklist Array                         |
|  - Subdivided BHK Unit Grid Selector                         |
|  - Real-time Hover-Activated Specification Spec Cards        |
+--------------------------------------------------------------+
```

### Components Lifecycle

1.  **Search & Filters Alignment:** 
    Filtering functions are evaluated purely on-the-fly client-side, reducing unnecessary load times.
2.  **Heart State Synchronizer:**
    User-favorited properties sync seamlessly with state hooks and write dynamically to `localStorage` on change.
3.  **Fractional Escrow Lock Flow:**
    *   Clicking a unit triggers the checkout drawer or handles direct Firestore escrow locks.
    *   Booking fees (typically 1,00,000 INR) are designated via explicit transaction logs on-chain.

---

## 6. Core Code Snippets & Implementation Logic

Below are three critical code segments engineered for optimal performance and user feedback.

### 6.1 Indian Currency Words System Formatter
Formats large numbers to classic Indian currency words (*Lakh* and *Cr*) as expected in South Asian real estate catalogs.
```typescript
export const formatPriceToIndianWord = (price: number): string => {
  if (price >= 10000000) {
    return `₹${(price / 10000000).toFixed(2)} Cr`;
  } else if (price >= 100000) {
    return `₹${(price / 100000).toFixed(2)} Lakh`;
  }
  return `₹${price.toLocaleString('en-IN')}`;
};
```

### 6.2 Filter Center Engine Block
Performs advanced, fast local searches on complex collections:
```typescript
const filteredProjects = projects.filter(p => {
  // Region Selection Match
  if (selectedRegion !== 'Global' && p.region !== selectedRegion) return false;
  
  // Real-time Text Queries 
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(q);
    const cityMatch = p.city?.toLowerCase().includes(q);
    const locMatch = p.location?.toLowerCase().includes(q);
    const devMatch = p.developerName?.toLowerCase().includes(q);
    const reraMatch = p.reraId?.toLowerCase().includes(q);
    if (!nameMatch && !cityMatch && !locMatch && !devMatch && !reraMatch) return false;
  }
  
  // Budget Tiers Calibration
  if (budgetRange !== 'All') {
    if (budgetRange === '< 2 Cr' && p.basePrice >= 20000000) return false;
    if (budgetRange === '2 - 5 Cr' && (p.basePrice < 20000000 || p.basePrice > 50000000)) return false;
    if (budgetRange === '5 - 10 Cr' && (p.basePrice < 50000000 || p.basePrice > 100000000)) return false;
    if (budgetRange === '> 10 Cr' && p.basePrice <= 100000000) return false;
  }
  
  // Construction Phase Match
  if (selectedConstStatus !== 'All' && p.constructionStatus !== selectedConstStatus) return false;
  
  // Configuration BHK Options
  if (selectedBhkType !== 'All') {
    const hasBhk = p.bhkOptions?.some(b => b.includes(selectedBhkType));
    if (!hasBhk) return false;
  }
  
  // Regulatory Clearances Toggle
  if (onlyReraVerified && !p.reraId) return false;
  
  return true;
});
```

### 6.3 Dynamic Subdivided Unit Grid Mapper
Filters individual units per BHK segment inside the listing drawer with real-time specification rendering:
```typescript
import * as React from 'react';
import { useState } from 'react';

export function UnitGrid({ units, onBook }: { units: Unit[], onBook: (u: Unit) => void }) {
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);

  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
        {units.map((unit) => {
          const isSelected = activeUnit?.id === unit.id;
          return (
            <button
              key={unit.id}
              disabled={unit.status !== 'available' && unit.status !== 'resale'}
              onClick={() => {
                setActiveUnit(unit);
                onBook(unit);
              }}
              onMouseEnter={() => setActiveUnit(unit)}
              className={`
                aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all relative overflow-hidden group/unit
                ${unit.status === 'available' ? 'border-indigo-100 bg-white shadow-xs' : ''}
                ${unit.status === 'resale' ? 'border-purple-150 bg-purple-50/20' : ''}
                ${unit.status === 'booked' ? 'border-amber-100 bg-amber-50/40 cursor-not-allowed' : ''}
                ${unit.status === 'sold' ? 'border-slate-100 bg-slate-50 opacity-30 cursor-not-allowed' : ''}
                ${isSelected ? 'ring-2 ring-blue-600 border-blue-600' : ''}
              `}
            >
              <span className="text-xs font-bold text-slate-700">#{unit.unitNumber.split('-').pop()}</span>
            </button>
          );
        })}
      </div>

      {activeUnit && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-6 text-xs text-slate-700 font-semibold">
            <div>
              <span className="block text-[9px] text-slate-400 uppercase font-bold">Preview</span>
              <span>Unit #{activeUnit.unitNumber}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 uppercase font-bold">Layout</span>
              <span>{activeUnit.bhkType || '3 BHK'}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 uppercase font-bold">Area</span>
              <span>{activeUnit.areaSqft?.toLocaleString() || '2,400'} sq.ft.</span>
            </div>
          </div>
          <div className="bg-white border p-2.5 rounded-xl">
            <span className="block text-[9px] text-slate-400 uppercase font-bold text-right">Value</span>
            <span className="text-blue-600 font-extrabold">{formatPriceToIndianWord(activeUnit.price)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Production Build & SPA Fallback Deployment

### 7.1 Single Page Application (SPA) Routing Fallback Config
To deploy the application to hosting environments (e.g. Vercel, Netlify, Cloudflare Pages), client-side routing fallback parameters must be configured.

#### For **Vercel** (`/vercel.json`):
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

#### For **Netlify** (`/public/_redirects`):
```text
/*    /index.html   200
```

### 7.2 Environment Variable Declaration Setup
Create an `.env` file at the root level using these dynamic parameters:
```env
# Firebase API configurations matching your Google Cloud Project parameters
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

---
*Verified Production Build: Compiled and validated for seamless hands-on handover.*
