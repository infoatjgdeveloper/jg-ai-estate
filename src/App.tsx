/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
  collectionGroup
} from 'firebase/firestore';
import { 
  Building2, 
  LayoutDashboard, 
  Search, 
  TrendingUp, 
  Wallet, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  Gavel,
  FileText,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  Globe,
  Coins,
  Activity,
  ArrowUp,
  ArrowDown,
  BarChart3,
  PieChart as PieChartIcon,
  History,
  FileSearch,
  AlertCircle,
  SlidersHorizontal,
  Ruler,
  Landmark,
  Heart,
  Compass,
  Map as MapIcon,
  LayoutGrid,
  ChevronDown,
  Star,
  Users,
  Briefcase,
  HardHat,
  X
} from 'lucide-react';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CURRENCY_META, formatPrice, formatPriceFull, toUSD, COUNTRIES, GLOBAL_SEED_PROJECTS, type Country } from '@/lib/global';
import MapView from '@/components/MapView';

// --- Types ---
interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  city: string;
  country?: string;
  countryCode?: string;
  region: string; // continent/zone: 'Europe' | 'North America' | 'Asia' | 'Middle East' | 'Global'
  totalUnits: number;
  basePrice: number;
  listingType?: 'sale' | 'rent';
  currency: string;
  imageUrl: string;
  images?: string[];
  lat?: number;
  lng?: number;
  developerId: string;
  developerName?: string;
  reraId?: string; // India-specific registration
  verified?: boolean; // generic verification badge for non-India markets
  aiValuation?: number;
  marketTrend?: 'Bullish' | 'Stable' | 'Bearish';
  // Global listing extended parameters
  bhkOptions?: string[];
  areaRange?: string;
  constructionStatus?: 'Ready to Move' | 'Under Construction' | 'Pre-Launch';
  rentalYield?: number;
  amenities?: string[];
  landmarks?: { name: string; distance: string }[];
  aiScore?: number;
}

interface Unit {
  id: string;
  projectId: string;
  unitNumber: string;
  status: 'available' | 'booked' | 'sold' | 'resale';
  price: number;
  currentOwnerId?: string;
  bookingAmount: number;
  lastValuation?: number;
  isResaleEligible?: boolean;
  resalePrice?: number;
  currency?: string;
  // Dynamic unit-level specifications
  bhkType?: string;
  areaSqft?: number;
  viewTag?: string;
}

interface Investment {
  id: string;
  unitId: string;
  projectId: string;
  investorId: string;
  paymentPlan: {
    type: 'Full Payment' | 'Installments' | 'Financed';
    totalInstallments: number;
    paidInstallments: number;
  };
  totalAmount: number;
  paidAmount: number;
  currency?: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'defaulted';
  documents?: {
    name: string;
    type: 'Sale Agreement' | 'Khata' | 'Possession Letter' | 'Tax Receipt';
    status: 'pending' | 'signed' | 'verified';
    url?: string;
  }[];
}

interface Bid {
  id: string;
  unitId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: any;
  status: 'pending' | 'accepted' | 'rejected';
}

interface MarketDataPoint {
  date: string;
  value: number;
  volume: number;
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-8">
          <Card className="max-w-md w-full border-red-100 shadow-2xl rounded-[2.5rem]">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-stone-900">System Interruption</CardTitle>
              <CardDescription className="text-stone-500">{errorMessage}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full bg-stone-900 text-white hover:bg-brand-600 rounded-2xl py-6 font-bold"
              >
                Restart Application
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

// --- Agent contact configuration (EDIT: put your WhatsApp number here, country code, no + or spaces) ---
const AGENT_WHATSAPP = '919999999999';
const AGENT_PHONE = '+91 99999 99999';

const openWhatsApp = (message: string) => {
  window.open(`https://wa.me/${AGENT_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
};

// Rent listings show a monthly figure; sale listings show the abbreviated total price.
const priceLabel = (basePrice: number, currency: string, listingType?: string) =>
  listingType === 'rent' ? `${formatPrice(basePrice, currency)}/mo` : formatPrice(basePrice, currency);

const WhatsAppIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const FloatingWhatsApp = () => (
  <button
    onClick={() => openWhatsApp('Hi! I am browsing JG AI Estate and would like to speak with an agent.')}
    className="fixed bottom-6 right-6 z-[60] w-14 h-14 sm:w-16 sm:h-16 bg-[#25D366] hover:bg-[#1ebe5b] text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110"
    aria-label="Chat with an agent on WhatsApp"
  >
    <WhatsAppIcon className="w-7 h-7 sm:w-8 sm:h-8" />
  </button>
);

const TICKERS = [
  { symbol: 'BER/DE', price: '€5,450/m²', change: '+3.2%' },
  { symbol: 'PAR/FR', price: '€10,450/m²', change: '-1.4%' },
  { symbol: 'BCN/ES', price: '€4,650/m²', change: '+5.6%' },
  { symbol: 'AMS/NL', price: '€7,100/m²', change: '+4.3%' },
  { symbol: 'LIS/PT', price: '€4,800/m²', change: '+7.1%' },
  { symbol: 'LON/UK', price: '£850/sqft', change: '-0.6%' },
  { symbol: 'DXB/AE', price: 'AED 1,780/sqft', change: '+11.2%' },
  { symbol: 'NYC/US', price: '$1,450/sqft', change: '+2.9%' },
  { symbol: 'MUM/IN', price: '₹24,500/sqft', change: '+9.1%' },
];

const TickerItem = ({ ticker }: { ticker: typeof TICKERS[number] }) => (
  <div className="flex items-center gap-3 text-[12px] font-mono font-bold tracking-widest text-white">
    <span className="text-brand-300">{ticker.symbol}</span>
    <span>{ticker.price}</span>
    <span className={ticker.change.startsWith('+') ? 'text-emerald-300' : 'text-rose-300'}>{ticker.change}</span>
  </div>
);

// Small dropdown trigger used for the nav row (Buy / Rent / Sell / ...) — pill-style hover
// state rather than a plain color swap, so the nav reads as its own thing at a glance.
const NavDropdown = ({ label, badge, children }: { label: string, badge?: string, children: React.ReactNode }) => (
  <DropdownMenu>
    <DropdownMenuTrigger className="group flex items-center gap-1 text-sm font-bold text-stone-700 rounded-full px-3 py-1.5 -mx-3 -my-1.5 hover:bg-brand-50 hover:text-brand-700 transition-colors outline-none">
      {label}
      {badge && <Badge className="bg-amber-400 text-stone-900 border-none text-[9px] font-extrabold px-1.5 py-0 rounded-full ml-0.5">{badge}</Badge>}
      <ChevronDown className="w-3.5 h-3.5 transition-transform group-aria-expanded:rotate-180" />
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-60 bg-white border-stone-200 rounded-2xl p-2 shadow-2xl" align="start">
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);

// Location / market switcher — a searchable panel instead of a plain "🌍 Global ▾" text
// dropdown, so picking a country feels like its own product surface (closer to how a real
// SaaS market picker works) rather than an afterthought buried in the utility bar.
const LocationSwitcher = ({ selectedCountry, onSelectCountry }: { selectedCountry: string, onSelectCountry: (name: string) => void }) => {
  const [query, setQuery] = useState('');
  const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
  const current = selectedCountry === 'All' ? null : COUNTRIES.find(c => c.name === selectedCountry);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 hover:text-white/80 outline-none">
        <MapPin className="w-3.5 h-3.5" />
        {current ? current.name : 'All Markets'}
        <ChevronDown className="w-3.5 h-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 bg-white border-stone-200 rounded-2xl p-0 shadow-2xl overflow-hidden" align="start">
        <div className="p-3 border-b border-stone-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a country..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-200 text-stone-900"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          <DropdownMenuItem
            onClick={() => onSelectCountry('All')}
            className={`rounded-xl cursor-pointer py-2.5 px-3 font-bold flex items-center justify-between ${selectedCountry === 'All' ? 'bg-brand-50 text-brand-700' : 'text-stone-700'}`}
          >
            <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> All Markets (Global)</span>
            {selectedCountry === 'All' && <CheckCircle2 className="w-4 h-4" />}
          </DropdownMenuItem>
          {filtered.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-6">No markets match "{query}"</p>
          )}
          {filtered.map(c => (
            <DropdownMenuItem
              key={c.code}
              onClick={() => onSelectCountry(c.name)}
              className={`rounded-xl cursor-pointer py-2.5 px-3 font-medium flex items-center justify-between ${selectedCountry === c.name ? 'bg-brand-50 text-brand-700 font-bold' : 'text-stone-700'}`}
            >
              <span>{c.name}</span>
              {selectedCountry === c.name && <CheckCircle2 className="w-4 h-4" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface NavbarProps {
  onProfileClick: () => void;
  onMarketplaceClick: () => void;
  selectedCountry: string;
  onSelectCountry: (name: string) => void;
  onBuyClick: () => void;
  onRentClick: () => void;
  onSellClick: () => void;
  onEvaluateClick: () => void;
  onInvestClick: () => void;
  onAdvisorClick: () => void;
}

const Navbar = ({
  onProfileClick, onMarketplaceClick, selectedCountry, onSelectCountry,
  onBuyClick, onRentClick, onSellClick, onEvaluateClick, onInvestClick, onAdvisorClick,
}: NavbarProps) => {
  const { user, profile, signIn, signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 shadow-sm">
      {/* Row 1: live market ticker — deep navy gradient tied to the brand blue (not neutral black),
          plus a pulsing LIVE dot so it reads as our own live-data strip. */}
      <div className="w-full bg-gradient-to-r from-brand-950 via-stone-900 to-brand-950 py-1.5 overflow-hidden">
        <div className="flex items-center gap-16 animate-marquee whitespace-nowrap">
          <div className="flex items-center gap-1.5 pl-4 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            </span>
            <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-300">LIVE</span>
          </div>
          {TICKERS.map((ticker, i) => <TickerItem key={i} ticker={ticker} />)}
          {TICKERS.map((ticker, i) => <TickerItem key={`dup-${i}`} ticker={ticker} />)}
        </div>
      </div>

      {/* Row 2: utility bar — location + login + post property */}
      <div className="w-full bg-gradient-to-r from-brand-700 via-brand-600 to-brand-600 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 flex items-center justify-between text-xs sm:text-sm font-bold">
          <LocationSwitcher selectedCountry={selectedCountry} onSelectCountry={onSelectCountry} />

          <div className="flex items-center gap-3 sm:gap-5">
            {!user && <button onClick={signIn} className="hidden sm:inline hover:text-white/80">Login</button>}
            <button
              onClick={onSellClick}
              className="bg-white text-brand-700 hover:bg-white/90 rounded-full px-4 py-1.5 flex items-center gap-1.5 shadow-sm ring-1 ring-white/40"
            >
              Post Property
              <span className="bg-amber-400 text-stone-900 text-[9px] font-extrabold px-2 py-0.5 rounded-full">FREE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: logo + primary nav */}
      <div className="w-full bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 md:gap-10">
            {/* TODO: swap this monogram badge for the provided logo image, e.g.
                <img src="/logo.svg" className="h-8 md:h-10 w-auto" alt="JG Estate" /> */}
            <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <span className="flex items-center justify-center h-8 w-8 md:h-9 md:w-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white text-sm md:text-base font-extrabold shadow-sm">JG</span>
              <span className="text-lg md:text-2xl font-extrabold text-stone-900 tracking-tight">Estate</span>
            </div>

            <div className="hidden lg:flex items-center gap-7">
              <NavDropdown label="Buy">
                <DropdownMenuItem onClick={onBuyClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold">Browse Properties for Sale</DropdownMenuItem>
                <DropdownMenuItem onClick={onEvaluateClick} className="rounded-lg cursor-pointer py-2.5 px-3">Estimate a Property's Value</DropdownMenuItem>
              </NavDropdown>
              <NavDropdown label="Rent">
                <DropdownMenuItem onClick={onRentClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold">Browse Rentals</DropdownMenuItem>
              </NavDropdown>
              <NavDropdown label="Sell">
                <DropdownMenuItem onClick={onSellClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold">Post Your Property — Free</DropdownMenuItem>
                <DropdownMenuItem onClick={onMarketplaceClick} className="rounded-lg cursor-pointer py-2.5 px-3">Track Your Listings</DropdownMenuItem>
              </NavDropdown>
              <NavDropdown label="Home Loans">
                <div className="px-3 py-2.5 text-xs text-stone-500 leading-relaxed">Financing partners coming soon. Ask your advisor for referrals in the meantime.</div>
                <DropdownMenuItem onClick={onAdvisorClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold text-brand-600">Ask an Advisor</DropdownMenuItem>
              </NavDropdown>
              <NavDropdown label="Home Interiors">
                <div className="px-3 py-2.5 text-xs text-stone-500 leading-relaxed">Interior design partners coming soon to select markets.</div>
              </NavDropdown>
              <NavDropdown label="Advisor">
                <DropdownMenuItem onClick={onAdvisorClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold">Chat with an Agent (WhatsApp)</DropdownMenuItem>
                <DropdownMenuItem onClick={onEvaluateClick} className="rounded-lg cursor-pointer py-2.5 px-3">Get a Valuation Estimate</DropdownMenuItem>
              </NavDropdown>
              <NavDropdown label="Invest">
                <DropdownMenuItem onClick={onInvestClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold">Global Market Index</DropdownMenuItem>
                <DropdownMenuItem onClick={onMarketplaceClick} className="rounded-lg cursor-pointer py-2.5 px-3">My Portfolio</DropdownMenuItem>
              </NavDropdown>
              <a href="#" onClick={(e) => { e.preventDefault(); onAdvisorClick(); }} className="text-sm font-bold text-stone-700 rounded-full px-3 py-1.5 -mx-3 -my-1.5 hover:bg-brand-50 hover:text-brand-700 transition-colors">Help</a>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6 shrink-0">
            {user ? (
              <div className="flex items-center gap-3 md:gap-5">
                <div className="text-right hidden sm:block">
                  <p className="text-xs md:text-sm font-bold text-stone-900">{user.displayName}</p>
                  <p className="text-[10px] md:text-[12px] text-brand-600 font-bold uppercase tracking-widest">{profile?.role || 'Investor'}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="relative h-9 w-9 md:h-11 md:w-11 rounded-full p-0 border-2 border-stone-100 hover:border-brand-600 transition-all flex items-center justify-center overflow-hidden shadow-sm">
                    <Avatar className="h-full w-full">
                      <AvatarImage src={user.photoURL || ""} />
                      <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 bg-white border-stone-200 text-stone-900 rounded-2xl p-3 shadow-2xl" align="end">
                    <DropdownMenuLabel className="font-bold text-[12px] uppercase tracking-widest text-stone-400 px-4 py-3">Account</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-stone-100" />
                    <DropdownMenuItem onClick={onProfileClick} className="rounded-xl focus:bg-stone-50 cursor-pointer py-4 px-4 font-medium">
                      <UserIcon className="mr-3 h-5 w-5 text-brand-600" />
                      <span>My Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onMarketplaceClick} className="rounded-xl focus:bg-stone-50 cursor-pointer py-4 px-4 font-medium">
                      <LayoutDashboard className="mr-3 h-5 w-5 text-brand-600" />
                      <span>My Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-stone-100" />
                    <DropdownMenuItem onClick={signOut} className="rounded-xl focus:bg-rose-50 text-rose-600 cursor-pointer py-4 px-4 font-bold">
                      <LogOut className="mr-3 h-5 w-5" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button
                onClick={signIn}
                className="bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-xl px-4 py-2 md:px-6 md:py-2.5 shadow-sm transition-all text-xs md:text-sm"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

// Composite global index, rebased to 100, built from every tracked city's live series —
// this is real derived data (not a static number) so it moves if COUNTRIES data changes.
const MONTH_LABELS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const ALL_CITIES = COUNTRIES.flatMap(c => c.cities.map(city => ({ ...city, countryName: c.name })));
const COMPOSITE_INDEX_DATA: MarketDataPoint[] = MONTH_LABELS.map((label, i) => {
  const avg = ALL_CITIES.reduce((sum, city) => {
    const base = city.series[0] || 1;
    return sum + (city.series[i] / base) * 100;
  }, 0) / ALL_CITIES.length;
  return { date: label, value: Math.round(avg * 10) / 10, volume: 0 };
});
const COMPOSITE_YTD_GROWTH = (
  ((COMPOSITE_INDEX_DATA[COMPOSITE_INDEX_DATA.length - 1].value / COMPOSITE_INDEX_DATA[0].value) - 1) * 100
).toFixed(1);
// Top-moving markets, ranked by YoY change, for the leaderboard beside the chart.
const TOP_MOVERS = [...ALL_CITIES].sort((a, b) => b.yoyChange - a.yoyChange).slice(0, 6);

const MarketAnalytics = () => (
  <Card className="border-stone-200 bg-white shadow-sm overflow-hidden rounded-3xl">
    <CardHeader className="pb-2">
      <div className="flex justify-between items-center">
        <div>
          <CardTitle className="text-xl text-stone-900 font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-600" />
            Global Real Estate Index
          </CardTitle>
          <CardDescription className="micro-label">Composite of {ALL_CITIES.length} tracked cities across {COUNTRIES.length} countries</CardDescription>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${Number(COMPOSITE_YTD_GROWTH) >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>
            {Number(COMPOSITE_YTD_GROWTH) >= 0 ? '+' : ''}{COMPOSITE_YTD_GROWTH}%
          </p>
          <p className="text-[12px] text-stone-500 font-mono uppercase font-bold">12-Month Index</p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={COMPOSITE_INDEX_DATA}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1E5FE0" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#1E5FE0" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="date"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 2', 'dataMax + 2']}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            itemStyle={{ color: '#1E5FE0', fontWeight: 'bold' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#1E5FE0"
            fillOpacity={1}
            fill="url(#colorValue)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>

      <div className="lg:col-span-2 space-y-1.5">
        <p className="micro-label text-stone-400 mb-2">Top Movers, YoY</p>
        {TOP_MOVERS.map((city) => (
          <div key={`${city.countryName}-${city.city}`} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              {city.city}<span className="text-stone-400 font-medium">, {city.countryName}</span>
            </span>
            <span className={`text-xs font-bold flex items-center gap-1 ${city.yoyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {city.yoyChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(city.yoyChange).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const ProjectCard: React.FC<{
  project: Project, 
  onSelect: (p: Project) => void,
  isFavorite: boolean,
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}> = ({ project, onSelect, isFavorite, onToggleFavorite }) => {
  const bhks = project.bhkOptions ? project.bhkOptions.join(' & ') : '3 BR';
  const sizeRange = project.areaRange || '2,400 - 4,800 sq.ft.';
  const cStatus = project.constructionStatus || 'Ready to Move';
  const aiScore = project.aiScore || 85;

  return (
    <div 
      className="group cursor-pointer relative flex flex-col h-full focus-within:ring-2 focus-within:ring-brand-600 rounded-[1.5rem] sm:rounded-[2.5rem]"
      onClick={() => onSelect(project)}
    >
      <Card className="overflow-hidden border-stone-200 bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col h-full border hover:border-stone-300">
        <div className="aspect-[16/11] relative overflow-hidden shrink-0">
          <img 
            src={project.imageUrl || `https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80`} 
            alt={project.name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/95 via-stone-900/45 to-transparent" />
          
          {/* Top badging */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 right-4 sm:right-6 flex justify-between items-start gap-2">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Badge className="bg-white/95 backdrop-blur-xl text-brand-600 border-none px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold shadow-md">
                {project.city}
              </Badge>
              {project.listingType === 'rent' && (
                <Badge className="bg-emerald-600 text-white border-none px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold shadow-md">
                  For Rent
                </Badge>
              )}
              {project.reraId ? (
                <Badge className="bg-brand-600 text-white border-none px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold shadow-md">
                  RERA Verified
                </Badge>
              ) : project.verified ? (
                <Badge className="bg-emerald-600 text-white border-none px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold shadow-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </Badge>
              ) : null}
            </div>
            
            <button
              onClick={(e) => onToggleFavorite(project.id, e)}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/90 text-white hover:text-red-500 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label={isFavorite ? "Remove from saved" : "Save property"}
            >
              <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>

          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
            <div className="flex items-center gap-2 mb-1 sm:mb-2 text-white/70">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">{project.developerName}</p>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              <p className="text-[10px] sm:text-xs font-semibold text-brand-300">{cStatus}</p>
            </div>
            <h3 className="text-white text-xl sm:text-2xl md:text-3xl font-bold leading-tight tracking-tight line-clamp-1">{project.name}</h3>
          </div>
        </div>
        
        <CardContent className="p-5 sm:p-8 flex flex-col flex-1 justify-between gap-6">
          {/* Main attributes row */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-stone-100 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-stone-400">
                <Building2 className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Configuration</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-stone-800 line-clamp-1">{bhks}</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-stone-400">
                <Ruler className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Super Built-up Area</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-stone-800 line-clamp-1">{sizeRange}</p>
            </div>
          </div>

          {/* Pricing & AI Score Row */}
          <div className="flex justify-between items-end gap-2 my-1">
            <div className="space-y-1">
              <p className="micro-label text-[10px] sm:text-[11px] text-stone-400">{project.listingType === 'rent' ? 'Monthly Rent' : 'Starting Formats'}</p>
              <p className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tighter">
                {priceLabel(project.basePrice, project.currency, project.listingType)}
              </p>
            </div>
            
            <div className="text-right space-y-1">
              <div className="flex items-center justify-end gap-1.5 text-stone-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">AI Quality Score</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/65 text-amber-700 border border-amber-100 rounded-full font-bold text-xs">
                {aiScore}/100
              </div>
            </div>
          </div>

          {/* Bottom Call to Actions */}
          <div className="grid grid-cols-4 gap-2.5 pt-2 shrink-0">
            <div className="col-span-2">
              <Button className="w-full bg-stone-900 text-white hover:bg-brand-600 py-3 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all focus:ring-2 focus:ring-brand-400">
                Explore Units
                <ArrowUpRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
            <div className="col-span-1">
              <Button
                onClick={(e) => { e.stopPropagation(); openWhatsApp(`Hi! I'm interested in ${project.name}, ${project.city}. Please share details. ${window.location.origin}/property/${project.id}`); }}
                className="w-full h-full bg-[#25D366] text-white hover:bg-[#1ebe5b] rounded-xl sm:rounded-2xl font-bold transition-all"
                aria-label="Contact agent on WhatsApp"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </Button>
            </div>
            <div className="col-span-1">
              <div className={`w-full h-full inline-flex items-center justify-center gap-1 rounded-xl sm:rounded-2xl border font-bold text-[10px] sm:text-xs ${
                project.marketTrend === 'Bullish' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                {project.marketTrend === 'Bullish' ? <ArrowUp className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                {project.marketTrend}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Compact horizontal listing row for the map-first split view (ImmoScout24/Zillow style)
const ListingRow: React.FC<{
  project: Project,
  onSelect: (p: Project) => void,
  isFavorite: boolean,
  onToggleFavorite: (id: string, e: React.MouseEvent) => void,
  isActive: boolean,
  onHover: (id: string | null) => void,
}> = ({ project, onSelect, isFavorite, onToggleFavorite, isActive, onHover }) => {
  const bhks = project.bhkOptions ? project.bhkOptions.join(' & ') : '3 BR';
  const sizeRange = project.areaRange || '2,400 - 4,800 sq.ft.';

  return (
    <div
      id={`listing-row-${project.id}`}
      className={`group cursor-pointer flex gap-4 p-3 sm:p-4 rounded-2xl border transition-all ${
        isActive ? 'border-brand-600 bg-brand-50/40 shadow-md' : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
      }`}
      onClick={() => onSelect(project)}
      onMouseEnter={() => onHover(project.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="relative w-28 h-24 sm:w-36 sm:h-28 shrink-0 rounded-xl overflow-hidden">
        <img
          src={project.imageUrl || `https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80`}
          alt={project.name}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <button
          onClick={(e) => onToggleFavorite(project.id, e)}
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-white/85 backdrop-blur-md rounded-full flex items-center justify-center text-stone-500 hover:text-red-500 transition-all shadow-sm"
          aria-label={isFavorite ? "Remove from saved" : "Save property"}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="bg-stone-100 text-stone-600 border-none px-2.5 py-0.5 rounded-full text-[9px] font-bold">
              {project.city}
            </Badge>
            {project.listingType === 'rent' && (
              <Badge className="bg-emerald-600 text-white border-none px-2.5 py-0.5 rounded-full text-[9px] font-bold">For Rent</Badge>
            )}
            {project.reraId ? (
              <Badge className="bg-brand-600 text-white border-none px-2.5 py-0.5 rounded-full text-[9px] font-bold">RERA Verified</Badge>
            ) : project.verified ? (
              <Badge className="bg-emerald-600 text-white border-none px-2.5 py-0.5 rounded-full text-[9px] font-bold">Verified</Badge>
            ) : null}
          </div>
          <h4 className="font-bold text-stone-900 text-sm sm:text-base leading-tight line-clamp-1">{project.name}</h4>
          <p className="text-[11px] sm:text-xs text-stone-400 font-medium line-clamp-1">{bhks} · {sizeRange}</p>
        </div>
        <div className="flex items-end justify-between gap-2 pt-1">
          <p className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">{priceLabel(project.basePrice, project.currency, project.listingType)}</p>
          <button
            onClick={(e) => { e.stopPropagation(); openWhatsApp(`Hi! I'm interested in ${project.name}, ${project.city}. Please share details. ${window.location.origin}/property/${project.id}`); }}
            className="w-8 h-8 shrink-0 bg-[#25D366] text-white hover:bg-[#1ebe5b] rounded-lg flex items-center justify-center transition-all"
            aria-label="Contact agent on WhatsApp"
          >
            <WhatsAppIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MarketTrendBadge = ({ trend }: { trend?: 'Bullish' | 'Stable' | 'Bearish' }) => {
  if (!trend) return null;
  const colors = {
    Bullish: 'text-emerald-600 border-emerald-200 bg-emerald-50',
    Stable: 'text-stone-500 border-stone-200 bg-stone-50',
    Bearish: 'text-rose-500 border-rose-200 bg-rose-50'
  };
  const Icons = {
    Bullish: ArrowUp,
    Stable: Activity,
    Bearish: ArrowDown
  };
  const Icon = Icons[trend];
  
  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${colors[trend]}`}>
      <Icon className="w-3" />
      {trend}
    </div>
  );
};

const UnitGrid = ({ units, onBook, currency = 'USD' }: { units: Unit[], onBook: (u: Unit) => void, currency?: string }) => {
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
                ${unit.status === 'available' ? 'border-indigo-100/30 hover:border-brand-600 bg-white shadow-xs' : ''}
                ${unit.status === 'resale' ? 'border-purple-100 hover:border-purple-600 bg-purple-50/20' : ''}
                ${unit.status === 'booked' ? 'border-amber-100 bg-amber-50/40 cursor-not-allowed' : ''}
                ${unit.status === 'sold' ? 'border-stone-100 bg-stone-50 opacity-30 cursor-not-allowed' : ''}
                ${isSelected ? 'ring-2 ring-brand-600 border-brand-600' : ''}
              `}
            >
              <div className="absolute inset-0 bg-brand-600/0 group-hover/unit:bg-brand-600/5 transition-colors" />
              <span className="text-xs font-bold text-stone-700 group-hover/unit:text-brand-650 transition-colors">#{unit.unitNumber.split('-').pop()}</span>
              {unit.status === 'resale' && (
                <div className="absolute top-1 right-1">
                  <Zap className="w-2.5 h-2.5 text-purple-600 fill-purple-600" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Live Node specifications display drawer */}
      {activeUnit && (
        <div className="bg-stone-50/70 border border-stone-150 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div>
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Active Preview</p>
              <p className="text-sm font-extrabold text-stone-800">Unit #{activeUnit.unitNumber}</p>
            </div>
            
            <div className="hidden sm:block h-8 w-px bg-stone-200" />

            <div>
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Layout Configuration</p>
              <p className="text-sm font-bold text-stone-700">{activeUnit.bhkType || '3 BR'}</p>
            </div>

            <div className="hidden sm:block h-8 w-px bg-stone-200" />

            <div>
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Super Area</p>
              <p className="text-sm font-bold text-stone-700">{activeUnit.areaSqft ? `${activeUnit.areaSqft.toLocaleString()} sq.ft.` : '2,400 sq.ft.'}</p>
            </div>

            <div className="hidden sm:block h-8 w-px bg-stone-200" />

            <div>
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Orientation / View</p>
              <p className="text-sm font-bold text-stone-700 line-clamp-1">{activeUnit.viewTag || 'Skyline & City View'}</p>
            </div>
          </div>

          <div className="text-stone-900 bg-white border border-stone-100 px-4 py-2 sm:px-5 sm:py-3 rounded-xl shadow-sm sm:text-right shrink-0">
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Ownership Valuation</p>
            <p className="text-base sm:text-lg font-bold text-brand-600 leading-none mt-1">
              {formatPrice(activeUnit.price, activeUnit.currency || currency)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const InvestmentTracker: React.FC<{ investment: Investment, onRelist: (i: Investment) => void, onPay: (i: Investment) => void }> = ({ investment, onRelist, onPay }) => {
  const progress = (investment.paidAmount / investment.totalAmount) * 100;
  
  return (
    <Card className="border-stone-200 bg-white shadow-sm overflow-hidden relative group rounded-3xl">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-600 group-hover:w-3 transition-all" />
      <CardHeader className="p-8 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl text-stone-900 font-bold">Unit #{investment.unitId.split('-').pop()}</CardTitle>
            <CardDescription className="micro-label text-stone-500 mt-2">
              Plan: {investment.paymentPlan.type} ({investment.paymentPlan.paidInstallments}/{investment.paymentPlan.totalInstallments})
            </CardDescription>
          </div>
          <Badge className={`px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-widest ${
            investment.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-stone-100 text-stone-500'
          }`}>
            {investment.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-4 space-y-8">
        <div className="space-y-4">
          <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
            <span className="text-stone-400">Payment Progress</span>
            <span className="text-brand-600">{progress.toFixed(1)}%</span>
          </div>
          <div className="relative h-3 w-full bg-stone-100 rounded-full overflow-hidden">
            <div 
              style={{ width: `${progress}%` }}
              className="absolute top-0 left-0 h-full bg-brand-600 shadow-lg shadow-brand-100"
            />
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span className="text-stone-400">{formatPriceFull(investment.paidAmount, investment.currency)}</span>
            <span className="text-stone-900">{formatPriceFull(investment.totalAmount, investment.currency)}</span>
          </div>
        </div>

        {investment.documents && (
          <div className="space-y-4 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <p className="micro-label text-stone-400">Digital Vault</p>
              <Badge variant="outline" className="text-[9px] border-stone-200 text-stone-400 font-bold">SECURE STORAGE</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {investment.documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between bg-stone-50 p-4 rounded-2xl border border-stone-100 hover:border-brand-600/30 transition-all cursor-pointer group/doc">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover/doc:bg-brand-50 transition-colors">
                      <FileText className="w-5 h-5 text-stone-400 group-hover/doc:text-brand-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-700 truncate max-w-[150px]">{doc.name}</span>
                      <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{doc.type}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                    doc.status === 'verified' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                    doc.status === 'signed' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                    'bg-stone-100 text-stone-400 border-stone-200'
                  }`}>
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-6 border-t border-stone-100">
          <div className="flex items-center gap-2 text-[12px] text-stone-400 uppercase tracking-widest font-bold">
            <Clock className="w-4 h-4" />
            Due: {new Date(investment.endDate).toLocaleDateString()}
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => onRelist(investment)}
              variant="outline" 
              className="h-10 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold px-5"
            >
              Relist <Zap className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              onClick={() => onPay(investment)}
              disabled={investment.status === 'completed'}
              className="h-10 text-xs bg-stone-900 text-white hover:bg-brand-600 rounded-xl font-bold px-6"
            >
              {investment.status === 'completed' ? 'Paid' : 'Pay'} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ResaleListing: React.FC<{ unit: Unit, onBid: (u: Unit) => void }> = ({ unit, onBid }) => (
  <Card className="bg-white border-stone-200 hover:border-brand-600/50 transition-all group rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl">
    <div className="aspect-square relative overflow-hidden">
      <img 
        src={`https://picsum.photos/seed/unit-${unit.id}/400/400`} 
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-transparent opacity-60" />
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Badge className="bg-brand-600 text-white font-bold text-[9px] sm:text-[10px] tracking-widest border-none px-3 py-1 sm:px-4 sm:py-1.5 rounded-full shadow-lg">RESALE</Badge>
      </div>
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
        <p className="text-white/90 font-bold text-xs sm:text-sm">Unit #{unit.unitNumber}</p>
      </div>
    </div>
    <CardHeader className="p-5 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="micro-label text-[10px] sm:text-xs text-stone-500">Current Bid</p>
          <p className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tighter">{formatPriceFull(unit.price, unit.currency)}</p>
        </div>
        <Button 
          onClick={() => onBid(unit)}
          className="w-full sm:w-auto bg-brand-600 text-white hover:bg-stone-900 rounded-xl sm:rounded-2xl px-5 py-4 sm:px-8 sm:py-6 font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-lg shadow-brand-100"
        >
          Place Bid
        </Button>
      </div>
    </CardHeader>
  </Card>
);

// --- Global Market Data Dashboard (NSE-style index view, per country/city) ---
const CountryIndexCard: React.FC<{ country: Country; onSelect: (name: string) => void }> = ({ country, onSelect }) => {
  // Blend all city series into one representative country index for the sparkline
  const blended = country.cities[0].series.map((_, i) =>
    Math.round(country.cities.reduce((sum, c) => sum + c.series[i], 0) / country.cities.length)
  );
  const chartData = blended.map((value, i) => ({ i, value }));
  const avgYoy = country.cities.reduce((s, c) => s + c.yoyChange, 0) / country.cities.length;
  const isUp = avgYoy >= 0;

  return (
    <Card
      onClick={() => onSelect(country.name)}
      className="border-stone-200 bg-white shadow-sm hover:shadow-xl hover:border-brand-300 transition-all cursor-pointer rounded-3xl overflow-hidden group"
    >
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-50 text-brand-700 text-[11px] font-extrabold tracking-wider">{country.code}</span>
            <div>
              <p className="text-sm font-bold text-stone-900">{country.name}</p>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{country.cities.map(c => c.city).join(' · ')}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {avgYoy.toFixed(1)}%
          </div>
        </div>

        <div className="h-16 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${country.code}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={isUp ? '#10b981' : '#f43f5e'} strokeWidth={2} fill={`url(#spark-${country.code})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-stone-100">
          {country.cities.map(c => (
            <div key={c.city} className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">{c.city}</span>
              <span className="font-bold text-stone-800">
                {formatPriceFull(c.pricePerUnit, country.currency)}<span className="text-stone-400 font-normal">/{country.unitLabel}</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const MarketDashboard: React.FC<{ onSelectCountry: (name: string) => void }> = ({ onSelectCountry }) => {
  const globalAvgYoy = COUNTRIES.reduce((s, c) => s + c.cities.reduce((cs, ci) => cs + ci.yoyChange, 0) / c.cities.length, 0) / COUNTRIES.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white">
        <div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-brand-100">Global Composite Index</p>
          <p className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">{globalAvgYoy >= 0 ? '+' : ''}{globalAvgYoy.toFixed(1)}% YoY</p>
          <p className="text-xs sm:text-sm text-brand-100 mt-1">Blended across {COUNTRIES.length} countries, {COUNTRIES.reduce((s, c) => s + c.cities.length, 0)} cities — click any market to filter listings</p>
        </div>
        <BarChart3 className="w-14 h-14 sm:w-16 sm:h-16 text-white/30 shrink-0" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {COUNTRIES.map(c => (
          <CountryIndexCard key={c.code} country={c} onSelect={onSelectCountry} />
        ))}
      </div>

      <p className="text-[11px] text-stone-400 text-center pt-2">
        Simulated index data for demo purposes — production would connect to live sources (e.g. Eurostat, Destatis, ONS, Case-Shiller).
      </p>
    </div>
  );
};

const Dashboard = () => {
  const { user, profile, signIn } = useAuth();
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string; countryName?: string }>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [resaleUnits, setResaleUnits] = useState<Unit[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectUnits, setProjectUnits] = useState<Unit[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isBiddingOpen, setIsBiddingOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("All");
  const [isRelistingOpen, setIsRelistingOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [resalePrice, setResalePrice] = useState("");
  const [isLaunchOpen, setIsLaunchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isWhitepaperOpen, setIsWhitepaperOpen] = useState(false);
  
  // --- Zillow & 99acres style Filter Center states ---
  const [searchQuery, setSearchQuery] = useState("");
  const [budgetRange, setBudgetRange] = useState<string>("All"); // USD-equivalent tiers, works across all currencies
  const [selectedConstStatus, setSelectedConstStatus] = useState<string>("All"); // "All", "Ready to Move", "Under Construction"
  const [selectedBhkType, setSelectedBhkType] = useState<string>("All"); // "All", "1 BR", "2 BR", "3 BR", "4 BR", "Penthouse"
  const [onlyReraVerified, setOnlyReraVerified] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [selectedUnitBhkFilter, setSelectedUnitBhkFilter] = useState<string>("All");
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [browseView, setBrowseView] = useState<'split' | 'grid'>('split');
  const [browseMode, setBrowseMode] = useState<'buy' | 'rent'>('buy');
  const [isEvaluateOpen, setIsEvaluateOpen] = useState(false);
  const [evalForm, setEvalForm] = useState({ country: 'United States', city: 'New York', area: '' });
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Load and save favorite items
  useEffect(() => {
    const saved = localStorage.getItem('jg_ai_estate_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('jg_ai_estate_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    city: "",
    country: "United States",
    currency: "USD",
    totalUnits: 50,
    basePrice: 500000,
    reraId: "",
    listingType: "sale" as 'sale' | 'rent'
  });

  const [marketData, setMarketData] = useState<MarketDataPoint[]>([
    { date: '2026-01', value: 100, volume: 400 },
    { date: '2026-02', value: 112, volume: 300 },
    { date: '2026-03', value: 108, volume: 500 },
    { date: '2026-04', value: 124, volume: 600 },
  ]);

  const [profileRole, setProfileRole] = useState<string>("investor");
  const [profileRegion, setProfileRegion] = useState<string>("Global");

  useEffect(() => {
    if (profile) {
      setProfileRole(profile.role || "investor");
      setProfileRegion(profile.region || "Global");
    }
  }, [profile]);

  // --- Seed Data Function: seeds the global catalog (Europe, North America, Asia, Middle East) ---
  const seedData = useCallback(async () => {
    const projectsSnap = await getDocs(collection(db, 'projects'));
    if (projectsSnap.empty) {
      const batch = writeBatch(db);

      const sampleProjects: Omit<Project, 'id'>[] = GLOBAL_SEED_PROJECTS.map((p) => ({
        name: p.name,
        description: p.description,
        location: p.location,
        city: p.city,
        country: p.country,
        countryCode: p.countryCode,
        region: p.region,
        totalUnits: p.totalUnits,
        basePrice: p.basePrice,
        currency: p.currency,
        listingType: p.listingType || 'sale',
        imageUrl: p.imageUrl,
        images: p.images,
        lat: p.lat,
        lng: p.lng,
        developerId: "system",
        developerName: p.developerName,
        reraId: p.reraId,
        verified: p.verified,
        aiValuation: Math.round(p.basePrice * 1.06),
        marketTrend: p.marketTrend,
        bhkOptions: p.bhkOptions,
        areaRange: p.areaRange,
        constructionStatus: p.constructionStatus,
        rentalYield: p.rentalYield,
        aiScore: p.aiScore,
        amenities: p.amenities,
        landmarks: p.landmarks,
      }));


      for (const p of sampleProjects) {
        const pRef = doc(collection(db, 'projects'));
        batch.set(pRef, { ...p, createdAt: serverTimestamp() });

        // Unit increment/booking amounts scale proportionally to basePrice so they make
        // sense across wildly different currencies (EUR/USD/GBP/PLN/AED/INR).
        const increment = Math.max(1000, Math.round(p.basePrice * 0.003));
        const bookingAmount = Math.max(1000, Math.round(p.basePrice * 0.02));

        for (let i = 1; i <= 20; i++) {
          const uRef = doc(collection(db, `projects/${pRef.id}/units`));
          const bhkType = i <= 6 ? "2 BR" : i <= 14 ? "3 BR" : i <= 18 ? "4 BR" : "Penthouse";
          const areaSqft = bhkType === "2 BR" ? 1250 + i * 15 : bhkType === "3 BR" ? 1900 + i * 20 : bhkType === "4 BR" ? 2950 + i * 30 : 5400 + i * 50;
          const viewTag = i % 4 === 0 ? "Skyline & City View" : i % 4 === 1 ? "Courtyard & Garden Deck" : i % 4 === 2 ? "East-Facing Entrance" : "Prime Street View";

          batch.set(uRef, {
            projectId: pRef.id,
            unitNumber: `A-${i.toString().padStart(3, '0')}`,
            status: i % 7 === 0 ? 'resale' : 'available',
            price: p.basePrice + (i * increment),
            bookingAmount,
            lastValuation: Math.round(p.basePrice + (i * increment * 1.05)),
            currency: p.currency,
            bhkType,
            areaSqft,
            viewTag
          });
        }
      }
      await batch.commit();
    }
  }, []);

  useEffect(() => {
    // Any signed-in user can trigger the initial catalog seed if it's empty (public demo)
    if (user) {
      seedData();
    }
  }, [seedData, profile, user]);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'investments'), where('investorId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setInvestments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'investments'));
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    // Fetch all resale units across projects using collectionGroup
    const q = query(collectionGroup(db, 'units'), where('status', '==', 'resale'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResaleUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
    }, (err) => {
      // If index is missing, Firestore will provide a link in the error message
      console.error("Resale units fetch error:", err);
      handleFirestoreError(err, OperationType.LIST, 'collectionGroup/units');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      const q = query(collection(db, `projects/${selectedProject.id}/units`), orderBy('unitNumber', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setProjectUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, `projects/${selectedProject.id}/units`));
      return () => unsubscribe();
    }
  }, [selectedProject]);

  const handleAction = async (unit: Unit) => {
    setSelectedUnit(unit);
    if (unit.status === 'resale') {
      setIsBiddingOpen(true);
    } else {
      setIsBookingOpen(true);
    }
  };

  const handleRelist = (investment: Investment) => {
    setSelectedInvestment(investment);
    setResalePrice((investment.totalAmount * 1.1).toString()); // Default 10% markup
    setIsRelistingOpen(true);
  };

  const confirmRelisting = async () => {
    if (!user || !selectedInvestment || !resalePrice) return;

    try {
      const unitRef = doc(db, `projects/${selectedInvestment.projectId}/units`, selectedInvestment.unitId);
      await updateDoc(unitRef, {
        status: 'resale',
        resalePrice: Number(resalePrice),
        isResaleEligible: true
      });

      setIsRelistingOpen(false);
      setSelectedInvestment(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'relisting');
    }
  };

  const confirmBooking = async (planType: 'Full Payment' | 'Installments' | 'Financed') => {
    if (!user || !selectedUnit || !selectedProject) return;

    try {
      const startDate = new Date();
      const endDate = new Date();
      const totalInstallments = planType === 'Full Payment' ? 1 : planType === 'Installments' ? 12 : 60;
      endDate.setMonth(startDate.getMonth() + (planType === 'Full Payment' ? 1 : planType === 'Installments' ? 12 : 60));

      const bookingAmount = selectedUnit.bookingAmount || Math.round(selectedUnit.price * 0.02);

      await addDoc(collection(db, 'investments'), {
        unitId: selectedUnit.id,
        projectId: selectedProject.id,
        investorId: user.uid,
        currency: selectedUnit.currency || selectedProject.currency,
        paymentPlan: {
          type: planType,
          totalInstallments,
          paidInstallments: 1
        },
        totalAmount: selectedUnit.price,
        paidAmount: bookingAmount,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'active',
        documents: [
          { name: 'Sale Agreement', type: 'Sale Agreement', status: 'verified' },
          { name: 'Title Deed', type: 'Khata', status: 'pending' },
          { name: 'Possession Letter', type: 'Possession Letter', status: 'pending' },
          { name: 'Tax Receipt', type: 'Tax Receipt', status: 'pending' }
        ]
      });

      const unitRef = doc(db, `projects/${selectedProject.id}/units`, selectedUnit.id);
      await updateDoc(unitRef, {
        status: 'booked',
        currentOwnerId: user.uid
      });

      setIsBookingOpen(false);
      setSelectedUnit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'booking');
    }
  };

  const placeBid = async () => {
    if (!user || !selectedUnit || !bidAmount) return;
    
    try {
      await addDoc(collection(db, `projects/${selectedUnit.projectId}/units/${selectedUnit.id}/bids`), {
        unitId: selectedUnit.id,
        bidderId: user.uid,
        bidderName: user.displayName,
        amount: Number(bidAmount),
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      setIsBiddingOpen(false);
      setBidAmount("");
      setSelectedUnit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${selectedUnit.projectId}/units/${selectedUnit.id}/bids`);
    }
  };

  const confirmLaunch = async () => {
    if (!user || !newProject.name || !newProject.city || !newProject.country) return;
    try {
      const pRef = doc(collection(db, 'projects'));
      const countryMeta = COUNTRIES.find(c => c.name === newProject.country);
      const projectData = {
        ...newProject,
        countryCode: countryMeta?.code || '',
        region: countryMeta?.region || 'Europe',
        reraId: newProject.reraId || undefined,
        verified: false, // manually launched listings start unverified until reviewed
        developerId: user.uid,
        developerName: user.displayName || 'Verified Developer',
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(newProject.name)}/800/500`,
        aiValuation: Math.round(Number(newProject.basePrice) * 1.05),
        marketTrend: 'Bullish',
        createdAt: serverTimestamp()
      };

      const batch = writeBatch(db);
      batch.set(pRef, projectData);

      const increment = Math.max(1000, Math.round(Number(newProject.basePrice) * 0.003));
      const bookingAmount = Math.max(1000, Math.round(Number(newProject.basePrice) * 0.02));
      for (let i = 1; i <= 10; i++) {
        const uRef = doc(collection(db, `projects/${pRef.id}/units`));
        batch.set(uRef, {
          projectId: pRef.id,
          unitNumber: `A-${i.toString().padStart(3, '0')}`,
          status: 'available',
          price: Number(newProject.basePrice) + (i * increment),
          bookingAmount,
          currency: newProject.currency,
          lastValuation: Math.round(Number(newProject.basePrice) + (i * increment * 1.05))
        });
      }

      await batch.commit();
      setIsLaunchOpen(false);
      setNewProject({
        name: "",
        description: "",
        city: "",
        country: "United States",
        currency: "USD",
        totalUnits: 50,
        basePrice: 500000,
        reraId: "",
        listingType: "sale"
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects');
    }
  };

  const handlePayment = async (investment: Investment) => {
    try {
      const invRef = doc(db, 'investments', investment.id);
      const installmentAmount = investment.totalAmount / investment.paymentPlan.totalInstallments;
      
      await updateDoc(invRef, {
        paidAmount: investment.paidAmount + installmentAmount,
        'paymentPlan.paidInstallments': investment.paymentPlan.paidInstallments + 1,
        status: investment.paymentPlan.paidInstallments + 1 >= investment.paymentPlan.totalInstallments ? 'completed' : 'active'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'investments');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      // setDoc + merge: works for both first-time and existing profiles
      // (updateDoc throws "not-found" for new users)
      await setDoc(userRef, {
        role: profileRole,
        region: profileRegion,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsProfileOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  // Single source of truth for catalog filtering (previously duplicated inline)
  const filteredProjects = useMemo(() => projects.filter(p => {
    if (browseMode === 'rent' && p.listingType !== 'rent') return false;
    if (browseMode === 'buy' && p.listingType === 'rent') return false;

    if (selectedCountry !== 'All' && p.country !== selectedCountry) return false;

    if (searchQuery.trim() !== '') {
      const q2 = searchQuery.toLowerCase();
      const match = [p.name, p.city, p.country, p.location, p.developerName, p.reraId]
        .some(field => field?.toLowerCase().includes(q2));
      if (!match) return false;
    }

    if (budgetRange !== 'All') {
      const usdPrice = toUSD(p.basePrice, p.currency);
      if (budgetRange === '< $300K' && usdPrice >= 300000) return false;
      if (budgetRange === '$300K - $800K' && (usdPrice < 300000 || usdPrice > 800000)) return false;
      if (budgetRange === '$800K - $2M' && (usdPrice < 800000 || usdPrice > 2000000)) return false;
      if (budgetRange === '> $2M' && usdPrice <= 2000000) return false;
    }

    if (selectedConstStatus !== 'All' && p.constructionStatus !== selectedConstStatus) return false;

    if (selectedBhkType !== 'All' && !p.bhkOptions?.some(b => b.includes(selectedBhkType))) return false;

    if (onlyReraVerified && !p.reraId && !p.verified) return false;

    return true;
  }), [projects, browseMode, selectedCountry, searchQuery, budgetRange, selectedConstStatus, selectedBhkType, onlyReraVerified]);

  const filteredUnits = useMemo(() => projectUnits.filter(u => {
    if (selectedUnitBhkFilter === 'All') return true;
    if (selectedUnitBhkFilter === 'Penthouse') return u.bhkType?.toLowerCase().includes('villa') || u.bhkType?.toLowerCase().includes('penthouse');
    return u.bhkType === selectedUnitBhkFilter;
  }), [projectUnits, selectedUnitBhkFilter]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // --- Shareable, deep-linkable URLs for listings & country pages (SEO phase 1) ---
  // Note: this is client-side routing only. It gives every listing a real, shareable
  // URL and a per-page <title>, but full search-engine indexing of a Vite SPA still
  // requires server-side rendering or a prerendering service — a separate, larger
  // infrastructure step, not something this change alone accomplishes.
  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project);
    navigate(`/property/${project.id}`);
  }, [navigate]);

  const handleCloseProjectDetail = useCallback(() => {
    setSelectedProject(null);
    navigate('/');
  }, [navigate]);

  const handleSelectCountryRoute = useCallback((name: string) => {
    setSelectedCountry(name);
    if (name === 'All') {
      navigate('/');
    } else {
      navigate(`/country/${encodeURIComponent(name)}`);
    }
  }, [navigate]);

  // Resolve a /property/:id deep link — use the already-loaded project if we have it,
  // otherwise fetch it directly so a cold/shared link still opens the right listing.
  useEffect(() => {
    if (!routeParams.id) return;
    const fromState = projects.find(p => p.id === routeParams.id);
    if (fromState) {
      setSelectedProject(fromState);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'projects', routeParams.id as string));
        if (snap.exists()) {
          setSelectedProject({ id: snap.id, ...snap.data() } as Project);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `projects/${routeParams.id}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.id, projects]);

  // Resolve a /country/:countryName deep link.
  useEffect(() => {
    if (routeParams.countryName) {
      setSelectedCountry(decodeURIComponent(routeParams.countryName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.countryName]);

  // Per-page <title> — basic SEO/share signal for listing pages.
  useEffect(() => {
    document.title = selectedProject
      ? `${selectedProject.name} — ${selectedProject.city}, ${selectedProject.country} | JG Estate`
      : 'JG Estate — Global Verified Real Estate Marketplace';
  }, [selectedProject]);

  return (
    <div className="tech-grid min-h-screen pb-24 bg-stone-50">
      <Navbar
        onProfileClick={() => setIsProfileOpen(true)}
        onMarketplaceClick={() => scrollToSection('catalog')}
        selectedCountry={selectedCountry}
        onSelectCountry={(name) => { handleSelectCountryRoute(name); scrollToSection('catalog'); }}
        onBuyClick={() => { setBrowseMode('buy'); scrollToSection('catalog'); }}
        onRentClick={() => { setBrowseMode('rent'); scrollToSection('catalog'); }}
        onSellClick={() => (user ? setIsLaunchOpen(true) : signIn())}
        onEvaluateClick={() => setIsEvaluateOpen(true)}
        onInvestClick={() => scrollToSection('market')}
        onAdvisorClick={() => openWhatsApp("Hi! I'd like to speak with a JG Estate advisor about buying, selling, or renting a property.")}
      />
      {/* Hero Section — asymmetric editorial layout */}
      <section className="relative pt-36 sm:pt-48 pb-16 sm:pb-28 overflow-hidden px-4 sm:px-8 border-b border-stone-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left: editorial copy block */}
          <div className="lg:col-span-6 space-y-6 md:space-y-8 relative z-20">
            <Badge className="bg-brand-600/10 text-brand-600 border-brand-600/20 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full micro-label text-[10px] sm:text-xs w-fit">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
              AI-Powered Global Asset Intelligence
            </Badge>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-stone-900 tracking-tighter leading-[0.98]">
              Buy & sell property
              <br />
              <span className="text-brand-600">anywhere,</span>
              <br />
              verified.
            </h1>
            <p className="text-base sm:text-xl text-stone-600 max-w-lg font-medium leading-relaxed">
              A truly global marketplace across 10 countries — from the US and UK to Germany, the UAE and India. Priced in each market's local currency, ID-verified sellers, licensed payment processors, live market data.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 pt-2">
              <Button
                onClick={() => scrollToSection('catalog')}
                className="bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-2xl px-8 py-6 md:px-10 md:py-7 text-sm md:text-base shadow-xl transition-all hover:scale-[1.02] w-full sm:w-auto"
              >
                Explore Listings
              </Button>
              <Button
                onClick={() => scrollToSection('market')}
                variant="outline"
                className="border-stone-300 text-stone-900 hover:bg-stone-100 rounded-2xl px-8 py-6 md:px-10 md:py-7 text-sm md:text-base font-bold w-full sm:w-auto"
              >
                View Market Data
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-stone-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-brand-600" /> 12-Point Verification</span>
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-brand-600" /> 10 Countries</span>
              <span className="flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-brand-600" /> Licensed Payment Processors</span>
            </div>
          </div>

          {/* Right: offset photo collage with a floating stat card */}
          <div className="lg:col-span-6 relative h-[380px] sm:h-[480px] lg:h-[560px]">
            <div className="absolute top-0 right-[8%] w-[62%] h-[68%] rounded-[2rem] overflow-hidden shadow-2xl rotate-2">
              <img
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute bottom-0 left-0 w-[52%] h-[52%] rounded-[1.75rem] overflow-hidden shadow-2xl -rotate-3 border-4 border-white">
              <img
                src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute bottom-[6%] right-0 bg-white rounded-[1.5rem] shadow-2xl border border-stone-200 p-5 sm:p-6 w-[62%] sm:w-[55%] space-y-1">
              <p className="micro-label text-brand-600">Global Real Estate Index</p>
              <p className="text-3xl sm:text-4xl font-extrabold text-stone-900">+12.4%</p>
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">YTD growth, EU-weighted</p>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for — this is a SaaS platform for the whole real estate ecosystem, not
          just buyers. One role picker, four tailored entry points into the same product. */}
      <section className="bg-stone-900 py-16 sm:py-24 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-14">
          <div className="max-w-2xl space-y-3 sm:space-y-4">
            <p className="micro-label text-brand-400">One Platform, Every Role</p>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tighter">Built for everyone in real estate</h2>
            <p className="text-sm sm:text-lg text-stone-400 font-medium leading-relaxed">
              Whether you're buying your first home or managing a global portfolio, JG Estate gives you the tools built for your role.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                icon: UserIcon,
                role: 'Customers',
                copy: 'Browse, evaluate and buy or rent verified properties across 10 countries — with live pricing and no hidden fees.',
                cta: 'Start Browsing',
                onClick: () => { setBrowseMode('buy'); scrollToSection('catalog'); },
              },
              {
                icon: Briefcase,
                role: 'Real Estate Agents',
                copy: 'List properties for free, reach global buyers, and manage every enquiry from one dashboard.',
                cta: 'List a Property',
                onClick: () => (user ? setIsLaunchOpen(true) : signIn()),
              },
              {
                icon: HardHat,
                role: 'Builders & Developers',
                copy: 'Showcase entire projects, publish unit-level inventory, and track construction-stage sales in real time.',
                cta: 'Showcase a Project',
                onClick: () => (user ? setIsLaunchOpen(true) : signIn()),
              },
              {
                icon: TrendingUp,
                role: 'Investors',
                copy: 'Track the global market index, compare city-level yields, and evaluate assets before you commit capital.',
                cta: 'View Market Data',
                onClick: () => scrollToSection('market'),
              },
            ].map((p) => (
              <div key={p.role} className="group bg-stone-800/60 hover:bg-stone-800 border border-stone-700 hover:border-brand-500/50 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between gap-6 sm:gap-8 transition-all">
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-brand-500/10 w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                    <p.icon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">{p.role}</h3>
                  <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">{p.copy}</p>
                </div>
                <button
                  onClick={p.onClick}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-brand-400 group-hover:text-brand-300 transition-colors"
                >
                  {p.cta}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-24 md:space-y-40 pt-16 sm:pt-24 relative z-30">
        {/* Market Overview */}
        <div id="market" className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          <div className="lg:col-span-2">
            <MarketAnalytics />
          </div>
          <div className="space-y-12">
            <Card className="bg-white border-stone-200 p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] flex flex-col justify-between h-full shadow-sm">
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-brand-50 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">Verified & Secure, Everywhere</h3>
                <p className="text-sm sm:text-lg text-stone-500 leading-relaxed font-medium">
                  Every asset undergoes a 12-point AI verification process, ensuring legal compliance and ID-verified sellers. Payments are routed through licensed processors in each market — never held by this platform.
                </p>
              </div>
              <div className="space-y-4 sm:space-y-6 pt-4 sm:pt-0">
                <p className="micro-label text-stone-400">Markets</p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={() => handleSelectCountryRoute('All')}
                    className={`px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold transition-all border ${
                      selectedCountry === 'All'
                        ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-100'
                        : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    Global
                  </button>
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleSelectCountryRoute(c.name)}
                      className={`px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold transition-all border ${
                        selectedCountry === c.name
                          ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-100'
                          : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="browse" className="space-y-12 md:space-y-20" id="catalog">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 md:gap-10">
            <div className="space-y-2 md:space-y-4">
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-stone-900 tracking-tighter">Explore Properties</h2>
              <p className="micro-label text-brand-600">Verified Listings Across {COUNTRIES.length} Countries</p>
            </div>
            <div className="w-full lg:w-auto overflow-x-auto scrollbar-none pb-2">
              <TabsList className="bg-stone-100 p-1 md:p-2 rounded-2xl md:rounded-[2rem] border border-stone-200 flex w-max lg:w-auto">
                <TabsTrigger value="browse" className="rounded-xl md:rounded-[1.5rem] px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                  Explore
                </TabsTrigger>
                <TabsTrigger value="market" className="rounded-xl md:rounded-[1.5rem] px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                  Market Data
                </TabsTrigger>
                {user && (
                  <TabsTrigger value="portfolio" className="rounded-xl md:rounded-[1.5rem] px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                    Portfolio
                  </TabsTrigger>
                )}
                {profile?.role === 'developer' && (
                  <TabsTrigger value="inventory" className="rounded-xl md:rounded-[1.5rem] px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                    Inventory
                  </TabsTrigger>
                )}
                <TabsTrigger value="resale" className="rounded-xl md:rounded-[1.5rem] px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                  Resale
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="browse" className="mt-0">
            {projects.length === 0 ? (
              <div id="sandbox-seed-alert" className="text-center py-12 sm:py-24 bg-white border border-stone-200 rounded-2xl sm:rounded-3xl p-6 sm:p-12 max-w-2xl mx-auto space-y-6 shadow-sm">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-50 text-brand-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto">
                  <Building2 className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-stone-900">No Listings Yet</h3>
                <p className="text-sm sm:text-base text-stone-500 font-medium leading-relaxed">
                  Load sample properties from across our {COUNTRIES.length} markets to preview the marketplace.
                </p>
                {user ? (
                  <Button
                    onClick={seedData}
                    className="bg-brand-600 text-white hover:bg-stone-900 font-bold rounded-xl px-6 py-4 sm:px-12 sm:py-6 text-xs sm:text-sm uppercase tracking-widest shadow-sm transition-all"
                  >
                    Load Sample Listings
                  </Button>
                ) : (
                  <Button
                    onClick={signIn}
                    className="bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-xl px-6 py-4 sm:px-12 sm:py-6 text-xs sm:text-sm uppercase tracking-widest shadow-sm transition-all"
                  >
                    Sign In to Get Started
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-10">
                {/* Search + filter bar — Buy/Rent toggle lives here now; Sell, Evaluate and
                    Invest already have their own entry points in the nav and the role cards
                    above, so they don't need to be repeated as a second row of buttons. */}
                <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 sm:gap-4">
                    {/* Buy / Rent segmented toggle */}
                    <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl shrink-0">
                      {(['buy', 'rent'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setBrowseMode(mode)}
                          className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all capitalize ${
                            browseMode === mode ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

                    {/* Search Term */}
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                      <Input
                        type="text"
                        placeholder="Search by city, country, project name or developer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 bg-stone-50/50 border-stone-200 text-stone-900 rounded-xl h-12 sm:h-14 font-medium focus:border-brand-600 focus:bg-white transition-all text-sm"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-stone-600 uppercase"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Toggle Advanced Filters Button */}
                      <Button
                        variant="outline"
                        onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)}
                        className={`h-12 sm:h-14 px-5 rounded-xl sm:rounded-2xl font-bold flex items-center gap-2 border-stone-200 hover:bg-stone-50 transition-all ${isFilterPanelExpanded ? 'bg-brand-50/50 border-brand-200 text-brand-600 shadow-sm' : 'text-stone-600'}`}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span>Filters</span>
                        {(budgetRange !== "All" || selectedConstStatus !== "All" || selectedBhkType !== "All" || onlyReraVerified) && (
                          <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" />
                        )}
                      </Button>

                      {/* Reset Filters button */}
                      {(searchQuery || budgetRange !== "All" || selectedConstStatus !== "All" || selectedBhkType !== "All" || onlyReraVerified) && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSearchQuery("");
                            setBudgetRange("All");
                            setSelectedConstStatus("All");
                            setSelectedBhkType("All");
                            setOnlyReraVerified(false);
                          }}
                          className="h-12 sm:h-14 px-4 font-bold text-stone-500 hover:text-rose-600"
                        >
                          Reset All
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Advanced Filters Drawer */}
                  {isFilterPanelExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-5 border-t border-stone-100">
                      {/* Budget Ranges */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-stone-400">Budget Range (USD equiv.)</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {['All', '< $300K', '$300K - $800K', '$800K - $2M', '> $2M'].map((b) => (
                            <button
                              key={b}
                              onClick={() => setBudgetRange(b)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                                budgetRange === b 
                                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-100' 
                                  : 'border-stone-150 bg-stone-50 text-stone-500 hover:border-stone-300'
                              }`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* BHK Configs */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-stone-400">Room Configuration</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {['All', '1 BR', '2 BR', '3 BR', '4 BR', 'Penthouse'].map((bhk) => (
                            <button
                              key={bhk}
                              onClick={() => setSelectedBhkType(bhk)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                                selectedBhkType === bhk 
                                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-100' 
                                  : 'border-stone-150 bg-stone-50 text-stone-500 hover:border-stone-300'
                              }`}
                            >
                              {bhk}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Construction Status */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-stone-400">Milestone</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {['All', 'Ready to Move', 'Under Construction'].map((status) => (
                            <button
                              key={status}
                              onClick={() => setSelectedConstStatus(status)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                                selectedConstStatus === status 
                                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-100' 
                                  : 'border-stone-150 bg-stone-50 text-stone-500 hover:border-stone-300'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Verification & Toggle */}
                      <div className="space-y-2 flex flex-col justify-end">
                        <label className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-100 hover:border-stone-300 rounded-xl cursor-pointer select-none transition-all">
                          <input 
                            type="checkbox"
                            checked={onlyReraVerified}
                            onChange={(e) => setOnlyReraVerified(e.target.checked)}
                            className="w-4 h-4 text-brand-600 accent-brand-600 border-stone-300 rounded focus:ring-brand-500"
                          />
          <div className="flex flex-col">
                            <span className="text-xs font-bold text-stone-800">Verified Listings Only</span>
                            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">ID-verified sellers & RERA-registered</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Result count + Map/Grid view toggle */}
                {filteredProjects.length > 0 && (
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs sm:text-sm font-bold text-stone-500">
                      <span className="text-stone-900">{filteredProjects.length}</span> {filteredProjects.length === 1 ? 'property' : 'properties'} found
                    </p>
                    <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                      <button
                        onClick={() => setBrowseView('split')}
                        className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                          browseView === 'split' ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-500'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" /> Map
                      </button>
                      <button
                        onClick={() => setBrowseView('grid')}
                        className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                          browseView === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-500'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" /> Grid
                      </button>
                    </div>
                  </div>
                )}

                {filteredProjects.length === 0 ? (
                  <div className="text-center py-20 bg-stone-50 border border-dashed rounded-[2rem] p-6 max-w-lg mx-auto">
                    <FileSearch className="w-12 h-12 text-stone-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-800">No Matched Properties</h3>
                    <p className="text-sm text-stone-500 mt-2">Try softening your filter coordinates or select another geographic market segment.</p>
                  </div>
                ) : browseView === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-11">
                    {filteredProjects.map(project => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onSelect={handleSelectProject}
                          isFavorite={favorites.includes(project.id)}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left: scrollable listing list */}
                    <div className="lg:col-span-2 space-y-3 lg:max-h-[780px] lg:overflow-y-auto pr-1 scrollbar-none">
                      {filteredProjects.map(project => (
                        <ListingRow
                          key={project.id}
                          project={project}
                          onSelect={handleSelectProject}
                          isFavorite={favorites.includes(project.id)}
                          onToggleFavorite={handleToggleFavorite}
                          isActive={hoveredPinId === project.id || activePinId === project.id}
                          onHover={setHoveredPinId}
                        />
                      ))}
                    </div>

                    {/* Right: sticky interactive map */}
                    <div className="lg:col-span-3 h-[420px] lg:h-[780px] lg:sticky lg:top-24 rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden border border-stone-200 shadow-sm">
                      <MapView
                        pins={filteredProjects
                          .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
                          .map(p => ({ id: p.id, lat: p.lat as number, lng: p.lng as number, label: priceLabel(p.basePrice, p.currency, p.listingType) }))}
                        activeId={hoveredPinId || activePinId}
                        onSelect={(id) => {
                          setActivePinId(id);
                          const p = filteredProjects.find(fp => fp.id === id);
                          if (p) handleSelectProject(p);
                        }}
                        onHover={setHoveredPinId}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="market" className="mt-0">
            <MarketDashboard
              onSelectCountry={(name) => {
                handleSelectCountryRoute(name);
                scrollToSection('catalog');
              }}
            />
          </TabsContent>

          <TabsContent value="inventory" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-16">
              {projects
                .filter(p => p.developerId === user?.uid)
                .map(project => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onSelect={handleSelectProject} 
                    isFavorite={favorites.includes(project.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              <div onClick={() => setIsLaunchOpen(true)}>
                <Card className="h-full border-dashed border-2 border-stone-200 bg-stone-50 rounded-[1.5rem] sm:rounded-[2.5rem] flex flex-col items-center justify-center p-10 sm:p-20 text-center cursor-pointer hover:border-brand-600 hover:bg-brand-50 transition-all group">
                  <div className="bg-brand-100 p-5 sm:p-8 rounded-full mb-4 sm:mb-8 group-hover:bg-brand-600 group-hover:scale-110 transition-all">
                    <Plus className="w-8 sm:w-14 h-8 sm:h-14 text-brand-600 group-hover:text-white" />
                  </div>
                  <CardTitle className="text-2xl sm:text-4xl font-bold text-stone-900">Add a Property</CardTitle>
                  <CardDescription className="micro-label mt-2 sm:micro-label mt-4 text-stone-500">List a new project or unit</CardDescription>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-12">
              {investments.map(inv => (
                <InvestmentTracker key={inv.id} investment={inv} onRelist={handleRelist} onPay={handlePayment} />
              ))}
              {investments.length === 0 && (
                <div className="col-span-full py-20 sm:py-40 text-center glass-panel rounded-[1.5rem] sm:rounded-[3rem] border-stone-100 p-6 sm:p-12">
                  <div className="bg-brand-50 w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <Wallet className="w-8 h-8 sm:w-12 sm:h-12 text-brand-600" />
                  </div>
                  <h3 className="luxury-heading text-2xl sm:text-4xl text-stone-900">No Assets Found</h3>
                  <p className="text-sm sm:text-base text-stone-500 mt-3 sm:mt-4 max-w-md mx-auto font-medium">Your verified real estate portfolio will be displayed here once you initialize your first investment.</p>
                  <Button 
                    onClick={() => scrollToSection('catalog')}
                    variant="outline" 
                    className="mt-6 sm:mt-10 border-stone-200 text-stone-900 hover:bg-stone-50 rounded-full px-8 py-4 sm:px-12 sm:py-6 text-xs sm:text-sm font-bold"
                  >
                    Begin Exploration
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="resale" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {resaleUnits.map(unit => (
                <ResaleListing key={unit.id} unit={unit} onBid={handleAction} />
              ))}
              {resaleUnits.length === 0 && (
                <div className="col-span-full py-20 sm:py-40 text-center glass-panel rounded-[1.5rem] sm:rounded-[3rem] border-stone-100 p-6 sm:p-12">
                  <div className="bg-brand-50 w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <Gavel className="w-8 h-8 sm:w-12 sm:h-12 text-brand-600" />
                  </div>
                  <h3 className="luxury-heading text-2xl sm:text-4xl text-stone-900">Market Stabilized</h3>
                  <p className="text-sm sm:text-base text-stone-500 mt-3 sm:mt-4 font-medium">There are currently no assets listed for resale in this region.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Project Details Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => !open && handleCloseProjectDetail()}>
        <DialogContent 
          onClose={() => handleCloseProjectDetail()}
          className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0 bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[3rem] shadow-2xl"
        >
          {selectedProject && (
            <>
              <div className="min-h-[220px] sm:min-h-[350px] md:min-h-[420px] h-[35vh] sm:h-[420px] relative shrink-0">
                <img 
                  src={selectedProject.imageUrl || `https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 md:p-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-brand-600 text-white font-bold px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] tracking-widest uppercase shadow-lg border-none">
                        {selectedProject.country || selectedProject.region}
                      </Badge>
                      {selectedProject.reraId ? (
                        <Badge className="bg-white/95 text-brand-650 border-none px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] tracking-widest uppercase shadow-lg">
                          RERA Verified
                        </Badge>
                      ) : selectedProject.verified ? (
                        <Badge className="bg-emerald-500 text-white border-none px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] tracking-widest uppercase shadow-lg flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500 text-white border-none px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[11px] tracking-widest uppercase shadow-lg">
                          Pending Review
                        </Badge>
                      )}
                      <MarketTrendBadge trend={selectedProject.marketTrend} />
                    </div>
                    <h2 className="text-xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">{selectedProject.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-white/80 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-brand-400" /> {selectedProject.location}</span>
                      <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-brand-400" /> {selectedProject.totalUnits} Smart Units</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right bg-stone-950/70 backdrop-blur-xl p-4 sm:p-6 rounded-xl sm:rounded-[2rem] border border-white/10 shadow-2xl w-full md:w-auto shrink-0">
                    <p className="micro-label text-white/50 text-[9px] sm:text-[10px] mb-1">{selectedProject.listingType === 'rent' ? 'Monthly Rent' : 'Starting Price Tag'}</p>
                    <p className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tighter">
                      {priceLabel(selectedProject.basePrice, selectedProject.currency, selectedProject.listingType)}
                    </p>
                    <div className="flex items-center md:justify-end gap-1.5 mt-1 text-[10px] sm:text-xs font-bold text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Score: {selectedProject.aiScore || 92}/100 Rating
                    </div>
                  </div>
                </div>
              </div>

              {/* Asymmetric photo grid gallery (Zillow/ImmoScout24 style) */}
              {selectedProject.images && selectedProject.images.length > 1 && (
                <div className="shrink-0 px-5 sm:px-8 md:px-10 pt-5 sm:pt-6">
                  <div className="grid grid-cols-4 grid-rows-2 gap-2 sm:gap-3 h-[160px] sm:h-[220px] rounded-2xl overflow-hidden">
                    <div className="col-span-2 row-span-2 relative">
                      <img src={selectedProject.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    {selectedProject.images.slice(1, 5).map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        {idx === 3 && selectedProject.images!.length > 5 && (
                          <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                            +{selectedProject.images!.length - 5} more
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1 p-5 sm:p-8 md:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
                  <div className="lg:col-span-2 space-y-8 sm:space-y-12">
                     {/* Quick fact chips: price/area, price/sqm, status */}
                     <div className="flex flex-wrap gap-2.5 sm:gap-3">
                       <div className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-2 shadow-sm">
                         <Ruler className="w-3.5 h-3.5 text-brand-600" />
                         {selectedProject.areaRange || '2,400 – 4,800 sq.ft.'}
                       </div>
                       <div className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-2 shadow-sm">
                         <DollarSign className="w-3.5 h-3.5 text-brand-600" />
                         {(() => {
                           const areaMatch = (selectedProject.areaRange || '').match(/[\d,]+/);
                           const area = areaMatch ? parseInt(areaMatch[0].replace(/,/g, ''), 10) : null;
                           return area ? `~${formatPrice(Math.round(selectedProject.basePrice / area), selectedProject.currency)}/sq.ft.` : 'Price on request';
                         })()}
                       </div>
                       <div className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-2 shadow-sm">
                         <Building2 className="w-3.5 h-3.5 text-brand-600" />
                         {selectedProject.constructionStatus || 'Ready to Move'}
                       </div>
                       <div className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-2 shadow-sm">
                         <Building2 className="w-3.5 h-3.5 text-brand-600" />
                         {selectedProject.totalUnits} units total
                       </div>
                     </div>

                     {/* Neighborhood Proximities & Landmarks */}
                     <section className="bg-stone-50 rounded-2xl p-5 sm:p-8 border border-stone-100 space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                        <Compass className="w-4 h-4 text-stone-500" />
                        Travel Times & Nearby Connections
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(selectedProject.landmarks || [
                          { name: "City Center Metro", distance: "4 mins walking" },
                          { name: "Super-specialty Med-hub", distance: "8 mins driving" },
                          { name: "International Flight Terminus", distance: "20 mins highway" }
                        ]).map((lm, idx) => (
                          <div key={idx} className="bg-white border border-stone-100 p-4 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center shrink-0">
                              <Landmark className="w-4 h-4 text-brand-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider leading-none">Proximity</p>
                              <p className="text-xs font-bold text-stone-800 line-clamp-1 mt-1">{lm.name}</p>
                              <span className="inline-block px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[9px] font-bold mt-1 uppercase tracking-wider">{lm.distance}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-lg sm:text-2xl font-bold text-stone-900 flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-brand-650" />
                        AI Analysis & Developer Vision
                      </h3>
                      <p className="text-stone-500 leading-relaxed text-sm sm:text-base font-medium">{selectedProject.description}</p>
                      
                      {/* Premium Amenities Checklist */}
                      <div className="pt-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-stone-400 block mb-3">Residential Highlights & Key Features</Label>
                        <div className="flex flex-wrap gap-2">
                          {(selectedProject.amenities || ["Spa & Hydrotherapy Oasis", "Smart Video Door Locks", "Electric Vehicle Charging Stations", "Vastu Architectural Planning", "Infinity Skydeck Access"]).map((am, idx) => (
                            <Badge key={idx} variant="outline" className="bg-white border-stone-200 text-stone-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              {am}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* Unit Grid segment with interactive filter */}
                    <section className="space-y-6 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                        <div>
                          <h3 className="text-lg sm:text-2xl font-bold text-stone-900">Interviews & Unit Inventories</h3>
                          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mt-1">Reserve a unit with a refundable deposit</p>
                        </div>
                        
                        {/* Room configuration quick sub-filter tab selection slider */}
                        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                          {['All', '1 BR', '2 BR', '3 BR', '4 BR', 'Penthouse'].map((subFilter) => (
                            <button
                              key={subFilter}
                              onClick={() => setSelectedUnitBhkFilter(subFilter)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                selectedUnitBhkFilter === subFilter 
                                  ? 'bg-brand-600 text-white shadow' 
                                  : 'text-stone-500 hover:text-stone-900'
                              }`}
                            >
                              {subFilter}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-6 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-stone-400 mt-2">
                        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-white border border-stone-300 shadow-sm" /> Available for Buyout</span>
                        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-lime-50 border border-lime-200" /> Resale Market Listing</span>
                        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-200 animate-pulse" /> Pending Reservation</span>
                      </div>

                      {filteredUnits.length === 0 ? (
                        <div className="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                          <p className="text-sm font-semibold text-stone-400 font-mono">No units listed for {selectedUnitBhkFilter} layout currently</p>
                        </div>
                      ) : (
                        <UnitGrid units={filteredUnits} onBook={handleAction} currency={selectedProject.currency} />
                      )}
                    </section>

                    {/* FAQ Accordion */}
                    <section className="space-y-4 pt-2">
                      <h3 className="text-lg sm:text-2xl font-bold text-stone-900">Frequently Asked Questions</h3>
                      <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 overflow-hidden bg-white">
                        {[
                          {
                            q: "How does reserving a unit work?",
                            a: "You submit a refundable reservation request with a small deposit to hold the unit while paperwork and financing are arranged. This is not an escrow account — funds move only once a licensed payment processor and your local legal representative confirm the transaction.",
                          },
                          {
                            q: "Is this listing legally verified?",
                            a: selectedProject.reraId
                              ? "Yes — this project carries a registered RERA ID, which you can independently verify with the relevant state regulator before proceeding."
                              : "This seller has completed our ID verification process. We recommend independent legal and title verification in the listing's jurisdiction before any payment.",
                          },
                          {
                            q: "Can international buyers purchase this property?",
                            a: "Cross-border property purchases are subject to local ownership rules, currency controls, and tax treaties that vary by country. Speak with a local real-estate attorney before committing.",
                          },
                          {
                            q: "What fees are involved?",
                            a: "Typical costs include transfer tax, notary/legal fees, and agent commission, which vary by country — ask the listing agent for a jurisdiction-specific breakdown.",
                          },
                        ].map((faq, idx) => (
                          <div key={idx}>
                            <button
                              onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                              className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left hover:bg-stone-50 transition-all"
                            >
                              <span className="text-sm font-bold text-stone-800">{faq.q}</span>
                              <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${openFaqIndex === idx ? 'rotate-180' : ''}`} />
                            </button>
                            {openFaqIndex === idx && (
                              <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1">
                                <p className="text-xs sm:text-sm text-stone-500 leading-relaxed font-medium">{faq.a}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6 sm:space-y-8">
                    {/* Verified Seller Card */}
                    <Card className="bg-white border-stone-200 rounded-2xl sm:rounded-[2rem] shadow-sm p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg shrink-0">
                          {(selectedProject.developerName || 'S')[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-stone-900 truncate">{selectedProject.developerName}</p>
                          <div className="flex items-center gap-1 text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                            ))}
                            <span className="text-[10px] font-bold text-stone-400 ml-1">Seller rating unavailable yet</span>
                          </div>
                        </div>
                      </div>
                      {selectedProject.verified || selectedProject.reraId ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          ID-verified seller{selectedProject.reraId ? ' · RERA-registered' : ''}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          Verification pending — confirm identity before paying
                        </div>
                      )}
                    </Card>

                    {/* Key ROI / Yield Card */}
                    <Card className="bg-emerald-50/65 border-emerald-100 rounded-2xl sm:rounded-[2rem] shadow-sm p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Yield Analytics</span>
                        <Badge className="bg-emerald-650 text-white font-bold border-none text-[10px]">Prime Growth</Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-stone-500 uppercase">Projected Net Yield</p>
                        <p className="text-3xl sm:text-4xl font-extrabold text-emerald-900 tracking-tight">{(selectedProject.rentalYield || 4.8).toFixed(1)}% <span className="text-xs font-bold font-mono">P.A.</span></p>
                      </div>
                      <p className="text-xs font-medium text-emerald-800 leading-relaxed">
                        Earn structural appreciation combined with institutional monthly rental revenues backed by pre-negotiated corporate leases.
                      </p>
                    </Card>

                    <Card className="bg-stone-50 border-stone-200 relative overflow-hidden rounded-2xl sm:rounded-[2rem] shadow-sm">
                      <div className="absolute top-0 right-0 p-4 sm:p-6">
                        <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600 opacity-20" />
                      </div>
                      <CardHeader className="p-5 sm:p-6 pb-2">
                        <CardTitle className="text-[10px] sm:text-xs font-bold text-brand-600 uppercase tracking-[0.2em]">Reserve This Property</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 sm:p-6 pt-0 space-y-5 sm:space-y-6">
                        <div>
                          <p className="text-[10px] sm:text-[11px] text-stone-400 uppercase font-bold tracking-widest">Refundable Reservation Deposit (2%)</p>
                          <p className="text-2xl sm:text-3.5xl font-extrabold text-stone-900">{formatPriceFull(Math.round(selectedProject.basePrice * 0.02), selectedProject.currency)}</p>
                        </div>
                        <Separator className="bg-stone-200" />
                        <div className="space-y-2.5 sm:space-y-3.5 pt-1">
                          <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-stone-600">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Timestamped Reservation Record
                          </div>
                          <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-stone-600">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            {selectedProject.reraId ? 'RERA-Registered Project' : 'ID-Verified Seller'}
                          </div>
                          <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-stone-600">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Direct Agent Contact, Any Time
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contact Agent */}
                    <Button
                      onClick={() => openWhatsApp(`Hi! I'm interested in ${selectedProject.name} (${selectedProject.location}). ${selectedProject.listingType === 'rent' ? 'Rent' : 'Price'}: ${priceLabel(selectedProject.basePrice, selectedProject.currency, selectedProject.listingType)}. Please share details and arrange a site visit. ${window.location.origin}/property/${selectedProject.id}`)}
                      className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b] font-bold rounded-xl sm:rounded-[1.5rem] py-6 sm:py-7 text-xs sm:text-sm uppercase tracking-widest shadow-xl transition-all"
                    >
                      <WhatsAppIcon className="w-4 h-4 mr-2" />
                      Contact Agent on WhatsApp
                    </Button>
                    <a href={`tel:${AGENT_PHONE.replace(/\s/g, '')}`} className="block">
                      <Button
                        variant="outline"
                        className="w-full border-stone-300 text-stone-900 hover:bg-stone-50 font-bold rounded-xl sm:rounded-[1.5rem] py-6 sm:py-7 text-xs sm:text-sm uppercase tracking-widest transition-all"
                      >
                        Call Agent • {AGENT_PHONE}
                      </Button>
                    </a>

                    <Button
                      onClick={() => setIsWhitepaperOpen(true)}
                      className="w-full bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-xl sm:rounded-[1.5rem] py-6 sm:py-7 text-xs sm:text-sm uppercase tracking-widest shadow-xl transition-all"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Property & Process Details
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent 
          onClose={() => setIsBookingOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">Reserve This Unit</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              Unit #{selectedUnit?.unitNumber} • Tell us your preferred payment approach — the seller's agent will follow up to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-gap-6 py-6 sm:py-10">
            <div className="grid grid-cols-1 gap-4 sm:gap-5">
              {[
                { type: 'Full Payment', desc: 'Ask agent about upfront-payment discount', icon: Zap, color: 'text-brand-600', bg: 'bg-brand-50' },
                { type: 'Installments', desc: 'Ask agent about a staged payment plan', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { type: 'Financed', desc: 'Get connected with a mortgage/financing partner', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' }
              ].map((plan) => (
                <Button 
                  key={plan.type}
                  variant="outline" 
                  className="h-20 sm:h-24 flex items-center justify-start gap-4 sm:gap-6 border-stone-100 bg-stone-50 hover:border-brand-600 hover:bg-brand-50 transition-all group px-4 sm:px-8 rounded-[1.25rem] sm:rounded-3xl"
                  onClick={() => confirmBooking(plan.type as any)}
                >
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${plan.bg} flex items-center justify-center group-hover:bg-white transition-colors shadow-sm shrink-0`}>
                    <plan.icon className={`w-5 h-5 sm:w-7 sm:h-7 ${plan.color}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] sm:text-lg font-bold text-stone-900 group-hover:text-brand-600">{plan.type}</p>
                    <p className="text-[9px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1">{plan.desc}</p>
                  </div>
                </Button>
              ))}
            </div>
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-400 text-center font-bold uppercase tracking-[0.2em] px-4">
            RESERVATION REQUEST • {formatPriceFull(selectedUnit?.bookingAmount || 0, selectedUnit?.currency || selectedProject?.currency)} REFUNDABLE DEPOSIT
          </p>
        </DialogContent>
      </Dialog>

      {/* Relisting Dialog */}
      <Dialog open={isRelistingOpen} onOpenChange={setIsRelistingOpen}>
        <DialogContent 
          onClose={() => setIsRelistingOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-600" />
              </div>
              Relist for Resale
            </DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              List your unit on the resale market for other verified buyers to bid on.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 sm:py-10 space-y-6 sm:space-y-8">
            <div className="space-y-3 sm:space-y-4">
              <Label htmlFor="resalePrice" className="text-stone-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest">Target Resale Price ({CURRENCY_META[selectedInvestment?.currency || 'USD']?.symbol.trim() || selectedInvestment?.currency})</Label>
              <Input 
                id="resalePrice"
                type="number"
                placeholder="Enter your asking price"
                value={resalePrice}
                onChange={(e) => setResalePrice(e.target.value)}
                className="bg-stone-50 border-stone-100 text-stone-900 text-lg sm:text-2xl h-12 sm:h-16 rounded-xl sm:rounded-2xl focus:border-indigo-600 font-bold px-4 sm:px-6"
              />
            </div>
            <div className="bg-stone-50 p-5 sm:p-8 rounded-[1.25rem] sm:rounded-[2rem] space-y-3 sm:space-y-4 border border-stone-100">
              <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                <span className="text-stone-400">ESTIMATED PROFIT</span>
                <span className="text-emerald-600">
                  +{formatPriceFull(Number(resalePrice) - (selectedInvestment?.totalAmount || 0), selectedInvestment?.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                <span className="text-stone-400">PLATFORM FEE</span>
                <span className="text-stone-900">1.5% on sale</span>
              </div>
            </div>
          </div>
          <Button 
            onClick={confirmRelisting}
            className="w-full bg-indigo-600 text-white hover:bg-stone-900 font-bold py-5 sm:py-10 rounded-xl sm:rounded-[1.5rem] text-sm sm:text-xl shadow-xl shadow-indigo-100"
          >
            Confirm Market Listing
          </Button>
        </DialogContent>
      </Dialog>

      {/* Bidding Dialog */}
      <Dialog open={isBiddingOpen} onOpenChange={setIsBiddingOpen}>
        <DialogContent 
          onClose={() => setIsBiddingOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <Gavel className="w-5 h-5 sm:w-7 sm:h-7 text-brand-600" />
              </div>
              Place Live Bid
            </DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              Unit #{selectedUnit?.unitNumber} • Current Valuation: {selectedUnit ? formatPriceFull(selectedUnit.price, selectedUnit.currency) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 sm:py-10 space-y-6 sm:space-y-8">
            <div className="space-y-3 sm:space-y-4">
              <Label htmlFor="bid" className="text-stone-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest">Your Bid Amount ({CURRENCY_META[selectedUnit?.currency || 'USD']?.symbol.trim() || selectedUnit?.currency})</Label>
              <Input
                id="bid"
                type="number"
                placeholder="Enter amount higher than current"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="bg-stone-50 border-stone-100 text-stone-900 text-lg sm:text-2xl h-12 sm:h-16 rounded-xl sm:rounded-2xl focus:border-brand-600 font-bold px-4 sm:px-6"
              />
            </div>
            <div className="bg-stone-50 p-5 sm:p-8 rounded-[1.25rem] sm:rounded-[2rem] space-y-3 sm:space-y-4 border border-stone-100">
              <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                <span className="text-stone-400">MINIMUM INCREMENT</span>
                <span className="text-stone-900">{selectedUnit ? formatPriceFull(Math.round(selectedUnit.price * 0.02), selectedUnit.currency) : ''}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                <span className="text-stone-400">NETWORK FEE</span>
                <span className="text-stone-900">0.02%</span>
              </div>
            </div>
          </div>
          <Button 
            onClick={placeBid}
            className="w-full bg-brand-600 text-white hover:bg-stone-900 font-bold py-5 sm:py-10 rounded-xl sm:rounded-[1.5rem] text-sm sm:text-xl shadow-xl shadow-brand-100"
          >
            Confirm Bid
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isLaunchOpen} onOpenChange={setIsLaunchOpen}>
        <DialogContent 
          onClose={() => setIsLaunchOpen(false)}
          className="sm:max-w-2xl bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">Launch New Asset</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              List a new property anywhere in the world. New listings show as "Pending Review" until our team verifies documentation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-gap-8 py-6 sm:py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">Project Name</Label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="rounded-xl border-stone-100 bg-stone-50 font-bold"
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">Country</Label>
                <select
                  value={newProject.country}
                  onChange={(e) => {
                    const c = COUNTRIES.find(c => c.name === e.target.value);
                    setNewProject({ ...newProject, country: e.target.value, currency: c?.currency || 'USD' });
                  }}
                  className="w-full rounded-xl border border-stone-100 bg-stone-50 font-bold text-sm px-4 py-2.5 h-10"
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">City</Label>
                <Input
                  value={newProject.city}
                  onChange={(e) => setNewProject({...newProject, city: e.target.value})}
                  className="rounded-xl border-stone-100 bg-stone-50 font-bold"
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">{newProject.listingType === 'rent' ? 'Monthly Rent' : 'Base Price'} ({CURRENCY_META[newProject.currency]?.symbol.trim() || newProject.currency})</Label>
                <Input
                  type="number"
                  value={newProject.basePrice}
                  onChange={(e) => setNewProject({...newProject, basePrice: Number(e.target.value)})}
                  className="rounded-xl border-stone-100 bg-stone-50 font-bold"
                />
              </div>
              <div className="space-y-2 sm:space-y-3 sm:col-span-2">
                <Label className="micro-label">Listing Type</Label>
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-fit">
                  {(['sale', 'rent'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewProject({ ...newProject, listingType: t })}
                      className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        newProject.listingType === t ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-500'
                      }`}
                    >
                      {t === 'sale' ? 'For Sale' : 'For Rent'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3 sm:col-span-2">
                <Label className="micro-label">RERA / License ID (optional, required in India)</Label>
                <Input
                  value={newProject.reraId}
                  onChange={(e) => setNewProject({...newProject, reraId: e.target.value})}
                  className="rounded-xl border-stone-100 bg-stone-50 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3 mb-2 sm:mb-0">
              <Label className="micro-label">Description</Label>
              <Input
                value={newProject.description}
                onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                className="rounded-xl border-stone-100 bg-stone-50 font-bold"
              />
            </div>
          </div>
          <Button 
            onClick={confirmLaunch}
            className="w-full bg-brand-600 text-white hover:bg-stone-900 font-bold py-5 sm:py-8 rounded-xl sm:rounded-2xl text-base sm:text-lg shadow-xl"
          >
            Deploy to Marketplace
          </Button>
        </DialogContent>
      </Dialog>

      {/* Property Evaluation Dialog */}
      <Dialog open={isEvaluateOpen} onOpenChange={setIsEvaluateOpen}>
        <DialogContent
          onClose={() => setIsEvaluateOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">Estimate Your Property's Value</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              A quick indicative estimate based on live comparable pricing in your city — not a professional appraisal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:gap-6 py-6 sm:py-8">
            <div className="space-y-2 sm:space-y-3">
              <Label className="micro-label">Country</Label>
              <select
                value={evalForm.country}
                onChange={(e) => {
                  const c = COUNTRIES.find(c => c.name === e.target.value);
                  setEvalForm({ country: e.target.value, city: c?.cities[0]?.city || '', area: evalForm.area });
                }}
                className="w-full rounded-xl border border-stone-100 bg-stone-50 font-bold text-sm px-4 py-2.5 h-11"
              >
                {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label className="micro-label">City</Label>
              <select
                value={evalForm.city}
                onChange={(e) => setEvalForm({ ...evalForm, city: e.target.value })}
                className="w-full rounded-xl border border-stone-100 bg-stone-50 font-bold text-sm px-4 py-2.5 h-11"
              >
                {(COUNTRIES.find(c => c.name === evalForm.country)?.cities || []).map(c => (
                  <option key={c.city} value={c.city}>{c.city}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label className="micro-label">
                Property Size ({COUNTRIES.find(c => c.name === evalForm.country)?.unitLabel || 'm²'})
              </Label>
              <Input
                type="number"
                placeholder="e.g. 85"
                value={evalForm.area}
                onChange={(e) => setEvalForm({ ...evalForm, area: e.target.value })}
                className="rounded-xl border-stone-100 bg-stone-50 font-bold"
              />
            </div>

            {(() => {
              const countryMeta = COUNTRIES.find(c => c.name === evalForm.country);
              const cityMeta = countryMeta?.cities.find(c => c.city === evalForm.city);
              const area = Number(evalForm.area);
              if (!countryMeta || !cityMeta || !area || area <= 0) return null;
              const mid = cityMeta.pricePerUnit * area;
              const low = Math.round(mid * 0.92);
              const high = Math.round(mid * 1.08);
              return (
                <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5 sm:p-6 space-y-2">
                  <p className="micro-label text-brand-600">Indicative Value Range</p>
                  <p className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                    {formatPriceFull(low, countryMeta.currency)} – {formatPriceFull(high, countryMeta.currency)}
                  </p>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Based on {cityMeta.city}'s current comparable price of {formatPriceFull(cityMeta.pricePerUnit, countryMeta.currency)}/{countryMeta.unitLabel} ({cityMeta.yoyChange >= 0 ? '+' : ''}{cityMeta.yoyChange}% YoY). This is a rough, automated estimate for orientation only — not a substitute for a licensed appraiser or surveyor.
                  </p>
                </div>
              );
            })()}
          </div>
          <Button
            onClick={() => {
              const countryMeta = COUNTRIES.find(c => c.name === evalForm.country);
              const cityMeta = countryMeta?.cities.find(c => c.city === evalForm.city);
              const area = Number(evalForm.area);
              if (!countryMeta || !cityMeta || !area) return;
              const mid = Math.round(cityMeta.pricePerUnit * area);
              openWhatsApp(`Hi! I'd like a professional valuation for my property in ${cityMeta.city}, ${countryMeta.name} (${area}${countryMeta.unitLabel}). The platform's automated estimate was around ${formatPriceFull(mid, countryMeta.currency)}.`);
            }}
            className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b] font-bold rounded-xl sm:rounded-2xl py-5 sm:py-7 text-sm uppercase tracking-widest shadow-xl"
          >
            <WhatsAppIcon className="w-4 h-4 mr-2" />
            Get a Professional Valuation
          </Button>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent 
          onClose={() => setIsProfileOpen(false)}
          className="sm:max-w-xl bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">Identity Intelligence</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              Manage your institutional profile and sandbox options.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 sm:py-8 space-y-6 sm:space-y-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border-4 border-brand-50">
                <AvatarImage src={user?.photoURL || ""} />
                <AvatarFallback className="text-lg sm:text-2xl">{user?.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h4 className="text-xl sm:text-2xl font-bold text-stone-900">{user?.displayName}</h4>
                <p className="text-brand-600 font-bold uppercase tracking-widest text-[10px] sm:text-xs">Current: {profile?.role || 'investor'}</p>
              </div>
            </div>

            {/* Role Switcher Selector */}
            <div className="space-y-3 sm:space-y-4">
              <Label className="micro-label text-stone-400">Select Sandbox Role</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setProfileRole("investor")}
                  className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border text-left transition-all relative ${
                    profileRole === "investor" 
                      ? "border-brand-600 bg-brand-50/20 shadow-md ring-2 ring-brand-600/10" 
                      : "border-stone-200 text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  <p className="font-bold text-stone-900 text-base sm:text-lg">Investor View</p>
                  <p className="text-[10px] sm:text-[11px] text-stone-400 mt-2 font-medium leading-relaxed">Reservations, resale bidding, and a portfolio tracker for what you're watching or holding.</p>
                </button>
                <button
                  onClick={() => setProfileRole("developer")}
                  className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border text-left transition-all relative ${
                    profileRole === "developer" 
                      ? "border-brand-600 bg-brand-50/20 shadow-md ring-2 ring-brand-600/10" 
                      : "border-stone-200 text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  <p className="font-bold text-stone-900 text-base sm:text-lg">Developer View</p>
                  <p className="text-[10px] sm:text-[11px] text-stone-400 mt-2 font-medium leading-relaxed">List new real-estate projects anywhere in the world, attach local registration IDs, and control property units.</p>
                </button>
              </div>
            </div>

            {/* Region Filter Selector */}
            <div className="space-y-3 sm:space-y-4">
              <Label className="micro-label text-stone-400">Select Operating Region</Label>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {['Global', 'North India', 'South India', 'West India', 'East India'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setProfileRegion(r)}
                    className={`px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold transition-all border ${
                      profileRegion === r 
                        ? 'bg-stone-900 border-stone-900 text-white shadow-md' 
                        : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button 
            onClick={handleUpdateProfile}
            className="w-full bg-brand-600 text-white hover:bg-stone-900 font-bold py-5 sm:py-8 rounded-xl sm:rounded-2xl text-base sm:text-lg shadow-xl"
          >
            Save Intelligence Profile
          </Button>
        </DialogContent>
      </Dialog>

      {/* Whitepaper Dialog */}
      <Dialog open={isWhitepaperOpen} onOpenChange={setIsWhitepaperOpen}>
        <DialogContent 
          onClose={() => setIsWhitepaperOpen(false)}
          className="sm:max-w-2xl bg-white border-stone-200 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">Property & Process Details</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              What's confirmed, what's pending, and how a purchase actually works for {selectedProject?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 sm:py-10 space-y-4 sm:space-y-6">
            <div className="bg-stone-50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-stone-100 space-y-3 sm:space-y-4">
              <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base sm:text-lg">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                Legal & Title Status
              </h4>
              <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
                {selectedProject?.reraId
                  ? 'This project carries a registered RERA ID, which you can independently verify with the relevant state regulator. Ownership is recorded in the municipal land registry — this platform does not itself transfer or hold title.'
                  : 'This listing follows applicable local property regulations (e.g. Grundbuch land register in Germany, Land Registry in the UK, Cadastre in France/Spain). Title and ownership records are held by the seller\'s appointed notary or title company — always verify these independently before paying anything.'}
              </p>
            </div>
            <div className="bg-brand-50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-100 space-y-3 sm:space-y-4">
              <h4 className="font-bold text-brand-900 flex items-center gap-2 text-base sm:text-lg">
                <Zap className="w-5 h-5 text-brand-600" />
                How a Purchase Works Here
              </h4>
              <p className="text-xs sm:text-sm text-brand-700 leading-relaxed">
                This platform connects you with the listing agent and records your interest with a refundable reservation deposit. Actual payment, escrow, and closing are handled by a licensed payment processor, notary, or attorney in the property's jurisdiction — not automatically by this app. Resale listings on this platform are subject to a 1.5% platform fee, payable at closing.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsWhitepaperOpen(false)}
            className="w-full bg-stone-900 text-white hover:bg-brand-600 font-bold py-5 sm:py-8 rounded-xl sm:rounded-2xl text-base sm:text-lg shadow-xl"
          >
            Got It
          </Button>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-24 sm:mt-40 bg-white">
        {/* Thin brand accent bar — a signature strip rather than a plain border */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700" />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 grid grid-cols-2 md:grid-cols-6 gap-8 sm:gap-10">
          <div className="col-span-2 space-y-4">
            {/* TODO: swap this monogram badge for the provided logo image */}
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white text-sm font-extrabold shadow-sm">JG</span>
              <p className="text-xl font-extrabold text-stone-900">Estate</p>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed max-w-xs">
              A global marketplace to buy, sell, and rent verified real estate — priced in local currency with live market data across {COUNTRIES.length} countries.
            </p>
            <a href={`tel:${AGENT_PHONE.replace(/\s/g, '')}`} className="text-sm font-bold text-stone-700 hover:text-brand-600 block">{AGENT_PHONE}</a>
          </div>

          <div className="space-y-3">
            <p className="micro-label text-stone-400">Explore</p>
            <button onClick={() => { setBrowseMode('buy'); scrollToSection('catalog'); }} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Buy</button>
            <button onClick={() => { setBrowseMode('rent'); scrollToSection('catalog'); }} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Rent</button>
            <button onClick={() => (user ? setIsLaunchOpen(true) : signIn())} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Sell</button>
            <button onClick={() => setIsEvaluateOpen(true)} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Evaluate</button>
            <button onClick={() => scrollToSection('market')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Invest</button>
          </div>

          <div className="space-y-3">
            <p className="micro-label text-stone-400">Support</p>
            <button onClick={() => openWhatsApp("Hi! I'd like to speak with a JG Estate advisor.")} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Talk to an Advisor</button>
            <a href="#" className="block text-sm font-semibold text-stone-600 hover:text-brand-600">About</a>
            <a href="#" className="block text-sm font-semibold text-stone-600 hover:text-brand-600">Careers</a>
            <a href="#" className="block text-sm font-semibold text-stone-600 hover:text-brand-600">Contact</a>
          </div>

          <div className="space-y-3">
            <p className="micro-label text-stone-400">Legal</p>
            <a href="#" className="block text-sm font-semibold text-stone-600 hover:text-brand-600">Terms of Use</a>
            <a href="#" className="block text-sm font-semibold text-stone-600 hover:text-brand-600">Privacy Policy</a>
            <a href="#" className="block text-sm font-semibold text-stone-600 hover:text-brand-600">Disclaimer</a>
          </div>
        </div>

        {/* Full country + city coverage — every market we track, browsable by location.
            Brand-tinted (not neutral gray) so it still reads as "ours" at this scale. */}
        <div className="border-t border-brand-100 bg-brand-50/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-6">
            <p className="micro-label text-stone-400">Browse Properties by Country & City</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-6">
              {COUNTRIES.map((c) => (
                <div key={c.code} className="space-y-2">
                  <button
                    onClick={() => { handleSelectCountryRoute(c.name); scrollToSection('catalog'); }}
                    className="text-sm font-bold text-stone-800 hover:text-brand-600 text-left"
                  >
                    {c.name}
                  </button>
                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-stone-500">
                    {c.cities.map((city, idx) => (
                      <span key={city.city}>
                        <button
                          onClick={() => { handleSelectCountryRoute(c.name); setSearchQuery(city.city); scrollToSection('catalog'); }}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {city.city}
                        </button>
                        {idx < c.cities.length - 1 && <span className="text-stone-300">,</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dark navy signature strip for the legal line — a two-tone footer (white body,
            deep-navy base) instead of a single flat bar all the way down. */}
        <div className="bg-stone-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/50 font-medium text-center sm:text-left">
              © {new Date().getFullYear()} JG Estate. Listings shown are for demonstration. Payments are processed by licensed third-party providers — this platform does not hold client funds in escrow.
            </p>
            <div className="flex items-center gap-4 text-xs font-bold text-brand-300 uppercase tracking-widest">
              <span>Global Marketplace</span>
              <span className="text-white/20">·</span>
              <span>{COUNTRIES.length} Countries</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-white font-sans selection:bg-brand-100 selection:text-brand-900">
            <Routes>
              {/* Every route renders the same single-page app shell — real, shareable
                  URLs for listings and countries, not separate page bundles (see note
                  above handleSelectProject for what this does and doesn't cover). */}
              <Route path="/property/:id" element={<Dashboard />} />
              <Route path="/country/:countryName" element={<Dashboard />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
            <FloatingWhatsApp />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
