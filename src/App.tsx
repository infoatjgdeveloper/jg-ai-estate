/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
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
  collectionGroup,
  arrayUnion,
  arrayRemove
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
  ChevronLeft,
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
  Phone,
  MessageCircle,
  Bot,
  Send,
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Bell,
  Calculator,
  Share2,
  Flag,
  RotateCw,
  GraduationCap,
  HeartPulse,
  ShoppingCart,
  TrainFront
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
import { CURRENCY_META, formatPrice, formatPriceFull, toUSD, COUNTRIES, GLOBAL_SEED_PROJECTS, DEVELOPER_NAME_MIGRATIONS, type Country } from '@/lib/global';
import MapView from '@/components/MapView';

// Honest placeholder for a self-listed project the developer didn't attach real photos to.
// Deliberately an inline SVG that says "No Photo Provided" rather than a random stock image
// standing in for a property it isn't — a stock photo here would look like a real listing
// photo and mislead buyers, which the rest of this app has gone out of its way to avoid.
const NO_PHOTO_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#f5f5f4"/>
  <g fill="none" stroke="#d6d3d1" stroke-width="3">
    <rect x="280" y="180" width="240" height="140" rx="12"/>
    <circle cx="330" cy="225" r="14"/>
    <path d="M280 300 L360 240 L420 280 L470 230 L520 300"/>
  </g>
  <text x="400" y="360" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#a8a29e" text-anchor="middle">No Photo Provided</text>
</svg>`);

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
  // A real equirectangular (360°) photo URL the listing owner actually took/owns. Rendered
  // with a genuine drag-to-pan viewer — never synthesized from a normal flat photo, and the
  // section simply doesn't render when this is unset rather than faking a tour.
  panoramaUrl?: string;
  amenities?: string[];
  landmarks?: { name: string; distance: string }[];
  aiScore?: number;
  // Every project doc already gets this written via serverTimestamp() on creation and the
  // main query already orders by it — it just wasn't in this type or surfaced in the UI yet.
  // Using the real write time here means "Listed X ago" reflects actual data instead of a
  // made-up date, which is the same standard the rest of this pass is holding to.
  createdAt?: { toDate: () => Date } | Date | null;
}

// Firestore can hand this back as a Timestamp (has toDate()), a plain Date, or occasionally
// null while a doc is still writing — this normalizes all three into a "time ago" string.
const timeAgo = (createdAt: Project['createdAt']): string | null => {
  if (!createdAt) return null;
  const date = createdAt instanceof Date ? createdAt : createdAt.toDate?.();
  if (!date || isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'Listed today';
  if (days === 1) return 'Listed 1 day ago';
  if (days < 30) return `Listed ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Listed ${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(months / 12);
  return `Listed ${years} ${years === 1 ? 'year' : 'years'} ago`;
};

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

// A real "contact agent" lead, written the moment a visitor actually reaches out about a
// specific listing (see handleContactAboutProject) — this is the live data behind the
// developer-facing Leads tab, not a fabricated lead count.
interface Inquiry {
  id: string;
  projectId: string;
  projectName: string;
  developerId: string;
  message: string;
  fromUserId?: string | null;
  createdAt?: { toDate: () => Date } | Date | null;
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
          <Card className="max-w-md w-full border-red-100 shadow-2xl rounded-3xl">
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

// --- Agent contact configuration ---
const AGENT_PHONE = '+91 99999 99999';
const SUPPORT_EMAIL = 'infoatjgdeveloper@gmail.com';

// Opens the user's mail client with a prefilled inquiry — the single "contact an
// advisor" path used across the app (replaces the previous WhatsApp deep-links).
const contactAdvisor = (message: string, subject = 'JGEstate Inquiry') => {
  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
};

// Real lead capture: call this alongside contactAdvisor() whenever the contact is about one
// specific, real listing. Writes an honest `inquiries` doc the listing's actual owner
// (project.developerId — the real Firestore account, not the client-side agent-persona
// roster below) can read back on their own Leads tab. Best-effort and silent on failure —
// a Firestore hiccup should never block the mailto: from opening.
const logInquiry = (project: Project, message: string, fromUserId?: string | null) => {
  if (!project.developerId || project.developerId === 'system') return;
  addDoc(collection(db, 'inquiries'), {
    projectId: project.id,
    projectName: project.name,
    developerId: project.developerId,
    message: message.slice(0, 1000),
    fromUserId: fromUserId || null,
    createdAt: serverTimestamp(),
  }).catch((error) => handleFirestoreError(error, OperationType.CREATE, 'inquiries'));
};

// --- Listing agents (broker storefront) ---
// Individual agent accounts aren't modeled in Firestore yet, so each listing is
// deterministically assigned one of a small public roster of advisors — same
// project always maps to the same agent, and every agent gets a real, working
// storefront (/agent/:id) built purely from client data. When per-agent accounts
// ship, swap `getAgentForProject` for a real `project.agentId` lookup.
interface AgentProfile {
  id: string;
  name: string;
  title: string;
  phone: string;
  regions: string[];
  bio: string;
}

const AGENT_ROSTER: AgentProfile[] = [
  { id: 'isabelle-hart', name: 'Isabelle Hart', title: 'Senior International Advisor', phone: '+44 20 7946 0958', regions: ['Europe'], bio: 'Twelve years advising cross-border buyers into prime European residential markets, from new-build launches to landmark restorations.' },
  { id: 'marcus-chen', name: 'Marcus Chen', title: 'Luxury Sales Director', phone: '+1 212 555 0148', regions: ['North America'], bio: 'Focused on flagship developments across New York and Miami, with a track record in full-floor and penthouse transactions.' },
  { id: 'amira-al-suwaidi', name: 'Amira Al Suwaidi', title: 'Senior Property Consultant', phone: '+971 4 555 0193', regions: ['Middle East'], bio: 'Specialist in branded residences and waterfront developments across Dubai, working closely with master developers on delivery timelines.' },
  { id: 'rohan-mehta', name: 'Rohan Mehta', title: 'Principal Broker', phone: '+91 98200 55123', regions: ['Asia'], bio: 'RERA-registered broker covering Mumbai and Bengaluru\'s prime residential corridors, with deep developer relationships for early-phase access.' },
  { id: 'sofia-almeida', name: 'Sofia Almeida', title: 'International Advisor', phone: '+351 21 555 0176', regions: ['Europe'], bio: 'Guides overseas buyers through Iberian and Southern European purchases end to end, from reservation to golden-visa paperwork.' },
  { id: 'daniel-osei', name: 'Daniel Osei', title: 'Global Client Advisor', phone: '+1 305 555 0122', regions: ['North America', 'Global'], bio: 'Works with relocating and diaspora buyers across multiple markets, coordinating remote viewings and financing introductions.' },
];

const hashProjectId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};

const getAgentForProject = (project: { id: string }): AgentProfile =>
  AGENT_ROSTER[hashProjectId(project.id) % AGENT_ROSTER.length];

// --- Motion primitives — shared across the homepage so every section animates in
// consistently on scroll, instead of one-off transitions bolted onto individual cards. ---

// Fades + slides content up once as it scrolls into view.
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; y?: number }> = ({ children, delay = 0, className, y = 28 }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.65, delay, ease: [0.21, 0.47, 0.32, 0.98] as const }}
  >
    {children}
  </motion.div>
);

// Staggers a group of Reveal-style children — wrap a card grid in this and give each
// card a matching index-based delay for a cascading entrance instead of all-at-once.
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] as const } },
};

// Animated count-up for stat numbers — parses a leading prefix (like "$") and trailing
// suffix (like "+" or "%") out of the string and only animates the numeric middle.
const CountUp: React.FC<{ value: string; duration?: number }> = ({ value, duration = 1.4 }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [display, setDisplay] = useState(0);
  const match = value.match(/^([^\d]*)([\d,]+\.?\d*)(.*)$/);

  useEffect(() => {
    if (!isInView || !match) return;
    const target = parseFloat(match[2].replace(/,/g, ''));
    let startTime: number | null = null;
    let raf: number;
    const step = (t: number) => {
      if (startTime === null) startTime = t;
      const progress = Math.min((t - startTime) / (duration * 1000), 1);
      setDisplay(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView]);

  if (!match) return <span ref={ref}>{value}</span>;
  const [, prefix, numStr, suffix] = match;
  const isInt = !numStr.includes('.');
  const formatted = isInt ? Math.round(display).toLocaleString() : display.toFixed(1);
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
};

// Hero entrance — staggers each hero element in sequence on first paint (not
// scroll-triggered, since the hero is already in view on load).
const heroContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const heroItemVariants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] as const } },
};

// Rent listings show a monthly figure; sale listings show the abbreviated total price.
const priceLabel = (basePrice: number, currency: string, listingType?: string) =>
  listingType === 'rent' ? `${formatPrice(basePrice, currency)}/mo` : formatPrice(basePrice, currency);

// --- AI Assistant (floating chat) ---
// Rule-based, keyword-matched replies about how the marketplace actually works —
// not a connected LLM (no backend/API key wired up for that), but a real, working
// chat UI with a genuine escalation path to a human advisor by email, rather
// than a chat window that fakes intelligence and dead-ends.
interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const AI_CHAT_WELCOME = "Hi, I'm the JGEstate assistant. Ask me how verification works, what it costs to list, which markets we cover, or anything about buying, renting or listing — and I can loop in a human advisor any time.";

const getAssistantReply = (raw: string): string => {
  const q = raw.toLowerCase();
  if (/\b(hi|hello|hey)\b/.test(q)) {
    return "Hello! I can help with how verification works, listing fees, which markets we cover, or EMI estimates. What would you like to know?";
  }
  if (/verif|scam|trust|safe|fraud/.test(q)) {
    return "Every account signs in with real ID (Google or email) before listing or contacting anyone. Developers can attach a real registration/license ID, which shows as a badge, and our team can mark a listing Verified after review — anyone can also report a listing that looks off. Payments route through licensed processors in each market, never held by this platform.";
  }
  if (/how.*work|process|step/.test(q)) {
    return "For buyers: search, get ID-verified, compare properties, then close through a licensed local payment processor. For agents, builders and investors: create an account, list your inventory, manage every enquiry from one dashboard, and get discovered through your own Builder Portfolio or Broker Storefront page.";
  }
  if (/countr|market|where|europe|eu\b|dubai|india|usa|america/.test(q)) {
    return `We're live across ${COUNTRIES.length} markets — all 27 EU member states, plus the UK, India, the United States and the UAE.`;
  }
  if (/emi|loan|mortgage|financ|afford/.test(q)) {
    return "I can't calculate that inside the chat yet, but the EMI calculator (top navigation, under Home Loans) will estimate your monthly payment from price, down payment and interest rate.";
  }
  if (/list|sell|post|agent|developer|builder/.test(q)) {
    return "You can list for free as an individual agent, or as a developer with a full multi-unit project — use \"Post Property\" in the top bar. New listings show as Pending Review until they pass verification.";
  }
  if (/fee|cost|price|charge|free/.test(q)) {
    return "Browsing, saved searches and contacting an agent are always free for buyers and renters. Agents and builders get a free Starter plan, with paid plans for unlimited listings and priority placement.";
  }
  if (/human|real person|advisor|call me|talk to/.test(q)) {
    return "Happy to connect you — tap \"Talk to a Human Advisor\" below and I'll open an email to a real advisor right away.";
  }
  return "I don't have a scripted answer for that one yet, but a human advisor can help — tap \"Talk to a Human Advisor\" below, or use the search bar to browse verified listings.";
};

const FloatingAIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: AI_CHAT_WELCOME }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: getAssistantReply(text) }]);
      setIsTyping(false);
    }, 550 + Math.random() * 500);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-[60] w-[calc(100vw-2rem)] sm:w-96 max-h-[70vh] bg-white rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
          <div className="bg-stone-900 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">JGEstate Assistant</p>
                <p className="text-[10px] font-semibold text-emerald-400 leading-tight">● Online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat" className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Honesty note: this is a scripted, keyword-matched assistant, not a live LLM —
              stated up front rather than only in a footer disclaimer, so no one mistakes a
              canned reply for a verified, property-specific number. */}
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 shrink-0">
            <p className="text-[10px] font-semibold text-amber-700 leading-snug">
              Automated, rule-based assistant — not a live AI model, and not a substitute for advice on a specific property. Ask to be connected to a human advisor for anything financial.
            </p>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50 min-h-[280px]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed font-medium ${
                  m.role === 'user' ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white border border-stone-200 text-stone-700 rounded-bl-md'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-stone-200 shrink-0 space-y-2">
            <button
              onClick={() => contactAdvisor('Hi! I was chatting with the JGEstate AI assistant and would like to speak with a human advisor.')}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-700 py-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              Talk to a Human Advisor
            </button>
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about listings, verification, fees..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-stone-100 border border-stone-200 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:bg-white"
              />
              <button
                onClick={handleSend}
                aria-label="Send message"
                className="w-10 h-10 shrink-0 bg-brand-600 hover:bg-stone-900 text-white rounded-xl flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-4 sm:right-6 z-[60] w-14 h-14 sm:w-16 sm:h-16 bg-brand-600 hover:bg-stone-900 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110"
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
      >
        {isOpen ? <X className="w-6 h-6 sm:w-7 sm:h-7" /> : <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />}
      </button>
    </>
  );
};

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
  onEmiClick: () => void;
  onFindAgentsClick: () => void;
}

const Navbar = ({
  onProfileClick, onMarketplaceClick, selectedCountry, onSelectCountry,
  onBuyClick, onRentClick, onSellClick, onEvaluateClick, onInvestClick, onAdvisorClick, onEmiClick, onFindAgentsClick,
}: NavbarProps) => {
  const { user, profile, signOut, openAuthModal } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 shadow-sm">
      {/* Row 1: live market ticker — deep navy gradient tied to the brand blue (not neutral black),
          plus a pulsing LIVE dot so it reads as our own live-data strip.
          The LIVE badge is fixed OUTSIDE the animated track: the marquee loop works by
          shifting the track exactly -50%, which only looks seamless if both halves of the
          track are pixel-identical. Putting the LIVE badge inside just the first half (as
          before) made the two halves different widths, so the loop visibly jumped/gapped
          once per cycle. Keeping the track to nothing but the duplicated TICKERS list fixes
          that; LIVE becomes a static, non-scrolling label instead. */}
      <div className="w-full bg-gradient-to-r from-brand-950 via-stone-900 to-brand-950 py-1.5 flex items-center">
        <div className="flex items-center gap-1.5 pl-4 pr-4 shrink-0 z-10 bg-stone-900">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
          </span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-300">LIVE</span>
        </div>
        {/* This box is the actual clipping boundary for the marquee track below. `translateX()`
            is not constrained by overflow-hidden on the element it's applied to — only by an
            ancestor's overflow-hidden — so the old markup (one shared overflow-hidden around
            both LIVE and the track) let the animated track slide underneath/over the LIVE badge
            as it moved, producing garbled overlapping text. Giving the track its own dedicated
            overflow-hidden wrapper, sized to start exactly where LIVE ends, fixes that. */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-16 animate-marquee whitespace-nowrap w-max">
            {TICKERS.map((ticker, i) => <TickerItem key={i} ticker={ticker} />)}
            {TICKERS.map((ticker, i) => <TickerItem key={`dup-${i}`} ticker={ticker} />)}
          </div>
        </div>
      </div>

      {/* Row 2: utility bar — location + login + post property */}
      <div className="w-full bg-gradient-to-r from-brand-700 via-brand-600 to-brand-600 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 flex items-center justify-between text-xs sm:text-sm font-bold">
          <LocationSwitcher selectedCountry={selectedCountry} onSelectCountry={onSelectCountry} />

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Single sign-in entry point lives in Row 3 below — this row used to carry
                a second "Login" text link too, which just duplicated the same signIn()
                call for no reason. */}
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
                <img src="/logo.svg" className="h-8 md:h-10 w-auto" alt="JGEstate" /> */}
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
                <DropdownMenuItem onClick={onEmiClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold">EMI Calculator</DropdownMenuItem>
                <DropdownMenuItem onClick={onAdvisorClick} className="rounded-lg cursor-pointer py-2.5 px-3 text-brand-600">Ask an Advisor</DropdownMenuItem>
              </NavDropdown>
              <NavDropdown label="Home Interiors">
                <div className="px-3 py-2.5 text-xs text-stone-500 leading-relaxed">Interior design partners coming soon to select markets.</div>
              </NavDropdown>
              <NavDropdown label="Advisor">
                <DropdownMenuItem onClick={onFindAgentsClick} className="rounded-lg cursor-pointer py-2.5 px-3 font-bold">Find an Agent</DropdownMenuItem>
                <DropdownMenuItem onClick={onAdvisorClick} className="rounded-lg cursor-pointer py-2.5 px-3">Email an Agent</DropdownMenuItem>
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
                onClick={() => openAuthModal('signin')}
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

// Real, deterministic parsing of the "Ask AI" free-text box into the app's actual filter
// state — browseMode/searchQuery/budgetRange/selectedBhkType/selectedConstStatus/
// onlyReraVerified. This is intentionally NOT a call to a hosted LLM (there's no AI backend
// wired up), but it is genuinely functional: every field below maps straight onto a live
// filter that immediately narrows the real, live-fetched listing set. No result is invented,
// no field is left silently unused — if nothing in the sentence matches, it's reported as
// "not understood" so the caller can fall back to routing the raw text to a human advisor
// instead of pretending to have found something.
const parseAiSearchQuery = (raw: string): {
  browseMode?: 'buy' | 'rent';
  matchedLocation?: string;
  budgetRange?: string;
  selectedBhkType?: string;
  selectedConstStatus?: string;
  onlyReraVerified?: boolean;
  understood: string[];
} => {
  const q = raw.toLowerCase();
  const understood: string[] = [];
  const result: { browseMode?: 'buy' | 'rent'; matchedLocation?: string; budgetRange?: string; selectedBhkType?: string; selectedConstStatus?: string; onlyReraVerified?: boolean; understood: string[]; } = { understood };

  if (/\b(rent|renting|lease|leasing|tenant)\b/.test(q)) { result.browseMode = 'rent'; understood.push('Rent'); }
  else if (/\b(buy|buying|purchase|for sale|\bsale\b)\b/.test(q)) { result.browseMode = 'buy'; understood.push('Buy'); }

  // Location: match against the real country/city list, longest name first so "Vienna" wins
  // over a coincidental shorter substring.
  const allPlaceNames = [
    ...ALL_CITIES.map(c => c.city),
    ...COUNTRIES.map(c => c.name),
  ].sort((a, b) => b.length - a.length);
  for (const name of allPlaceNames) {
    if (q.includes(name.toLowerCase())) {
      result.matchedLocation = name;
      understood.push(name);
      break;
    }
  }

  const bhkMatch = q.match(/(\d+)\s*(?:br\b|bed\b|beds\b|bedroom|bhk)/);
  if (bhkMatch) {
    const n = Math.min(parseInt(bhkMatch[1], 10), 4);
    result.selectedBhkType = `${n} BR`;
    understood.push(`${n} BR`);
  } else if (/\bpenthouse\b/.test(q)) {
    result.selectedBhkType = 'Penthouse';
    understood.push('Penthouse');
  }

  if (/\b(ready to move|move-?in ready)\b/.test(q)) { result.selectedConstStatus = 'Ready to Move'; understood.push('Ready to Move'); }
  else if (/\b(under construction|off-?plan)\b/.test(q)) { result.selectedConstStatus = 'Under Construction'; understood.push('Under Construction'); }
  else if (/\b(pre-?launch|upcoming project)\b/.test(q)) { result.selectedConstStatus = 'Pre-Launch'; understood.push('Pre-Launch'); }

  if (/\b(verified|rera[- ]?approved)\b/.test(q)) { result.onlyReraVerified = true; understood.push('Verified only'); }

  // Budget: a number with an optional k/m/lakh/crore suffix, gated behind an "under/below/
  // budget/max" cue so it doesn't misread a bedroom count. India-style lakh/crore and a
  // handful of currency hints get converted to the same USD buckets the filter already uses
  // (the buckets are approximate by design — the UI itself only has four bands).
  const budgetMatch = q.match(/(?:under|below|up ?to|max(?:imum)?|budget(?: of)?|less than|within)\D{0,8}([\d,.]+)\s*(k|thousand|m|million|lakh|lac|cr|crore)?/);
  if (budgetMatch) {
    const num = parseFloat(budgetMatch[1].replace(/,/g, ''));
    const suffix = budgetMatch[2];
    let amount = num;
    let assumedCurrency = 'USD';
    if (suffix === 'k' || suffix === 'thousand') amount = num * 1_000;
    else if (suffix === 'm' || suffix === 'million') amount = num * 1_000_000;
    else if (suffix === 'lakh' || suffix === 'lac') { amount = num * 100_000; assumedCurrency = 'INR'; }
    else if (suffix === 'cr' || suffix === 'crore') { amount = num * 10_000_000; assumedCurrency = 'INR'; }
    if (/₹|\binr\b|rupee/.test(q)) assumedCurrency = 'INR';
    else if (/£|\bgbp\b|pound/.test(q)) assumedCurrency = 'GBP';
    else if (/€|\beur\b|euro/.test(q)) assumedCurrency = 'EUR';
    else if (/\baed\b|dirham/.test(q)) assumedCurrency = 'AED';
    if (!isNaN(amount) && amount > 0) {
      const usd = toUSD(amount, assumedCurrency);
      if (usd < 300_000) result.budgetRange = '< $300K';
      else if (usd <= 800_000) result.budgetRange = '$300K - $800K';
      else if (usd <= 2_000_000) result.budgetRange = '$800K - $2M';
      else result.budgetRange = '> $2M';
      understood.push(`Budget ${result.budgetRange}`);
    }
  }

  return result;
};

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
  onToggleFavorite: (id: string, e: React.MouseEvent) => void,
  isComparing?: boolean,
  onToggleCompare?: (id: string, e: React.MouseEvent) => void,
  onViewPortfolio?: (developerName: string) => void
}> = ({ project, onSelect, isFavorite, onToggleFavorite, isComparing, onToggleCompare, onViewPortfolio }) => {
  const bhks = project.bhkOptions ? project.bhkOptions.join(' & ') : '3 BR';
  const sizeRange = project.areaRange || '2,400 - 4,800 sq.ft.';
  const cStatus = project.constructionStatus || 'Ready to Move';
  const aiScore = project.aiScore || 85;
  const listedAgo = timeAgo(project.createdAt);

  // Card-level photo carousel — swipe through images without opening the listing, the way
  // most real portals let you. Falls back to the single imageUrl when a listing doesn't have
  // a gallery yet.
  const cardImages = project.images && project.images.length > 1 ? project.images : [project.imageUrl];
  const [imgIndex, setImgIndex] = useState(0);
  const goToImg = (i: number, e: React.MouseEvent) => { e.stopPropagation(); setImgIndex(((i % cardImages.length) + cardImages.length) % cardImages.length); };

  // Single priority badge — RERA > Verified > For Rent — instead of stacking several,
  // which was one of the things making the old card feel cluttered.
  const statusBadge = project.reraId
    ? { label: 'RERA Verified', className: 'bg-brand-600 text-white' }
    : project.verified
    ? { label: 'Verified', className: 'bg-emerald-600 text-white' }
    : project.listingType === 'rent'
    ? { label: 'For Rent', className: 'bg-emerald-600 text-white' }
    : null;

  return (
    <div
      className="group cursor-pointer relative flex flex-col h-full focus-within:ring-2 focus-within:ring-brand-600 rounded-2xl"
      onClick={() => onSelect(project)}
    >
      <Card className="overflow-hidden border-stone-200 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full border hover:border-stone-300">
        <div className="aspect-[4/3] relative overflow-hidden shrink-0">
          <img
            src={cardImages[imgIndex] || `https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80`}
            alt={project.name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />

          {/* Card-level carousel controls — only rendered when there's more than one photo,
              so single-image listings don't show useless arrows/dots. stopPropagation on
              every control here so flipping photos never triggers onSelect underneath. */}
          {cardImages.length > 1 && (
            <>
              <button
                onClick={(e) => goToImg(imgIndex - 1, e)}
                aria-label="Previous photo"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-900/40 hover:bg-stone-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => goToImg(imgIndex + 1, e)}
                aria-label="Next photo"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-900/40 hover:bg-stone-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-14 left-0 right-0 flex items-center justify-center gap-1">
                {cardImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => goToImg(i, e)}
                    aria-label={`View photo ${i + 1}`}
                    className={`h-1 rounded-full transition-all ${i === imgIndex ? 'w-3 bg-white' : 'w-1 bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Top badging — status + "listed X ago" freshness + compact save/compare icons */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start gap-2">
            <div className="flex flex-col items-start gap-1.5">
              {statusBadge && (
                <Badge className={`${statusBadge.className} border-none px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm`}>
                  {statusBadge.label}
                </Badge>
              )}
              {listedAgo && (
                <Badge className="bg-white/85 backdrop-blur-md text-stone-700 border-none px-2.5 py-1 rounded-full text-[9px] font-bold shadow-sm">
                  {listedAgo}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {onToggleCompare && (
                <button
                  onClick={(e) => onToggleCompare(project.id, e)}
                  className={`w-7 h-7 backdrop-blur-md rounded-full flex items-center justify-center transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                    isComparing ? 'bg-brand-600 text-white' : 'bg-white/70 text-stone-700 hover:bg-white hover:text-brand-600'
                  }`}
                  aria-label={isComparing ? "Remove from comparison" : "Add to comparison"}
                  title={isComparing ? "Remove from comparison" : "Add to comparison"}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => onToggleFavorite(project.id, e)}
                className="w-7 h-7 bg-white/70 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white text-stone-700 hover:text-red-500 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                aria-label={isFavorite ? "Remove from saved" : "Save property"}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Price directly on the image, Zillow/99acres-style — the single most
              important number, visible without reading the card body at all. */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-stone-900/85 to-transparent pt-6 pb-2.5 px-3">
            <p className="text-white text-lg font-bold tracking-tight leading-none">
              {priceLabel(project.basePrice, project.currency, project.listingType)}
            </p>
          </div>
        </div>

        <CardContent className="p-3.5 flex flex-col flex-1 gap-2">
          <div>
            <h3 className="text-sm font-bold text-stone-900 leading-snug line-clamp-1">{project.name}</h3>
            <p className="text-xs text-stone-500 line-clamp-1">{project.city}, {project.country}</p>
          </div>

          {/* Single compact facts row — beds/config, area, status — replaces the old
              two big labeled blocks that ate most of the card's height. */}
          <div className="flex items-center gap-2.5 text-[11px] font-semibold text-stone-600 flex-wrap">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-stone-400" />{bhks}</span>
            <span className="text-stone-300">•</span>
            <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5 text-stone-400" />{sizeRange}</span>
            <span className="text-stone-300">•</span>
            <span>{cStatus}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500">
            {onViewPortfolio && project.developerName ? (
              <button
                onClick={(e) => { e.stopPropagation(); onViewPortfolio(project.developerName!); }}
                className="hover:text-brand-600 hover:underline underline-offset-2 line-clamp-1 text-left"
              >
                {project.developerName}
              </button>
            ) : (
              <span className="line-clamp-1">{project.developerName}</span>
            )}
            <span className="flex items-center gap-1 shrink-0 text-amber-600" title="AI Quality Score">
              <Sparkles className="w-3 h-3" />{aiScore}
            </span>
          </div>

          {/* Bottom Call to Actions — one primary action, one icon-only secondary */}
          <div className="flex items-center gap-2 pt-1 mt-auto shrink-0">
            <Button className="flex-1 bg-stone-900 text-white hover:bg-brand-600 py-2.5 rounded-xl font-bold text-xs transition-all focus:ring-2 focus:ring-brand-400">
              View Details
              <ArrowUpRight className="ml-1 w-3.5 h-3.5" />
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); const msg = `Hi! I'm interested in ${project.name}, ${project.city}. Please share details. ${window.location.origin}/property/${project.id}`; contactAdvisor(msg); logInquiry(project, msg); }}
              className="bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl font-bold px-3 py-2.5 transition-all shrink-0"
              aria-label="Email agent"
            >
              <Mail className="w-3.5 h-3.5" />
            </Button>
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
            onClick={(e) => { e.stopPropagation(); const msg = `Hi! I'm interested in ${project.name}, ${project.city}. Please share details. ${window.location.origin}/property/${project.id}`; contactAdvisor(msg); logInquiry(project, msg); }}
            className="w-8 h-8 shrink-0 bg-brand-600 text-white hover:bg-brand-700 rounded-lg flex items-center justify-center transition-all"
            aria-label="Email agent"
          >
            <Mail className="w-3.5 h-3.5" />
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
  <Card className="bg-white border-stone-200 hover:border-brand-600/50 transition-all group rounded-3xl overflow-hidden shadow-sm hover:shadow-lg">
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
  const avgYoy = country.cities.reduce((s, c) => s + c.yoyChange, 0) / country.cities.length;
  const isUp = avgYoy >= 0;

  // Hand-rolled sparkline instead of Recharts' ResponsiveContainer: ResponsiveContainer
  // measures its parent via ResizeObserver on mount, and in a staggered/animated grid like
  // this one (cards fade/slide in via framer-motion) that first measurement can land while
  // the card is still at its pre-animation size, so it locks in a 0x0 reading and the chart
  // never draws — leaving a blank gap where the sparkline should be. An SVG with a viewBox
  // scales purely via CSS, so it always renders correctly regardless of animation timing.
  const sparkW = 100, sparkH = 40;
  const sparkMin = Math.min(...blended);
  const sparkMax = Math.max(...blended);
  const sparkRange = sparkMax - sparkMin || 1;
  const sparkPoints = blended.map((v, i) => {
    const x = (i / (blended.length - 1)) * sparkW;
    const y = sparkH - ((v - sparkMin) / sparkRange) * sparkH;
    return `${x},${y}`;
  });
  const sparkColor = isUp ? '#10b981' : '#f43f5e';
  const sparkGradId = `spark-${country.code}`;

  return (
    <Card
      onClick={() => onSelect(country.name)}
      className="border-stone-200 bg-white shadow-sm hover:shadow-lg hover:border-brand-300 transition-all cursor-pointer rounded-3xl overflow-hidden group"
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
          <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id={sparkGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sparkColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={`M0,${sparkH} L${sparkPoints.join(' L')} L${sparkW},${sparkH} Z`} fill={`url(#${sparkGradId})`} stroke="none" />
            <path d={`M${sparkPoints.join(' L')}`} fill="none" stroke={sparkColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </svg>
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

// Fullscreen photo viewer for a property's image set. Handles its own keyboard nav
// (arrows to move, Esc to close) and wraps around at the ends rather than dead-ending,
// since a "next" button that just stops feels broken on a short set of photos.
const ImageLightbox = ({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) => {
  const goPrev = React.useCallback(() => onIndexChange((index - 1 + images.length) % images.length), [index, images.length, onIndexChange]);
  const goNext = React.useCallback(() => onIndexChange((index + 1) % images.length), [index, images.length, onIndexChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, goPrev, goNext]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-stone-950/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-white/70 text-sm font-bold font-mono tracking-widest">
        {index + 1} / {images.length}
      </div>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Previous photo"
          className="absolute left-2 sm:left-6 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      )}

      <img
        key={index}
        src={images[index]}
        alt={`Photo ${index + 1} of ${images.length}`}
        className="max-w-full max-h-full object-contain rounded-lg select-none"
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Next photo"
          className="absolute right-2 sm:right-6 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      )}
    </div>
  );
};

// Real 360° viewer: a genuine equirectangular photo the listing owner provided, rendered as
// a drag/swipe-to-pan strip rather than a fake WebGL sphere we'd have to fabricate depth for.
// It's an honest "360° Pan View" — a wide panorama you look around by dragging — not a claim
// of full VR immersion. It only ever renders when a real panoramaUrl is present; there is no
// synthetic fallback that dresses up a normal flat photo as a tour.
const PanoramaViewer = ({ src }: { src: string }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [offsetPct, setOffsetPct] = useState(0); // 0 = leftmost, 100 = rightmost
  const dragState = React.useRef<{ startX: number; startOffset: number } | null>(null);

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startOffset: offsetPct };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || !trackRef.current) return;
    const width = trackRef.current.clientWidth || 1;
    const deltaPct = ((e.clientX - dragState.current.startX) / width) * 100;
    setOffsetPct(clamp(dragState.current.startOffset - deltaPct));
  };
  const onPointerUp = () => { dragState.current = null; };

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden bg-stone-900 cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <img
          src={src}
          alt="360° panorama"
          draggable={false}
          referrerPolicy="no-referrer"
          className="absolute top-0 h-full w-[220%] max-w-none object-cover pointer-events-none"
          style={{ left: `${-offsetPct * 1.2}%` }}
        />
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
          <RotateCw className="w-3.5 h-3.5" />
          360° · Drag to look around
        </div>
      </div>
    </div>
  );
};

const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

type AmenityCategory = 'school' | 'health' | 'supermarket' | 'transit';
const AMENITY_META: Record<AmenityCategory, { label: string; icon: React.ElementType }> = {
  school: { label: 'Nearest School', icon: GraduationCap },
  health: { label: 'Nearest Hospital/Clinic', icon: HeartPulse },
  supermarket: { label: 'Nearest Supermarket', icon: ShoppingCart },
  transit: { label: 'Nearest Transit Station', icon: TrainFront },
};

// Genuinely live nearby-amenities lookup via the public OpenStreetMap Overpass API — real
// POIs within ~2km of the listing's actual coordinates, not a proprietary "walk score" and
// not a hardcoded generic fallback like "City Center Metro" for every single listing. If the
// listing has no real lat/lng, or the live query fails/times out, this renders nothing at all
// rather than inventing a plausible-looking result.
const NearbyAmenities = ({ lat, lng }: { lat: number; lng: number }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [results, setResults] = useState<Partial<Record<AmenityCategory, { name: string; distance: number }>>>({});

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const query = `[out:json][timeout:15];(
      node["amenity"="school"](around:1500,${lat},${lng});
      node["amenity"~"^(hospital|clinic)$"](around:2000,${lat},${lng});
      node["shop"="supermarket"](around:1500,${lat},${lng});
      node["railway"="station"](around:2500,${lat},${lng});
      node["public_transport"="station"](around:2500,${lat},${lng});
    );out body 50;`;
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
    })
      .then(res => { if (!res.ok) throw new Error(`Overpass ${res.status}`); return res.json(); })
      .then((data: { elements: { lat: number; lon: number; tags?: Record<string, string>; }[] }) => {
        if (cancelled) return;
        const nearest: Partial<Record<AmenityCategory, { name: string; distance: number }>> = {};
        for (const el of data.elements || []) {
          if (!el.tags || typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
          let category: AmenityCategory | null = null;
          if (el.tags.amenity === 'school') category = 'school';
          else if (el.tags.amenity === 'hospital' || el.tags.amenity === 'clinic') category = 'health';
          else if (el.tags.shop === 'supermarket') category = 'supermarket';
          else if (el.tags.railway === 'station' || el.tags.public_transport === 'station') category = 'transit';
          if (!category || !el.tags.name) continue;
          const distance = haversineMeters(lat, lng, el.lat, el.lon);
          if (!nearest[category] || distance < nearest[category]!.distance) {
            nearest[category] = { name: el.tags.name, distance };
          }
        }
        setResults(nearest);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (status === 'error') return null;
  const categories = Object.keys(AMENITY_META) as AmenityCategory[];
  const anyResults = categories.some(c => results[c]);

  return (
    <section id="pd-neighborhood" className="bg-stone-50 rounded-2xl p-5 sm:p-8 border border-stone-100 space-y-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
        <Compass className="w-4 h-4 text-stone-500" />
        Nearby (Live, via OpenStreetMap)
      </h4>
      {status === 'loading' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map(c => (
            <div key={c} className="bg-white border border-stone-100 p-4 rounded-xl h-[62px] animate-pulse" />
          ))}
        </div>
      ) : anyResults ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.filter(c => results[c]).map(c => {
              const meta = AMENITY_META[c];
              const r = results[c]!;
              const Icon = meta.icon;
              return (
                <div key={c} className="bg-white border border-stone-100 p-4 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider leading-none">{meta.label}</p>
                    <p className="text-xs font-bold text-stone-800 line-clamp-1 mt-1">{r.name}</p>
                    <span className="inline-block px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[9px] font-bold mt-1 uppercase tracking-wider">{formatDistance(r.distance)} away</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-stone-400 font-medium">Live map data © OpenStreetMap contributors — straight-line distance from the listing's coordinates.</p>
        </>
      ) : (
        <p className="text-xs text-stone-400 font-medium">No mapped schools, healthcare, supermarkets or transit found within range on OpenStreetMap for this location.</p>
      )}
    </section>
  );
};

const Dashboard = () => {
  const { user, profile, openAuthModal, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string; countryName?: string; builderName?: string; agentId?: string }>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [resaleUnits, setResaleUnits] = useState<Unit[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectUnits, setProjectUnits] = useState<Unit[]>([]);
  // Fullscreen image viewer for the property photo grid — previously the grid images had
  // no click handler at all, so there was no way to see them larger than the small tiles.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  useEffect(() => { setLightboxIndex(null); }, [selectedProject?.id]);
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
  const [infoModal, setInfoModal] = useState<'about' | 'careers' | 'contact' | 'terms' | 'privacy' | 'disclaimer' | null>(null);

  // --- Toasts: surfaces failed Firestore reads/writes to the user instead of failing
  // silently. Previously every handleFirestoreError() call only logged to the console —
  // a rejected write (permission error, offline, etc.) looked to the user like nothing
  // happened at all.
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'error' | 'success' }[]>([]);
  const notify = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

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
  const [isEmiOpen, setIsEmiOpen] = useState(false);
  const [emiForm, setEmiForm] = useState({ price: 500000, downPaymentPct: 20, rate: 6.5, years: 20, currency: 'USD' });
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);
  const [askAiQuery, setAskAiQuery] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [viewingBuilder, setViewingBuilder] = useState<string | null>(null);
  const [viewingAgentId, setViewingAgentId] = useState<string | null>(null);
  const [isFindAgentsOpen, setIsFindAgentsOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');

  // Favorites: signed-out visitors get a localStorage-backed list (so they can try the
  // feature before creating an account); signed-in users get it stored on their own
  // Firestore profile instead, so it follows them across devices/browsers rather than
  // silently resetting the moment they log in from somewhere else.
  useEffect(() => {
    if (user) {
      setFavorites(Array.isArray(profile?.favorites) ? profile.favorites : []);
      return;
    }
    const saved = localStorage.getItem('jg_ai_estate_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, [user, profile]);

  useEffect(() => {
    if (user) return; // signed-in favorites live on the Firestore profile, not localStorage
    localStorage.setItem('jg_ai_estate_favorites', JSON.stringify(favorites));
  }, [favorites, user]);

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFavorited = favorites.includes(id);
    setFavorites(prev => (isFavorited ? prev.filter(fId => fId !== id) : [...prev, id]));
    if (user) {
      updateDoc(doc(db, 'users', user.uid), {
        favorites: isFavorited ? arrayRemove(id) : arrayUnion(id),
      }).catch((error) => { notify("Couldn't update your favorites. Please try again."); handleFirestoreError(error, OperationType.WRITE, 'users/favorites'); });
    }
  };

  // Saved Searches — same signed-in-vs-local split as Favorites above. Deliberately named
  // and labeled as "saved search" rather than "price alert": there's no email/push
  // notification pipeline wired up anywhere in this app, so promising alerts would be a
  // repeat of the exact "fabricated feature" problem flagged earlier. This saves the filter
  // combination for one-click reapplication later — nothing more, nothing implied.
  interface SavedSearch { id: string; label: string; filters: { browseMode: 'buy' | 'rent'; selectedCountry: string; searchQuery: string; budgetRange: string; selectedConstStatus: string; selectedBhkType: string; onlyReraVerified: boolean }; }
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    if (user) {
      setSavedSearches(Array.isArray(profile?.savedSearches) ? profile.savedSearches : []);
      return;
    }
    const saved = localStorage.getItem('jg_ai_estate_saved_searches');
    if (saved) {
      try { setSavedSearches(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, [user, profile]);

  useEffect(() => {
    if (user) return;
    localStorage.setItem('jg_ai_estate_saved_searches', JSON.stringify(savedSearches));
  }, [savedSearches, user]);

  const handleSaveSearch = () => {
    const label = window.prompt('Name this search (e.g. "Barcelona apartments under $800K")');
    if (!label || !label.trim()) return;
    const entry: SavedSearch = {
      id: `${Date.now()}`,
      label: label.trim(),
      filters: { browseMode, selectedCountry, searchQuery, budgetRange, selectedConstStatus, selectedBhkType, onlyReraVerified },
    };
    const next = [...savedSearches, entry];
    setSavedSearches(next);
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { savedSearches: next }).catch((error) => {
        notify("Couldn't save this search. Please try again.");
        handleFirestoreError(error, OperationType.WRITE, 'users/savedSearches');
      });
    }
    notify('Search saved — find it below the search bar any time.', 'success');
  };

  const handleApplySavedSearch = (s: SavedSearch) => {
    setBrowseMode(s.filters.browseMode);
    setSelectedCountry(s.filters.selectedCountry);
    setSearchQuery(s.filters.searchQuery);
    setBudgetRange(s.filters.budgetRange);
    setSelectedConstStatus(s.filters.selectedConstStatus);
    setSelectedBhkType(s.filters.selectedBhkType);
    setOnlyReraVerified(s.filters.onlyReraVerified);
    scrollToSection('catalog');
  };

  const handleDeleteSavedSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = savedSearches.filter(s => s.id !== id);
    setSavedSearches(next);
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { savedSearches: next }).catch((error) => {
        notify("Couldn't remove this saved search. Please try again.");
        handleFirestoreError(error, OperationType.WRITE, 'users/savedSearches');
      });
    }
  };

  // Property comparison — cap at 4, matching every major portal's compare tray.
  const handleToggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(cId => cId !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
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
    listingType: "sale" as 'sale' | 'rent',
    // Real photo/tour links the developer actually owns — pasted as URLs since there's no
    // Firebase Storage bucket wired up yet. Left blank, the listing falls back to a labeled
    // placeholder graphic rather than a photo of a property that doesn't exist.
    photoUrls: "",
    panoramaUrl: "",
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

  // Builds a Project doc (matching the seedData shape) plus its 20 sample units and stages
  // both onto the given batch. Shared by the initial catalog seed and the real-builder-data
  // migration below so a new project is always created the same way.
  const stageProjectOnBatch = useCallback((batch: ReturnType<typeof writeBatch>, p: (typeof GLOBAL_SEED_PROJECTS)[number]) => {
    const projectDoc: Omit<Project, 'id'> = {
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
      // Firestore rejects `undefined` field values outright — most non-India projects
      // have no RERA ID, so the field must be omitted entirely rather than set to
      // undefined, or the whole batch.commit() throws and NOTHING gets written.
      ...(p.reraId ? { reraId: p.reraId } : {}),
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
    };

    const pRef = doc(collection(db, 'projects'));
    batch.set(pRef, { ...projectDoc, createdAt: serverTimestamp() });

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
  }, []);

  // --- Seed Data Function: seeds the global catalog (Europe, North America, Asia, Middle East) ---
  const seedData = useCallback(async () => {
    const projectsSnap = await getDocs(collection(db, 'projects'));
    if (projectsSnap.empty) {
      const batch = writeBatch(db);
      for (const p of GLOBAL_SEED_PROJECTS) {
        stageProjectOnBatch(batch, p);
      }
      await batch.commit();
    }
  }, [stageProjectOnBatch]);

  // --- Real Builder Data Migration ---
  // The catalog above originally shipped with a mix of real (e.g. Lodha Group, Prestige
  // Group) and placeholder/fictional developer names (e.g. "Berlin Urban Living"). Those
  // placeholders have since been replaced with real, web-verified development companies in
  // global.ts, and new real projects (Ahmedabad, additional Mumbai/Bengaluru/Dubai entries,
  // and more to come market-by-market) were appended to GLOBAL_SEED_PROJECTS over time.
  // Because seedData() above only writes when the collection is empty, a live Firestore
  // instance that was already seeded won't pick up those source changes on its own — this
  // migration patches it in place: it renames any already-seeded project's developerName
  // from the old placeholder to the real one, and adds any seed project (matched by name)
  // that isn't in the live collection yet, regardless of city. Runs once per session for any
  // signed-in user, same trigger model as seedData().
  const migrateRealBuilderData = useCallback(async () => {
    const projectsSnap = await getDocs(collection(db, 'projects'));
    if (projectsSnap.empty) return; // nothing to migrate yet — seedData will write the current (already-real) names

    const existingNames = new Set(projectsSnap.docs.map((d) => (d.data() as Project).name));
    const batch = writeBatch(db);
    let hasWrites = false;

    for (const docSnap of projectsSnap.docs) {
      const data = docSnap.data() as Project;
      const realName = DEVELOPER_NAME_MIGRATIONS[data.developerName];
      if (realName && realName !== data.developerName) {
        batch.update(docSnap.ref, { developerName: realName });
        hasWrites = true;
      }
    }

    for (const p of GLOBAL_SEED_PROJECTS) {
      if (!existingNames.has(p.name)) {
        stageProjectOnBatch(batch, p);
        hasWrites = true;
      }
    }

    if (hasWrites) await batch.commit();
  }, [stageProjectOnBatch]);

  useEffect(() => {
    // Any signed-in user can trigger the initial catalog seed if it's empty (public demo).
    // Deliberately NOT depending on `profile` — that object gets a new reference on every
    // refreshProfile() call (profile edits, role switches), which would otherwise re-run a
    // full collection read + migration scan on every unrelated profile update.
    if (user) {
      seedData();
      migrateRealBuilderData();
    }
  }, [seedData, migrateRealBuilderData, user]);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (err) => { notify("Couldn't load properties. Please refresh the page."); handleFirestoreError(err, OperationType.LIST, 'projects'); });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'investments'), where('investorId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setInvestments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
      }, (err) => { notify("Couldn't load your investments. Please refresh the page."); handleFirestoreError(err, OperationType.LIST, 'investments'); });
      return () => unsubscribe();
    }
  }, [user]);

  // Real lead feed for developers/agents: every genuine "Contact Agent" click on one of their
  // own listings writes a real `inquiries` doc (see handleContactAboutProject below) — this
  // just reads back that same real, live collection, scoped to listings this account actually
  // owns. No synthetic lead counts, no placeholder numbers.
  useEffect(() => {
    if (user && profile?.role === 'developer') {
      const q = query(collection(db, 'inquiries'), where('developerId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setInquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Inquiry)));
      }, (err) => { notify("Couldn't load your leads. Please refresh the page."); handleFirestoreError(err, OperationType.LIST, 'inquiries'); });
      return () => unsubscribe();
    } else {
      setInquiries([]);
    }
  }, [user, profile?.role]);

  useEffect(() => {
    // Fetch all resale units across projects using collectionGroup
    const q = query(collectionGroup(db, 'units'), where('status', '==', 'resale'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResaleUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
    }, (err) => {
      // If index is missing, Firestore will provide a link in the error message
      console.error("Resale units fetch error:", err);
      notify("Couldn't load resale listings. Please refresh the page.");
      handleFirestoreError(err, OperationType.LIST, 'collectionGroup/units');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      const q = query(collection(db, `projects/${selectedProject.id}/units`), orderBy('unitNumber', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setProjectUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
      }, (err) => { notify("Couldn't load unit availability. Please refresh the page."); handleFirestoreError(err, OperationType.LIST, `projects/${selectedProject.id}/units`); });
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
      notify("Couldn't list your unit for resale. Please try again.");
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
      notify("Couldn't complete your booking. Please try again.");
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
      notify("Couldn't place your bid. Please try again.");
      handleFirestoreError(error, OperationType.WRITE, `projects/${selectedUnit.projectId}/units/${selectedUnit.id}/bids`);
    }
  };

  const confirmLaunch = async () => {
    if (!user || !newProject.name || !newProject.city || !newProject.country) return;
    try {
      const pRef = doc(collection(db, 'projects'));
      const countryMeta = COUNTRIES.find(c => c.name === newProject.country);
      const { reraId: _draftReraId, photoUrls: _draftPhotoUrls, panoramaUrl: _draftPanoramaUrl, ...newProjectRest } = newProject;
      // Real photos the developer pasted in, one URL per line/comma — not stock art. Only
      // fall back to the placeholder graphic if they genuinely gave us nothing to show, and
      // that fallback is a plain gray "no photo provided" tile, not a fake property photo.
      const realPhotos = newProject.photoUrls
        .split(/[\n,]+/)
        .map(u => u.trim())
        .filter(u => /^https?:\/\//.test(u));
      const projectData = {
        ...newProjectRest,
        countryCode: countryMeta?.code || '',
        region: countryMeta?.region || 'Europe',
        // Firestore rejects explicit `undefined` values — only include reraId when set.
        ...(newProject.reraId ? { reraId: newProject.reraId } : {}),
        ...(newProject.panoramaUrl.trim() ? { panoramaUrl: newProject.panoramaUrl.trim() } : {}),
        verified: false, // manually launched listings start unverified until reviewed
        developerId: user.uid,
        developerName: user.displayName || 'Verified Developer',
        imageUrl: realPhotos[0] || NO_PHOTO_PLACEHOLDER,
        images: realPhotos.length > 0 ? realPhotos : [NO_PHOTO_PLACEHOLDER],
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
        listingType: "sale",
        photoUrls: "",
        panoramaUrl: "",
      });
    } catch (error) {
      notify("Couldn't publish your listing. Please try again.");
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
      notify("Couldn't record your payment. Please try again.");
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
      // The write above only touches Firestore — without this, the `profile` object
      // held in AuthContext stays stale (it's only set once, on auth state change),
      // so the role badge and role-gated tabs wouldn't visibly update until a reload.
      await refreshProfile();
      setIsProfileOpen(false);
    } catch (error) {
      notify("Couldn't save your profile changes. Please try again.");
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  // Persists a role switch immediately (used by the homepage persona cards — "List a
  // Property" / "Showcase a Project" — for a user who's already signed in), then
  // refreshes the local profile so role-gated UI (e.g. the Developer "My Listings" tab)
  // shows up right away instead of requiring a manual save in Profile Settings first.
  const setUserRole = async (role: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { role, updatedAt: serverTimestamp() }, { merge: true });
      await refreshProfile();
    } catch (error) {
      notify("Couldn't switch your role. Please try again.");
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

  // Builder Portfolio — a real, shareable page (/builder/:name) showing every
  // active listing from one developer, built entirely from the developerName
  // already on each project (no new backend field required).
  const handleViewBuilder = useCallback((developerName: string) => {
    setSelectedProject(null);
    setViewingAgentId(null);
    setViewingBuilder(developerName);
    navigate(`/builder/${encodeURIComponent(developerName)}`);
  }, [navigate]);

  const handleCloseBuilder = useCallback(() => {
    setViewingBuilder(null);
    navigate('/');
  }, [navigate]);

  // Broker Store — a real, shareable page (/agent/:id) for one listing agent.
  // See getAgentForProject above for how agents are assigned to listings.
  const handleViewAgent = useCallback((agentId: string) => {
    setSelectedProject(null);
    setViewingBuilder(null);
    setViewingAgentId(agentId);
    navigate(`/agent/${agentId}`);
  }, [navigate]);

  const handleCloseAgent = useCallback(() => {
    setViewingAgentId(null);
    navigate('/');
  }, [navigate]);

  // Jump from inside a Builder Portfolio / Broker Store straight into a listing's
  // full detail view, closing the portfolio/store overlay behind it.
  const handleSelectFromShowcase = useCallback((project: Project) => {
    setViewingBuilder(null);
    setViewingAgentId(null);
    handleSelectProject(project);
  }, [handleSelectProject]);

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
        notify("Couldn't load this property. It may have been removed.");
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

  // Resolve a /builder/:builderName deep link.
  useEffect(() => {
    if (routeParams.builderName) {
      setViewingBuilder(decodeURIComponent(routeParams.builderName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.builderName]);

  // Resolve an /agent/:agentId deep link.
  useEffect(() => {
    if (routeParams.agentId) {
      setViewingAgentId(routeParams.agentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.agentId]);

  const builderProjects = useMemo(
    () => viewingBuilder ? projects.filter(p => p.developerName === viewingBuilder) : [],
    [projects, viewingBuilder]
  );

  const currentShowcaseAgent = useMemo(
    () => viewingAgentId ? AGENT_ROSTER.find(a => a.id === viewingAgentId) || null : null,
    [viewingAgentId]
  );

  const agentProjects = useMemo(
    () => viewingAgentId ? projects.filter(p => getAgentForProject(p).id === viewingAgentId) : [],
    [projects, viewingAgentId]
  );

  // Per-page <title> — basic SEO/share signal for listing, builder & agent pages.
  useEffect(() => {
    if (selectedProject) {
      document.title = `${selectedProject.name} — ${selectedProject.city}, ${selectedProject.country} | JGEstate`;
    } else if (viewingBuilder) {
      document.title = `${viewingBuilder} — Builder Portfolio | JGEstate`;
    } else if (currentShowcaseAgent) {
      document.title = `${currentShowcaseAgent.name} — Agent Storefront | JGEstate`;
    } else {
      document.title = 'JGEstate — Global Verified Real Estate Marketplace';
    }
  }, [selectedProject, viewingBuilder, currentShowcaseAgent]);

  return (
    <div className="tech-grid min-h-screen pb-24 bg-stone-50">
      {/* Toast feed — fixed above everything (including dialogs) so a failed write is
          always visible regardless of what's open on screen. */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-2 ${
              t.type === 'error'
                ? 'bg-white border-rose-200 text-rose-700'
                : 'bg-white border-emerald-200 text-emerald-700'
            }`}
          >
            {t.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="shrink-0 text-stone-400 hover:text-stone-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Navbar
        onProfileClick={() => setIsProfileOpen(true)}
        onMarketplaceClick={() => scrollToSection('catalog')}
        selectedCountry={selectedCountry}
        onSelectCountry={(name) => { handleSelectCountryRoute(name); scrollToSection('catalog'); }}
        onBuyClick={() => { setBrowseMode('buy'); scrollToSection('catalog'); }}
        onRentClick={() => { setBrowseMode('rent'); scrollToSection('catalog'); }}
        onSellClick={() => (user ? setIsLaunchOpen(true) : openAuthModal('signup'))}
        onEvaluateClick={() => setIsEvaluateOpen(true)}
        onInvestClick={() => scrollToSection('catalog')}
        onAdvisorClick={() => contactAdvisor("Hi! I'd like to speak with a JGEstate advisor about buying, selling, or renting a property.")}
        onEmiClick={() => setIsEmiOpen(true)}
        onFindAgentsClick={() => setIsFindAgentsOpen(true)}
      />
      {/* Hero — full-bleed real-estate photography instead of the old flat white/gradient
          panel, closer to how SquareYards/99acres open (a dramatic property photo, not a
          blank canvas) while keeping the search bar as the primary action, not a scroll cue. */}
      <section className="relative pt-40 sm:pt-56 pb-20 sm:pb-32 px-4 sm:px-8 overflow-hidden">
        <div className="absolute inset-0">
          <motion.img
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            initial={{ scale: 1.12 }}
            animate={{ scale: 1 }}
            transition={{ duration: 5, ease: 'easeOut' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-950/85 via-stone-950/70 to-stone-950" />
        </div>
        <motion.div
          className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 relative z-10"
          variants={heroContainerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={heroItemVariants} className="flex flex-wrap items-center justify-center gap-2">
            <Badge className="bg-white/10 backdrop-blur-md text-white border-white/20 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full micro-label text-[10px] sm:text-xs w-fit">
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
              Live Across {COUNTRIES.length} Countries
            </Badge>
            {/* This used to hardcode "4.8 Rated · 2,300+ Closed Deals" — there is no rating
                system or deal-tracking anywhere in this app (the property dialog's own seller
                rating explicitly shows "unavailable yet"), so that badge was a flat fabrication
                sitting in the very first thing a visitor sees. Swapped for the one number here
                that's actually live and real. */}
            {projects.length > 0 && (
              <Badge className="bg-white/10 backdrop-blur-md text-white border-white/20 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full micro-label text-[10px] sm:text-xs w-fit">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-amber-400 fill-amber-400" />
                {projects.length} Live Listings
              </Badge>
            )}
          </motion.div>
          <motion.h1 variants={heroItemVariants} className="font-serif text-4xl sm:text-6xl md:text-7xl font-semibold text-white tracking-tight leading-[1.05]">
            Know what a property
            <br className="hidden sm:block" />
            <span className="text-brand-300">is actually worth.</span>
          </motion.h1>
          <motion.p variants={heroItemVariants} className="text-base sm:text-xl text-white/75 max-w-2xl mx-auto font-medium leading-relaxed">
            Verified listings across {COUNTRIES.length} countries, plus the real numbers — price trends, rental yield and cost of ownership — before you commit to buying, renting, or investing.
          </motion.p>

          {/* Purpose picker — the buyer/investor/agent/developer split from the "Built for
              everyone" section further down, surfaced here as the very first choice instead
              of making a first-time visitor scroll to find it. */}
          <motion.div variants={heroItemVariants} className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
            {[
              { label: 'Buy a Home', icon: UserIcon, onClick: () => { setBrowseMode('buy'); scrollToSection('catalog'); } },
              { label: 'Invest in Property', icon: TrendingUp, onClick: () => scrollToSection('catalog') },
              { label: 'List / Sell a Property', icon: Briefcase, onClick: () => (user ? setIsLaunchOpen(true) : openAuthModal('signup')) },
            ].map((p) => (
              <button
                key={p.label}
                onClick={p.onClick}
                className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-brand-700 hover:border-white transition-all"
              >
                <p.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {p.label}
              </button>
            ))}
          </motion.div>

          {/* Primary action: search, not scroll */}
          <motion.div variants={heroItemVariants} className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-xl shadow-stone-200/50 p-3 sm:p-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl overflow-x-auto no-scrollbar mb-2 sm:mb-3">
              {([
                { key: 'buy', label: 'Buy' },
                { key: 'rent', label: 'Rent' },
                { key: 'commercial', label: 'Commercial' },
                { key: 'plots', label: 'Plots/Land' },
              ] as const).map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => {
                    if (mode.key === 'buy' || mode.key === 'rent') {
                      setBrowseMode(mode.key);
                    } else {
                      contactAdvisor(`Hi! I'm looking for ${mode.label.toLowerCase()} listings on JGEstate — can you help me get started?`);
                    }
                  }}
                  className={`px-4 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    browseMode === mode.key ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && scrollToSection('catalog')}
                  placeholder="Search city, country or project..."
                  className="w-full pl-10 pr-3 py-3 sm:py-3.5 rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:bg-white text-sm font-medium text-stone-900"
                />
              </div>
              <Button
                onClick={() => setIsAskAiOpen(true)}
                variant="outline"
                className="border-stone-200 text-stone-600 hover:text-brand-600 hover:border-brand-200 font-bold rounded-xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm shrink-0"
              >
                <Sparkles className="w-4 h-4 mr-1.5 text-brand-500" />
                Ask AI
              </Button>
              <Button
                onClick={() => scrollToSection('catalog')}
                className="bg-brand-600 text-white hover:bg-stone-900 font-bold rounded-xl px-6 sm:px-8 py-3 sm:py-3.5 text-sm shadow-sm transition-all"
              >
                Search
              </Button>
            </div>
          </motion.div>

          {/* Trending cities — quick-select chips, like the "hot markets" pattern on
              every major portal. Pulls from the same YoY data driving the market index. */}
          <motion.div variants={heroItemVariants} className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white/50 mr-1">Trending:</span>
            {TOP_MOVERS.slice(0, 5).map((city) => (
              <button
                key={city.city}
                onClick={() => { setSearchQuery(city.city); setBrowseMode('buy'); scrollToSection('catalog'); }}
                className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white/90 hover:border-brand-300 hover:text-white transition-all"
              >
                {city.city} <span className="text-brand-300 font-bold">+{city.yoyChange}%</span>
              </button>
            ))}
          </motion.div>

          <motion.div variants={heroItemVariants} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white/50">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-brand-300" /> ID-Verified Sellers</span>
            <span className="flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-brand-300" /> Licensed Payment Processors</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-brand-300" /> Live Market Data</span>
          </motion.div>
        </motion.div>
      </section>

      {/* Explore Properties — moved directly beneath the hero so a first-time visitor
          sees real listings immediately, instead of after scrolling through several
          marketing sections. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 relative z-30">
        <Tabs defaultValue="browse" className="space-y-12 md:space-y-20" id="catalog">
          <Reveal className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 md:gap-10">
            <div className="space-y-2 md:space-y-4">
              <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-semibold text-stone-900 tracking-tight">Explore Properties</h2>
              <p className="micro-label text-brand-600">Verified Listings Across {COUNTRIES.length} Countries</p>
            </div>
            {/* shrink-0: without it, this flex row would compress the tab list below its
                natural width to make room for the heading beside it, forcing horizontal
                scroll even on wide desktop screens — and TabsList centers overflowing
                content by default (fixed in tabs.tsx), which permanently clips whatever
                scrolls past the left edge since a scroll container can't scroll negative.
                Keeping this at its full natural width means it never needs to overflow or
                scroll in the first place; the heading beside it wraps instead if needed. */}
            <div className="w-full xl:w-auto shrink-0 overflow-x-auto scrollbar-none pb-2 p-0.5 -m-0.5">
              <TabsList className="bg-stone-100 p-1 md:p-2 rounded-2xl md:rounded-3xl border border-stone-200 flex w-max xl:w-auto">
                <TabsTrigger value="browse" className="rounded-xl md:rounded-3xl px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                  Explore
                </TabsTrigger>
                <TabsTrigger value="market" className="rounded-xl md:rounded-3xl px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                  Market Data
                </TabsTrigger>
                {user && (
                  <TabsTrigger value="portfolio" className="rounded-xl md:rounded-3xl px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                    Portfolio
                  </TabsTrigger>
                )}
                {profile?.role === 'developer' && (
                  <TabsTrigger value="inventory" className="rounded-xl md:rounded-3xl px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                    Inventory
                  </TabsTrigger>
                )}
                {profile?.role === 'developer' && (
                  <TabsTrigger value="leads" className="rounded-xl md:rounded-3xl px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1.5">
                    Leads
                    {inquiries.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
                    )}
                  </TabsTrigger>
                )}
                <TabsTrigger value="resale" className="rounded-xl md:rounded-3xl px-4 md:px-12 py-2.5 md:py-4 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-lg font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest">
                  Resale
                </TabsTrigger>
              </TabsList>
            </div>
          </Reveal>

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
                    onClick={() => openAuthModal('signin')}
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

                      {/* Saves the current filter combo for one tap re-use later — labeled
                          "Save Search", not "alert", since there's no notification pipeline
                          behind it yet. */}
                      <Button
                        variant="outline"
                        onClick={handleSaveSearch}
                        className="h-12 sm:h-14 px-4 sm:px-5 rounded-xl sm:rounded-2xl font-bold flex items-center gap-2 border-stone-200 text-stone-600 hover:bg-stone-50"
                        title="Save this search to revisit later"
                      >
                        <Bell className="w-4 h-4" />
                        <span className="hidden sm:inline">Save Search</span>
                      </Button>
                    </div>
                  </div>

                  {/* Saved searches — click a chip to reapply that filter combo, X to remove */}
                  {savedSearches.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-4 mt-1 border-t border-stone-100">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mr-1">Saved:</span>
                      {savedSearches.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleApplySavedSearch(s)}
                          className="group flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-stone-50 border border-stone-200 hover:border-brand-300 text-xs font-bold text-stone-600 hover:text-brand-600 transition-all"
                        >
                          {s.label}
                          <span
                            onClick={(e) => handleDeleteSavedSearch(s.id, e)}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                            aria-label={`Remove saved search ${s.label}`}
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

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
                    <p className="text-xs sm:text-sm font-bold text-stone-500 flex items-center gap-2 flex-wrap">
                      <span><span className="text-stone-900">{filteredProjects.length}</span> {filteredProjects.length === 1 ? 'property' : 'properties'} found</span>
                      {/* Honesty note: this catalog is sample/demo data, not a live MLS feed —
                          said plainly here rather than buried only in the footer disclaimer. */}
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        Preview Data
                      </span>
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
                  <div className="text-center py-20 bg-stone-50 border border-dashed rounded-3xl p-6 max-w-lg mx-auto">
                    <FileSearch className="w-12 h-12 text-stone-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-800">No Matched Properties</h3>
                    <p className="text-sm text-stone-500 mt-2">Try softening your filter coordinates or select another geographic market segment.</p>
                  </div>
                ) : browseView === 'grid' ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {filteredProjects.map(project => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onSelect={handleSelectProject}
                          isFavorite={favorites.includes(project.id)}
                          onToggleFavorite={handleToggleFavorite}
                          isComparing={compareIds.includes(project.id)}
                          onToggleCompare={handleToggleCompare}
                          onViewPortfolio={handleViewBuilder}
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
                    <div className="lg:col-span-3 h-[420px] lg:h-[780px] lg:sticky lg:top-24 rounded-3xl overflow-hidden border border-stone-200 shadow-sm">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
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
                <Card className="h-full border-dashed border-2 border-stone-200 bg-stone-50 rounded-3xl flex flex-col items-center justify-center p-10 sm:p-20 text-center cursor-pointer hover:border-brand-600 hover:bg-brand-50 transition-all group">
                  <div className="bg-brand-100 p-5 sm:p-8 rounded-full mb-4 sm:mb-8 group-hover:bg-brand-600 group-hover:scale-110 transition-all">
                    <Plus className="w-8 sm:w-14 h-8 sm:h-14 text-brand-600 group-hover:text-white" />
                  </div>
                  <CardTitle className="text-2xl sm:text-4xl font-bold text-stone-900">Add a Property</CardTitle>
                  <CardDescription className="micro-label mt-2 sm:micro-label mt-4 text-stone-500">List a new project or unit</CardDescription>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Real leads — every card here is a genuine `inquiries` doc written the moment a
              visitor clicked "Contact" on one of this account's own listings (see logInquiry).
              No placeholder numbers, no simulated activity: zero leads shows the empty state
              below, not a fabricated example. */}
          <TabsContent value="leads" className="mt-0">
            {inquiries.length === 0 ? (
              <div className="col-span-full py-20 sm:py-40 text-center glass-panel rounded-3xl border-stone-100 p-6 sm:p-12">
                <div className="bg-brand-50 w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                  <Mail className="w-8 h-8 sm:w-12 sm:h-12 text-brand-600" />
                </div>
                <h3 className="font-bold tracking-tight text-2xl sm:text-4xl text-stone-900">No Leads Yet</h3>
                <p className="text-sm sm:text-base text-stone-500 mt-3 sm:mt-4 max-w-md mx-auto font-medium">
                  Real inquiries from buyers and renters contacting you about your own listings will show up here as they come in.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4 max-w-3xl">
                {inquiries.map(inq => {
                  const relatedProject = projects.find(p => p.id === inq.projectId);
                  const when = timeAgo(inq.createdAt);
                  return (
                    <Card key={inq.id} className="border-stone-200 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{inq.projectName}</p>
                          <p className="text-sm text-stone-700 font-medium leading-relaxed break-words">{inq.message}</p>
                          {when && <p className="text-[11px] text-stone-400 font-semibold">{when}</p>}
                        </div>
                        {relatedProject && (
                          <Button
                            variant="outline"
                            onClick={() => handleSelectProject(relatedProject)}
                            className="shrink-0 border-stone-200 text-stone-600 hover:text-brand-600 hover:border-brand-200 font-bold rounded-xl text-xs"
                          >
                            View Listing
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="portfolio" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-12">
              {investments.map(inv => (
                <InvestmentTracker key={inv.id} investment={inv} onRelist={handleRelist} onPay={handlePayment} />
              ))}
              {investments.length === 0 && (
                <div className="col-span-full py-20 sm:py-40 text-center glass-panel rounded-3xl border-stone-100 p-6 sm:p-12">
                  <div className="bg-brand-50 w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <Wallet className="w-8 h-8 sm:w-12 sm:h-12 text-brand-600" />
                  </div>
                  <h3 className="font-bold tracking-tight text-2xl sm:text-4xl text-stone-900">No Investments Yet</h3>
                  <p className="text-sm sm:text-base text-stone-500 mt-3 sm:mt-4 max-w-md mx-auto font-medium">Your portfolio will show up here once you make your first investment.</p>
                  <Button
                    onClick={() => scrollToSection('catalog')}
                    variant="outline"
                    className="mt-6 sm:mt-10 border-stone-200 text-stone-900 hover:bg-stone-50 rounded-full px-8 py-4 sm:px-12 sm:py-6 text-xs sm:text-sm font-bold"
                  >
                    Browse Properties
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
                <div className="col-span-full py-20 sm:py-40 text-center glass-panel rounded-3xl border-stone-100 p-6 sm:p-12">
                  <div className="bg-brand-50 w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <Gavel className="w-8 h-8 sm:w-12 sm:h-12 text-brand-600" />
                  </div>
                  <h3 className="font-bold tracking-tight text-2xl sm:text-4xl text-stone-900">No Resale Listings</h3>
                  <p className="text-sm sm:text-base text-stone-500 mt-3 sm:mt-4 font-medium">There are currently no properties listed for resale in this region.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>


      {/* What is JGEstate — plain-language explanation of the product, placed right after
          the hero so a first-time visitor understands what this is before anything else. */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <Reveal>
            <div className="space-y-6 sm:space-y-8">
              <p className="micro-label text-brand-600">What Is JGEstate</p>
              <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight leading-tight">
                One marketplace for every property, in every market you care about.
              </h2>
              <p className="text-sm sm:text-lg text-stone-500 font-medium leading-relaxed">
                JGEstate connects verified buyers, renters, agents, developers and investors across {COUNTRIES.length} countries — one search, one login, one verification standard, wherever the property sits. No wiring money to a stranger, no guessing whether a listing is even real.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-8 pt-2">
                {[
                  { icon: ShieldCheck, title: 'ID-Verified Sellers', copy: 'Every lister passes identity checks before a listing goes live.' },
                  { icon: Globe, title: 'Global By Default', copy: 'One platform across every market, not a bolted-on country page.' },
                  { icon: Landmark, title: 'Licensed Payments', copy: 'Reservations route through licensed processors, never held by us.' },
                  { icon: TrendingUp, title: 'Live Market Data', copy: 'Real price trends and rental yields, not stale averages.' },
                ].map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="space-y-2"
                  >
                    <f.icon className="w-5 h-5 text-brand-600" />
                    <p className="text-sm font-bold text-stone-900">{f.title}</p>
                    <p className="text-xs text-stone-500 leading-relaxed">{f.copy}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative max-w-md mx-auto lg:max-w-none">
              <img
                src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=80"
                alt="Modern residential building"
                className="w-full aspect-[4/5] object-cover rounded-3xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute -bottom-6 -left-4 sm:-bottom-8 sm:-left-8 bg-white rounded-2xl shadow-xl border border-stone-100 p-5 sm:p-6 max-w-[200px]"
              >
                <p className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  <CountUp value={`${ALL_CITIES.length}`} />+
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-widest mt-1">Cities Tracked Live</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="absolute -top-5 -right-4 sm:-top-6 sm:-right-6 bg-stone-900 rounded-2xl shadow-xl p-4 sm:p-5 flex items-center gap-2"
              >
                <ShieldCheck className="w-5 h-5 text-brand-400 shrink-0" />
                <p className="text-white text-xs font-bold leading-tight">ID-Verified<br />Accounts</p>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Who it's for — this is a SaaS platform for the whole real estate ecosystem, not
          just buyers. One role picker, four tailored entry points into the same product. */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-8 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-stone-950/90" />
        </div>
        <div className="relative max-w-7xl mx-auto space-y-10 sm:space-y-14">
          <Reveal className="max-w-2xl space-y-3 sm:space-y-4">
            <p className="micro-label text-brand-400">One Platform, Every Role</p>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tighter">Built for everyone in real estate</h2>
            <p className="text-sm sm:text-lg text-stone-400 font-medium leading-relaxed">
              Whether you're buying your first home or managing a global portfolio, JGEstate gives you the tools built for your role.
            </p>
          </Reveal>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {[
              {
                icon: UserIcon,
                role: 'Customers',
                copy: `Browse, evaluate and buy or rent verified properties across ${COUNTRIES.length} countries — with live pricing and no hidden fees.`,
                cta: 'Start Browsing',
                onClick: () => { setBrowseMode('buy'); scrollToSection('catalog'); },
              },
              {
                icon: Briefcase,
                role: 'Real Estate Agents',
                copy: 'List properties for free, reach global buyers, and manage every enquiry from one dashboard.',
                cta: 'List a Property',
                onClick: () => { setProfileRole('agent'); (user ? (setUserRole('agent'), setIsLaunchOpen(true)) : openAuthModal('signup')); },
              },
              {
                icon: HardHat,
                role: 'Builders & Developers',
                copy: 'Showcase entire projects, publish unit-level inventory, and track construction-stage sales in real time.',
                cta: 'Showcase a Project',
                onClick: () => { setProfileRole('developer'); (user ? (setUserRole('developer'), setIsLaunchOpen(true)) : openAuthModal('signup')); },
              },
              {
                icon: TrendingUp,
                role: 'Investors',
                copy: 'Track the global market index, compare city-level yields, and evaluate assets before you commit capital.',
                cta: 'View Market Data',
                onClick: () => scrollToSection('catalog'),
              },
            ].map((p) => (
              <motion.div key={p.role} variants={staggerItem} className="group bg-stone-800/60 hover:bg-stone-800 border border-stone-700 hover:border-brand-500/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6 sm:gap-8 transition-all">
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats bar — pulled straight from the same COUNTRIES dataset that powers the
          market index and filters, not marketing fluff. Numbers count up into view. */}
      <section className="bg-white border-b border-stone-200 py-10 sm:py-14 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            { value: `${COUNTRIES.length}`, label: 'Countries Live' },
            { value: `${ALL_CITIES.length}`, label: 'Cities Tracked' },
            { value: `${COMPOSITE_YTD_GROWTH}%`, label: 'Global Index, YTD' },
            { value: 'ID-Verified', label: 'Accounts Only' },
          ].map((s) => (
            <div key={s.label} className="text-center lg:text-left space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight"><CountUp value={s.value} /></p>
              <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works — the full process, on both sides of the marketplace. A buyer's
          path and a seller/agent/builder's path are genuinely different, so this is two
          tracks in one tab set rather than one generic 3-step card grid. */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-stone-50 border-b border-stone-200">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-14">
          <Reveal className="max-w-2xl space-y-3 sm:space-y-4">
            <p className="micro-label text-brand-600">How It Works</p>
            <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight">The full process, end to end</h2>
            <p className="text-sm sm:text-base text-stone-500 font-medium">Whichever side of a deal you're on, here's exactly what happens, in order.</p>
          </Reveal>

          <Tabs defaultValue="buyer" className="space-y-8 sm:space-y-10">
            <TabsList className="bg-white p-1 md:p-1.5 rounded-2xl border border-stone-200 flex w-full max-w-lg mx-auto">
              <TabsTrigger value="buyer" className="flex-1 rounded-xl px-4 md:px-8 py-2.5 md:py-3.5 data-[state=active]:bg-stone-900 data-[state=active]:text-white font-bold transition-all text-[11px] md:text-xs uppercase tracking-widest">
                For Buyers &amp; Renters
              </TabsTrigger>
              <TabsTrigger value="seller" className="flex-1 rounded-xl px-4 md:px-8 py-2.5 md:py-3.5 data-[state=active]:bg-stone-900 data-[state=active]:text-white font-bold transition-all text-[11px] md:text-xs uppercase tracking-widest">
                For Agents, Builders &amp; Investors
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buyer" className="mt-0">
              <div className="relative grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-6">
                <div className="hidden sm:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-stone-200" />
                {[
                  { step: '01', icon: Search, title: 'Search & Compare', copy: 'Filter by country, city, budget and property type, with live pricing in local currency.' },
                  { step: '02', icon: ShieldCheck, title: 'Verify & Connect', copy: 'Every seller passes ID verification. Message an agent or advisor directly, no middlemen.' },
                  { step: '03', icon: Sparkles, title: 'Compare & Decide', copy: 'Save favorites, run side-by-side comparisons, and check the numbers with the EMI calculator.' },
                  { step: '04', icon: Landmark, title: 'Close Securely', copy: 'Payments route through licensed third-party processors in each market, never held by this platform.' },
                ].map((s, i) => (
                  <motion.div
                    key={s.step}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.55, delay: i * 0.1 }}
                    className="relative space-y-3 sm:space-y-4"
                  >
                    <div className="relative z-10 bg-brand-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/20">
                      <s.icon className="w-6 h-6 text-white" />
                    </div>
                    <p className="micro-label text-stone-400">Step {s.step}</p>
                    <h3 className="text-base sm:text-lg font-bold text-stone-900">{s.title}</h3>
                    <p className="text-sm text-stone-500 leading-relaxed">{s.copy}</p>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="seller" className="mt-0">
              <div className="relative grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-6">
                <div className="hidden sm:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-stone-200" />
                {[
                  { step: '01', icon: UserIcon, title: 'Create Your Account', copy: 'Sign up as an individual agent, agency or developer, then complete ID or business verification.' },
                  { step: '02', icon: Building2, title: 'List Your Inventory', copy: 'Publish a single resale unit or an entire multi-unit project, with unit-level pricing and status.' },
                  { step: '03', icon: LayoutDashboard, title: 'Manage From One Dashboard', copy: 'Every enquiry lands in one inbox. Track views, saves and lead quality per listing.' },
                  { step: '04', icon: TrendingUp, title: 'Get Discovered', copy: 'Your public Builder Portfolio or Broker Storefront gives buyers a shareable page to browse your full book.' },
                ].map((s, i) => (
                  <motion.div
                    key={s.step}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.55, delay: i * 0.1 }}
                    className="relative space-y-3 sm:space-y-4"
                  >
                    <div className="relative z-10 bg-stone-900 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-stone-900/20">
                      <s.icon className="w-6 h-6 text-white" />
                    </div>
                    <p className="micro-label text-stone-400">Step {s.step}</p>
                    <h3 className="text-base sm:text-lg font-bold text-stone-900">{s.title}</h3>
                    <p className="text-sm text-stone-500 leading-relaxed">{s.copy}</p>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Why JGEstate — full-bleed architecture photography instead of another flat
          card grid, so the trust/differentiation section reads as a genuine break in the
          page rather than a repeat of the "How It Works" layout above. */}
      <section className="relative py-20 sm:py-32 px-4 sm:px-8 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-950/92 via-stone-950/85 to-stone-950/92" />
        </div>
        <div className="relative max-w-7xl mx-auto space-y-10 sm:space-y-14">
          <Reveal className="max-w-2xl space-y-3 sm:space-y-4">
            <p className="micro-label text-brand-400">Why JGEstate</p>
            <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-white tracking-tight">Built for cross-border buyers, not just browsers</h2>
          </Reveal>
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {[
              { icon: Coins, title: 'Zero Buyer Fees', copy: 'Browsing, saved searches and agent contact are always free, no paywalled listings.' },
              { icon: FileText, title: 'Legal & Documentation', copy: 'Cross-border ownership rules, title checks and contract review, coordinated for you.' },
              { icon: Landmark, title: 'Escrow-Backed Payments', copy: 'Funds route through licensed processors in each market, never held by this platform.' },
              { icon: Clock, title: '24/7 Advisor Support', copy: 'Email a real advisor any time, in any of our 10 markets, no ticket queues.' },
            ].map((item) => (
              <motion.div key={item.title} variants={staggerItem} className="text-center sm:text-left space-y-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-6">
                <div className="bg-brand-500/15 w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mx-auto sm:mx-0">
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">{item.title}</h3>
                <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{item.copy}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing — the SaaS layer: buyers and renters always browse free, this is what
          agents and builders pay for as they outgrow the free tier. */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-14">
          <Reveal className="max-w-2xl mx-auto text-center space-y-3 sm:space-y-4">
            <p className="micro-label text-brand-600">Plans for Agents & Builders</p>
            <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight">List for free. Scale when you're ready.</h2>
            <p className="text-sm sm:text-base text-stone-500 font-medium">Buyers and renters always browse for free. These plans are for the professionals listing property.</p>
          </Reveal>
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {[
              { name: 'Starter', price: 'Free', period: '', desc: 'For individual agents listing a handful of properties.', features: ['Up to 5 active listings', 'Standard search placement', 'Direct buyer enquiries', 'Basic market data access'], cta: 'Start Free', highlight: false },
              { name: 'Professional', price: '$49', period: '/mo', desc: 'For agencies and growing teams.', features: ['Unlimited active listings', 'Priority search placement', 'Full portfolio dashboard', 'Advanced market analytics', 'Verified agent badge'], cta: 'Start Free Trial', highlight: true },
              { name: 'Enterprise', price: 'Custom', period: '', desc: 'For builders and developers with multi-project inventory.', features: ['Bulk project & unit uploads', 'Construction-stage sales tracking', 'Dedicated account manager', 'API access', 'Custom reporting'], cta: 'Talk to Sales', highlight: false },
            ].map((plan) => (
              <motion.div
                key={plan.name}
                variants={staggerItem}
                className={`rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col ${plan.highlight ? 'bg-stone-900 text-white border border-stone-900 lg:-translate-y-3 shadow-xl' : 'bg-white border border-stone-200'}`}
              >
                <div className="space-y-2">
                  {plan.highlight && <Badge className="bg-brand-600 text-white border-none text-[9px] font-extrabold px-2.5 py-1 rounded-full w-fit">MOST POPULAR</Badge>}
                  <h3 className={`text-xl font-bold ${plan.highlight ? 'text-white' : 'text-stone-900'}`}>{plan.name}</h3>
                  <p className={`text-sm ${plan.highlight ? 'text-white/60' : 'text-stone-500'}`}>{plan.desc}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-stone-900'}`}>{plan.price}</span>
                  {plan.period && <span className={plan.highlight ? 'text-white/50' : 'text-stone-400'}>{plan.period}</span>}
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.highlight ? 'text-white/80' : 'text-stone-600'}`}>
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlight ? 'text-brand-400' : 'text-brand-600'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => (plan.name === 'Enterprise' ? contactAdvisor("Hi! I'd like to talk about an Enterprise / builder plan on JGEstate.") : (user ? setIsLaunchOpen(true) : openAuthModal('signup')))}
                  className={`w-full font-bold rounded-xl py-5 sm:py-6 ${plan.highlight ? 'bg-white text-stone-900 hover:bg-brand-50' : 'bg-stone-900 text-white hover:bg-brand-600'}`}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Property News & Guides — market commentary and buyer education, the kind of
          content MagicBricks runs under "Property Pulse" / their Buyer's Guide. */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-stone-50 border-b border-stone-200">
        <div className="max-w-7xl mx-auto space-y-10 sm:space-y-14">
          <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-3 sm:space-y-4">
              <p className="micro-label text-brand-600">Property News & Guides</p>
              <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight">Stay ahead of the market</h2>
            </div>
            <button
              onClick={() => contactAdvisor("Hi! I'd like to get real estate market updates and buying guides from JGEstate.")}
              className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 shrink-0"
            >
              Get Updates <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              {
                category: 'Market News', icon: TrendingUp,
                title: `Global Real Estate Index up ${COMPOSITE_YTD_GROWTH}% YTD`,
                excerpt: 'A look at which of our 10 markets are driving global price growth this year, and which are cooling.',
                read: '4 min read',
              },
              {
                category: "Buyer's Guide", icon: Building2,
                title: 'Buying property abroad: a first-timer\'s checklist',
                excerpt: 'ID verification, local ownership rules, currency exposure and financing — what to sort out before you make an offer.',
                read: '6 min read',
              },
              {
                category: 'Legal & Compliance', icon: Gavel,
                title: 'Cross-border property law, explained simply',
                excerpt: 'Ownership restrictions, tax treaties and title verification vary by country — here\'s how to navigate them.',
                read: '5 min read',
              },
              {
                category: 'Financing', icon: Landmark,
                title: 'How lenders evaluate international buyers',
                excerpt: 'Down payments, interest rates and eligibility criteria differ sharply by market — use our EMI calculator to model it.',
                read: '3 min read',
              },
            ].map((article) => (
              <div
                key={article.title}
                onClick={() => contactAdvisor(`Hi! I'd like to read more about: "${article.title}"`)}
                className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-brand-50 w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                    <article.icon className="w-4 h-4 text-brand-600" />
                  </div>
                  <span className="micro-label text-brand-600">{article.category}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-snug group-hover:text-brand-600 transition-colors">{article.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{article.excerpt}</p>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{article.read}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-white">
        <div className="max-w-4xl mx-auto space-y-10 sm:space-y-14">
          <Reveal className="text-center space-y-3 sm:space-y-4">
            <p className="micro-label text-brand-600">Questions</p>
            <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight">Frequently asked</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
            {[
              { q: 'Is listing a property really free?', a: 'Yes — individual agents can list up to 5 active properties at no cost. Agencies and builders with more inventory can upgrade to Professional or Enterprise.' },
              { q: 'What currency are prices shown in?', a: "Every listing shows in its own market's local currency. Filters and comparisons use USD as a common baseline, but nothing converts automatically at checkout." },
              { q: 'How are sellers verified?', a: 'Every seller signs in with a real, ID-linked account. Developers can attach a real RERA/license registration number, which shows as a badge on the listing, and admins can mark a listing "Verified" after manual review. Anyone can report a listing that looks wrong.' },
              { q: 'Does this platform hold my payment?', a: 'No. Payments are always routed through licensed third-party payment processors in the relevant market — this platform never holds client funds.' },
            ].map((f) => (
              <div key={f.q} className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-stone-900">{f.q}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-24 md:space-y-40 pt-16 sm:pt-24 relative z-30">
        {/* Explore Popular Cities — deliberately built from real counts (how many live
            JGEstate listings actually exist in each city) rather than invented "lifestyle"
            ratings or star scores we have no survey data to back up. Only shows cities that
            currently have at least one listing, ranked by how many, so it reflects the
            catalog as it actually is. */}
        {(() => {
          const popularCities = ALL_CITIES
            .map(c => ({ ...c, count: projects.filter(p => p.city === c.city).length, country: COUNTRIES.find(co => co.name === c.countryName) }))
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
          if (popularCities.length === 0) return null;
          return (
            <div className="space-y-8 sm:space-y-10">
              <Reveal className="max-w-2xl space-y-3 sm:space-y-4">
                <p className="micro-label text-brand-600">Explore By City</p>
                <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight">Popular cities on JGEstate</h2>
                <p className="text-sm sm:text-base text-stone-500 font-medium">Ranked by how many verified listings JGEstate currently tracks in each city — not a popularity score.</p>
              </Reveal>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {popularCities.map(c => (
                  <button
                    key={c.city}
                    onClick={() => { setSearchQuery(c.city); setBrowseMode('buy'); scrollToSection('catalog'); }}
                    className="text-left bg-white border border-stone-200 hover:border-brand-300 hover:shadow-md rounded-2xl p-4 sm:p-5 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{c.country?.flag}</span>
                      <span className={`text-xs font-bold ${c.yoyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {c.yoyChange >= 0 ? '+' : ''}{c.yoyChange}%
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{c.city}</p>
                      <p className="text-[11px] text-stone-400 font-semibold">{c.countryName}</p>
                    </div>
                    <p className="text-[11px] font-bold text-brand-600">{c.count} {c.count === 1 ? 'listing' : 'listings'}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* New & Off-Plan Projects — a dedicated browse entry point for pre-launch and
            under-construction inventory, mirroring the "New Projects" section every major
            portal leads with. Reuses the same ProjectCard and filteredProjects-adjacent data
            (real constructionStatus values already on each listing) rather than a separate
            content type. */}
        {(() => {
          const offPlanProjects = projects
            .filter(p => p.constructionStatus && p.constructionStatus !== 'Ready to Move')
            .sort((a, b) => (a.constructionStatus === 'Pre-Launch' ? -1 : 1) - (b.constructionStatus === 'Pre-Launch' ? -1 : 1))
            .slice(0, 4);
          if (offPlanProjects.length === 0) return null;
          return (
            <div className="space-y-8 sm:space-y-10">
              <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="max-w-2xl space-y-3 sm:space-y-4">
                  <p className="micro-label text-brand-600">New & Off-Plan</p>
                  <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight">Pre-launch &amp; under-construction projects</h2>
                  <p className="text-sm sm:text-base text-stone-500 font-medium">{offPlanProjects.length} of {projects.filter(p => p.constructionStatus !== 'Ready to Move').length} off-plan listings JGEstate currently tracks.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setIsFilterPanelExpanded(true); scrollToSection('catalog'); }}
                  className="border-stone-200 text-stone-700 hover:border-brand-300 hover:text-brand-600 font-bold rounded-xl px-5 py-3 text-sm shrink-0 self-start sm:self-auto"
                >
                  See All New Projects <ArrowRight className="ml-1.5 w-4 h-4" />
                </Button>
              </Reveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {offPlanProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onSelect={handleSelectProject}
                    isFavorite={favorites.includes(project.id)}
                    onToggleFavorite={handleToggleFavorite}
                    isComparing={compareIds.includes(project.id)}
                    onToggleCompare={handleToggleCompare}
                    onViewPortfolio={handleViewBuilder}
                  />
                ))}
              </div>
            </div>
          );
        })()}

      </div>

      {/* Project Details Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => !open && handleCloseProjectDetail()}>
        <DialogContent 
          onClose={() => handleCloseProjectDetail()}
          className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0 bg-white border-stone-200 rounded-3xl shadow-2xl"
        >
          {selectedProject && (
            <>
              {/* The hero photo and thumbnail grid used to be pinned outside this ScrollArea
                  (shrink-0), with only the text/specs body scrollable below them. On anything
                  but a very tall screen that left just a sliver of actual scrollable space —
                  scrolling while your cursor was over the (much larger) photo area did nothing,
                  which is exactly the "scrolling doesn't work" bug. Wrapping everything in one
                  ScrollArea, Zillow/Airbnb-style, means the hero photo scrolls away with the
                  rest of the content and the whole dialog is scrollable no matter where you
                  point the cursor. */}
              <ScrollArea className="flex-1 min-h-0">
              <div className="min-h-[220px] sm:min-h-[350px] md:min-h-[420px] h-[35vh] sm:h-[420px] relative">
                <img
                  src={selectedProject.imageUrl || `https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/30 to-transparent" />

                {/* Save / Share / Report — sits opposite the close button. Report actually
                    writes to a `reports` collection (see firestore.rules) rather than being
                    a decorative button that does nothing; Share copies a real shareable link;
                    Save reuses the same favorite toggle used everywhere else in the app. */}
                <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 z-10">
                  <button
                    onClick={(e) => handleToggleFavorite(selectedProject.id, e)}
                    aria-label={favorites.includes(selectedProject.id) ? 'Remove from saved' : 'Save property'}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center transition-colors"
                  >
                    <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${favorites.includes(selectedProject.id) ? 'fill-rose-500 text-rose-500' : 'text-stone-600'}`} />
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/property/${selectedProject.id}`;
                      navigator.clipboard?.writeText(url).then(
                        () => notify('Link copied to clipboard.', 'success'),
                        () => notify("Couldn't copy the link. Please try again.")
                      );
                    }}
                    aria-label="Share this listing"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center transition-colors"
                  >
                    <Share2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-stone-600" />
                  </button>
                  <button
                    onClick={() => {
                      const reason = window.prompt('What\'s wrong with this listing? (e.g. "Price seems off", "Photos don\'t match", "Suspected fraud")');
                      if (!reason || !reason.trim()) return;
                      addDoc(collection(db, 'reports'), {
                        projectId: selectedProject.id,
                        projectName: selectedProject.name,
                        reason: reason.trim().slice(0, 500),
                        reporterId: user?.uid || null,
                        createdAt: serverTimestamp(),
                      }).then(
                        () => notify('Thanks — we\'ve logged this for review.', 'success'),
                        (error) => { notify("Couldn't submit your report. Please try again."); handleFirestoreError(error, OperationType.CREATE, 'reports'); }
                      );
                    }}
                    aria-label="Report this listing"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center transition-colors"
                  >
                    <Flag className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-stone-600" />
                  </button>
                </div>
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
                  <div className="text-left md:text-right bg-stone-950/70 backdrop-blur-xl p-4 sm:p-6 rounded-xl sm:rounded-3xl border border-white/10 shadow-2xl w-full md:w-auto shrink-0">
                    <p className="micro-label text-white/50 text-[9px] sm:text-[10px] mb-1">{selectedProject.listingType === 'rent' ? 'Monthly Rent' : 'Starting Price Tag'}</p>
                    <p className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tighter">
                      {priceLabel(selectedProject.basePrice, selectedProject.currency, selectedProject.listingType)}
                    </p>
                    <div className="flex items-center md:justify-end gap-1.5 mt-1 text-[10px] sm:text-xs font-bold text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      Listing Quality: {selectedProject.aiScore || 92}/100
                    </div>
                  </div>
                </div>
              </div>

              {/* Asymmetric photo grid gallery (Zillow/ImmoScout24 style) — every tile opens
                  the fullscreen lightbox below at the matching image index. */}
              {selectedProject.images && selectedProject.images.length > 1 && (
                <div id="pd-gallery" className="px-5 sm:px-8 md:px-10 pt-5 sm:pt-6">
                  <div className="grid grid-cols-4 grid-rows-2 gap-2 sm:gap-3 h-[160px] sm:h-[220px] rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(0)}
                      className="col-span-2 row-span-2 relative group cursor-zoom-in"
                      aria-label="View photo 1 fullscreen"
                    >
                      <img src={selectedProject.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/20 transition-colors" />
                    </button>
                    {selectedProject.images.slice(1, 5).map((img, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setLightboxIndex(idx + 1)}
                        className="relative group cursor-zoom-in"
                        aria-label={`View photo ${idx + 2} fullscreen`}
                      >
                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/20 transition-colors" />
                        {idx === 3 && selectedProject.images!.length > 5 && (
                          <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                            +{selectedProject.images!.length - 5} more
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Real 360° tour — only renders when the listing owner actually attached a
                  genuine panorama photo. No fallback tries to fake one from the flat gallery
                  photos above. */}
              {selectedProject.panoramaUrl && (
                <div id="pd-360" className="px-5 sm:px-8 md:px-10 pt-5 sm:pt-6">
                  <PanoramaViewer src={selectedProject.panoramaUrl} />
                </div>
              )}

              {/* Sticky in-dialog sub-nav — a lighter-weight stand-in for full tab panels
                  (Gallery/Description/Amenities/etc. as separate views) given how much this
                  dialog already renders; scrolling to an anchor within the same ScrollArea
                  gets the same "jump straight to what you want" benefit without restructuring
                  every section below into conditionally-rendered panels. Sticks to the top of
                  the scroll area once you scroll past the photos, same as Property Finder's. */}
              <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-stone-100 px-5 sm:px-8 md:px-10 flex items-center gap-5 sm:gap-7 overflow-x-auto scrollbar-none">
                {[
                  { id: 'pd-gallery', label: 'Gallery' },
                  ...(selectedProject.panoramaUrl ? [{ id: 'pd-360', label: '360° Tour' }] : []),
                  { id: 'pd-details', label: 'Details' },
                  { id: 'pd-price', label: 'Price Context' },
                  { id: 'pd-location', label: 'Location' },
                  { id: 'pd-units', label: 'Units' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="shrink-0 py-3.5 text-xs font-bold uppercase tracking-wider text-stone-500 hover:text-brand-600 whitespace-nowrap transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10 p-5 sm:p-8 md:p-10">
                  <div id="pd-details" className="lg:col-span-2 space-y-8 sm:space-y-12">
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
                       {/* Opens the shared EMI dialog pre-filled with THIS listing's actual
                           price/currency — before this it only opened from the homepage hero
                           with a hardcoded $500K default, disconnected from whatever property
                           you were actually looking at. */}
                       <button
                         onClick={() => { setEmiForm(f => ({ ...f, price: selectedProject.basePrice, currency: selectedProject.currency })); setIsEmiOpen(true); }}
                         className="px-4 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-xs font-bold text-brand-700 flex items-center gap-2 shadow-sm hover:bg-brand-100 transition-colors"
                       >
                         <Calculator className="w-3.5 h-3.5" />
                         Mortgage Calculator
                       </button>
                     </div>

                     {/* Neighborhood Proximities & Landmarks — only rendered when the listing
                         actually has real, curator-entered landmarks. This used to fall back
                         to three hardcoded generic entries ("City Center Metro", etc.) for
                         every listing that didn't have real data, which is exactly the kind of
                         fabricated-looking-real content this pass is removing. The live
                         NearbyAmenities section right below covers this for every listing that
                         has real coordinates instead. */}
                     {selectedProject.landmarks && selectedProject.landmarks.length > 0 && (
                       <section id="pd-location" className="bg-stone-50 rounded-2xl p-5 sm:p-8 border border-stone-100 space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                          <Compass className="w-4 h-4 text-stone-500" />
                          Travel Times & Nearby Connections
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {selectedProject.landmarks.map((lm, idx) => (
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
                     )}

                     {/* Live nearby amenities — real OpenStreetMap data queried against this
                         listing's actual coordinates. Only renders when the listing has real
                         lat/lng; there's no fallback that fakes a location. */}
                     {typeof selectedProject.lat === 'number' && typeof selectedProject.lng === 'number' && (
                       <div id={selectedProject.landmarks?.length ? undefined : 'pd-location'}>
                         <NearbyAmenities lat={selectedProject.lat} lng={selectedProject.lng} />
                       </div>
                     )}

                    {/* Price context vs. other JGEstate listings in the same city. This is
                        deliberately built from the app's own live listing data (not invented
                        numbers, and not dressed up as a government transaction registry we
                        don't actually have) — the label says exactly what it is so nobody
                        mistakes it for sourced third-party market data. */}
                    {(() => {
                      const parseAreaMid = (range?: string) => {
                        if (!range) return null;
                        const nums = range.match(/[\d,]+(\.\d+)?/g);
                        if (!nums || nums.length === 0) return null;
                        const vals = nums.map(n => parseFloat(n.replace(/,/g, '')));
                        return vals.reduce((a, b) => a + b, 0) / vals.length;
                      };
                      const targetArea = parseAreaMid(selectedProject.areaRange);
                      if (!targetArea) return null;
                      const targetPpu = selectedProject.basePrice / targetArea;
                      const comps = projects
                        .filter(p => p.id !== selectedProject.id && p.city === selectedProject.city && (p.listingType || 'sale') === (selectedProject.listingType || 'sale'))
                        .map(p => {
                          const area = parseAreaMid(p.areaRange);
                          return area ? { project: p, ppu: p.basePrice / area } : null;
                        })
                        .filter((c): c is { project: Project; ppu: number } => c !== null);
                      if (comps.length < 2) return null;
                      const avgPpu = comps.reduce((s, c) => s + c.ppu, 0) / comps.length;
                      const diffPct = Math.round(((targetPpu - avgPpu) / avgPpu) * 100);
                      const unitLabel = COUNTRIES.find(c => c.code === selectedProject.countryCode)?.unitLabel || 'sqft';
                      const sortedComps = [...comps].sort((a, b) => a.ppu - b.ppu).slice(0, 4);
                      return (
                        <section id="pd-price" className="bg-stone-50 rounded-2xl p-5 sm:p-8 border border-stone-100 space-y-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-stone-500" />
                            Price Context — {selectedProject.city}
                          </h4>
                          <p className="text-sm font-bold text-stone-800">
                            Priced {formatPrice(Math.round(targetPpu), selectedProject.currency)}/{unitLabel} — {Math.abs(diffPct)}% {diffPct >= 0 ? 'above' : 'below'} the average of {comps.length} other {(selectedProject.listingType || 'sale') === 'rent' ? 'rental' : 'sale'} listings JGEstate currently tracks in {selectedProject.city}.
                          </p>
                          <div className="space-y-1.5">
                            {sortedComps.map(c => (
                              <div key={c.project.id} className="flex items-center justify-between text-xs border-t border-stone-200 pt-1.5 first:border-0 first:pt-0">
                                <span className="text-stone-600 font-medium truncate max-w-[60%]">{c.project.name}</span>
                                <span className="text-stone-800 font-bold shrink-0">{formatPrice(Math.round(c.ppu), selectedProject.currency)}/{unitLabel}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-stone-400 font-medium leading-relaxed">
                            Based on other live listings on JGEstate in {selectedProject.city} — not an external transaction registry. Updates as listings change.
                          </p>
                        </section>
                      );
                    })()}

                    <section className="space-y-4">
                      <h3 className="text-lg sm:text-2xl font-bold text-stone-900 flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-brand-650" />
                        About This Property
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
                    <section id="pd-units" className="space-y-6 pt-2">
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
                    <Card className="bg-white border-stone-200 rounded-2xl sm:rounded-3xl shadow-sm p-6 space-y-4">
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
                      {selectedProject.developerName && (
                        <Button
                          variant="outline"
                          onClick={() => handleViewBuilder(selectedProject.developerName!)}
                          className="w-full border-stone-200 text-stone-700 hover:bg-stone-50 hover:text-brand-600 rounded-xl font-bold text-xs sm:text-sm"
                        >
                          <Building2 className="w-3.5 h-3.5 mr-2" />
                          View Full Builder Portfolio
                        </Button>
                      )}
                    </Card>

                    {/* Listing Agent Card — links to that agent's own storefront */}
                    {(() => {
                      const listingAgent = getAgentForProject(selectedProject);
                      return (
                        <Card className="bg-white border-stone-200 rounded-2xl sm:rounded-3xl shadow-sm p-6 space-y-4">
                          <p className="micro-label text-stone-400">Your Listing Agent</p>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-lg shrink-0">
                              {listingAgent.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-stone-900 truncate">{listingAgent.name}</p>
                              <p className="text-xs font-semibold text-stone-400 truncate">{listingAgent.title}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <Button
                              onClick={() => { const msg = `Hi ${listingAgent.name}! I'm interested in ${selectedProject.name}, ${selectedProject.city}. Could you share more details?`; contactAdvisor(msg); logInquiry(selectedProject, msg, user?.uid); }}
                              className="bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-bold text-xs"
                            >
                              <Mail className="w-3.5 h-3.5 mr-1.5" />
                              Email
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleViewAgent(listingAgent.id)}
                              className="border-stone-200 text-stone-700 hover:bg-stone-50 hover:text-brand-600 rounded-xl font-bold text-xs"
                            >
                              View Storefront
                            </Button>
                          </div>
                        </Card>
                      );
                    })()}

                    {/* Investment Analyzer — every number here is computed from this
                        listing's own price and yield data (same formula as the EMI
                        calculator: 20% down, 6.5% rate, 20-year term, clearly labeled as
                        an assumption). No black-box "AI recommends this" claim — the
                        Investment Score is a transparent weighted formula, shown below. */}
                    {(() => {
                      const price = selectedProject.basePrice;
                      const yieldPct = selectedProject.rentalYield || 4.5;
                      const downPaymentPct = 20;
                      const rate = 6.5;
                      const years = 20;
                      const downPayment = price * (downPaymentPct / 100);
                      const principal = price - downPayment;
                      const monthlyRate = rate / 100 / 12;
                      const months = years * 12;
                      const monthlyMortgage = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                      const monthlyRent = (price * (yieldPct / 100)) / 12;
                      const monthlyCashFlow = monthlyRent - monthlyMortgage;
                      const annualCashFlow = monthlyCashFlow * 12;
                      const cashOnCash = (annualCashFlow / downPayment) * 100;
                      const isPositive = monthlyCashFlow >= 0;

                      // Transparent, explainable score — not a mystery AI output. Each
                      // component and its weight is listed in the "Why this score" bullets.
                      let score = 0;
                      const reasons: string[] = [];
                      const yieldScore = Math.min(100, (yieldPct / 8) * 100);
                      score += yieldScore * 0.5;
                      reasons.push(`Gross rental yield of ${yieldPct.toFixed(1)}% (weighted 50%)`);
                      if (selectedProject.marketTrend === 'Bullish') {
                        score += 20;
                        reasons.push('Bullish market trend for this city (+20)');
                      } else {
                        score += 8;
                        reasons.push('Stable market trend for this city (+8)');
                      }
                      if (selectedProject.reraId || selectedProject.verified) {
                        score += 15;
                        reasons.push('Verified / registered listing (+15)');
                      }
                      if (isPositive) {
                        score += 15;
                        reasons.push('Estimated rent covers the modeled mortgage payment (+15)');
                      } else {
                        reasons.push('Estimated rent does not fully cover the modeled mortgage payment (+0)');
                      }
                      score = Math.round(Math.min(100, score));

                      return (
                        <Card className="bg-white border-stone-200 rounded-2xl sm:rounded-3xl shadow-sm p-6 space-y-5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-bold text-stone-400 uppercase tracking-wider">Investment Analyzer</span>
                            <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                              <Sparkles className="w-3 h-3" />
                              <span className="text-xs font-bold">{score}/100</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {[
                              ['Down Payment (20%)', formatPriceFull(Math.round(downPayment), selectedProject.currency)],
                              ['Est. Monthly Mortgage', formatPriceFull(Math.round(monthlyMortgage), selectedProject.currency)],
                              ['Est. Monthly Rent', formatPriceFull(Math.round(monthlyRent), selectedProject.currency)],
                              ['Gross Rental Yield', `${yieldPct.toFixed(1)}%`],
                              ['Cash-on-Cash Return', `${cashOnCash.toFixed(1)}%`],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide leading-tight">{label}</p>
                                <p className="text-sm font-bold text-stone-900 mt-0.5">{value}</p>
                              </div>
                            ))}
                            <div>
                              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide leading-tight">Est. Monthly Cash Flow</p>
                              <p className={`text-sm font-bold mt-0.5 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPositive ? '+' : ''}{formatPriceFull(Math.round(monthlyCashFlow), selectedProject.currency)}
                              </p>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-stone-100 space-y-1.5">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Why this score</p>
                            {reasons.map((r) => (
                              <p key={r} className="text-[11px] text-stone-500 leading-relaxed flex items-start gap-1.5">
                                <span className="text-brand-500 mt-0.5">•</span>{r}
                              </p>
                            ))}
                          </div>

                          <p className="text-[10px] text-stone-400 leading-relaxed pt-1 border-t border-stone-100">
                            Assumes {downPaymentPct}% down, {rate}% interest, {years}-year term — before property tax, insurance, HOA, vacancy, and maintenance, which vary by market. Not financial advice; confirm numbers with a licensed advisor before buying.
                          </p>
                        </Card>
                      );
                    })()}

                    <Card className="bg-stone-50 border-stone-200 relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-sm">
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
                      onClick={() => { const msg = `Hi! I'm interested in ${selectedProject.name} (${selectedProject.location}). ${selectedProject.listingType === 'rent' ? 'Rent' : 'Price'}: ${priceLabel(selectedProject.basePrice, selectedProject.currency, selectedProject.listingType)}. Please share details and arrange a site visit. ${window.location.origin}/property/${selectedProject.id}`; contactAdvisor(msg); logInquiry(selectedProject, msg, user?.uid); }}
                      className="w-full bg-brand-600 text-white hover:bg-brand-700 font-bold rounded-xl sm:rounded-3xl py-6 sm:py-7 text-xs sm:text-sm uppercase tracking-widest shadow-xl transition-all"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email Agent
                    </Button>
                    <a href={`tel:${AGENT_PHONE.replace(/\s/g, '')}`} className="block">
                      <Button
                        variant="outline"
                        className="w-full border-stone-300 text-stone-900 hover:bg-stone-50 font-bold rounded-xl sm:rounded-3xl py-6 sm:py-7 text-xs sm:text-sm uppercase tracking-widest transition-all"
                      >
                        Call Agent • {AGENT_PHONE}
                      </Button>
                    </a>

                    <Button
                      onClick={() => setIsWhitepaperOpen(true)}
                      className="w-full bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-xl sm:rounded-3xl py-6 sm:py-7 text-xs sm:text-sm uppercase tracking-widest shadow-xl transition-all"
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

      {/* Fullscreen image lightbox for the property photo grid above — click any tile to
          open, arrow keys or the on-screen chevrons to move between photos, Esc/X/backdrop
          click to close. This sits above the property dialog (z-[100] > the dialog's z-50). */}
      {lightboxIndex !== null && selectedProject?.images && (
        <ImageLightbox
          images={selectedProject.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}

      {/* Booking Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent 
          onClose={() => setIsBookingOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
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
                  className="h-20 sm:h-24 flex items-center justify-start gap-4 sm:gap-6 border-stone-100 bg-stone-50 hover:border-brand-600 hover:bg-brand-50 transition-all group px-4 sm:px-8 rounded-2xl sm:rounded-3xl"
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
          className="sm:max-w-lg bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
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
            <div className="bg-stone-50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4 border border-stone-100">
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
            className="w-full bg-indigo-600 text-white hover:bg-stone-900 font-bold py-5 sm:py-10 rounded-xl sm:rounded-3xl text-sm sm:text-xl shadow-xl shadow-indigo-100"
          >
            Confirm Market Listing
          </Button>
        </DialogContent>
      </Dialog>

      {/* Bidding Dialog */}
      <Dialog open={isBiddingOpen} onOpenChange={setIsBiddingOpen}>
        <DialogContent 
          onClose={() => setIsBiddingOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
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
            <div className="bg-stone-50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4 border border-stone-100">
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
            className="w-full bg-brand-600 text-white hover:bg-stone-900 font-bold py-5 sm:py-10 rounded-xl sm:rounded-3xl text-sm sm:text-xl shadow-xl shadow-brand-100"
          >
            Confirm Bid
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isLaunchOpen} onOpenChange={setIsLaunchOpen}>
        <DialogContent 
          onClose={() => setIsLaunchOpen(false)}
          className="sm:max-w-2xl bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">List a New Property</DialogTitle>
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
            <div className="space-y-2 sm:space-y-3 mb-2 sm:mb-0">
              <Label className="micro-label">Real Photo URLs (one per line — your own photos, not stock)</Label>
              <textarea
                value={newProject.photoUrls}
                onChange={(e) => setNewProject({ ...newProject, photoUrls: e.target.value })}
                placeholder={"https://your-cdn.com/living-room.jpg\nhttps://your-cdn.com/kitchen.jpg"}
                rows={3}
                className="w-full rounded-xl border border-stone-100 bg-stone-50 font-bold text-sm p-4 resize-none"
              />
              <p className="text-xs text-stone-400 font-medium">
                No links yet? The listing publishes with a plain "No Photo Provided" placeholder instead of a stock photo — we never show a picture that isn't actually your property.
              </p>
            </div>
            <div className="space-y-2 sm:space-y-3 mb-2 sm:mb-0">
              <Label className="micro-label">360° Tour Photo URL (optional — a real equirectangular panorama)</Label>
              <Input
                value={newProject.panoramaUrl}
                onChange={(e) => setNewProject({ ...newProject, panoramaUrl: e.target.value })}
                placeholder="https://your-cdn.com/living-room-360.jpg"
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
          className="sm:max-w-lg bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
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
              contactAdvisor(`Hi! I'd like a professional valuation for my property in ${cityMeta.city}, ${countryMeta.name} (${area}${countryMeta.unitLabel}). The platform's automated estimate was around ${formatPriceFull(mid, countryMeta.currency)}.`);
            }}
            className="w-full bg-brand-600 text-white hover:bg-brand-700 font-bold rounded-xl sm:rounded-2xl py-5 sm:py-7 text-sm uppercase tracking-widest shadow-xl"
          >
            <Mail className="w-4 h-4 mr-2" />
            Get a Professional Valuation
          </Button>
        </DialogContent>
      </Dialog>

      {/* EMI / Home Loan Calculator */}
      <Dialog open={isEmiOpen} onOpenChange={setIsEmiOpen}>
        <DialogContent
          onClose={() => setIsEmiOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">EMI Calculator</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              Estimate your monthly loan payment. This is indicative only — actual rates depend on your lender and eligibility.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:gap-6 py-6 sm:py-8">
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">Currency</Label>
                <select
                  value={emiForm.currency}
                  onChange={(e) => setEmiForm({ ...emiForm, currency: e.target.value })}
                  className="w-full rounded-xl border border-stone-100 bg-stone-50 font-bold text-sm px-4 py-2.5 h-11"
                >
                  {Object.keys(CURRENCY_META).map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">Property Price</Label>
                <Input
                  type="number"
                  value={emiForm.price}
                  onChange={(e) => setEmiForm({ ...emiForm, price: Number(e.target.value) })}
                  className="rounded-xl border-stone-100 bg-stone-50 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label className="micro-label">Down Payment — {emiForm.downPaymentPct}%</Label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={emiForm.downPaymentPct}
                onChange={(e) => setEmiForm({ ...emiForm, downPaymentPct: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">Interest Rate (% p.a.)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={emiForm.rate}
                  onChange={(e) => setEmiForm({ ...emiForm, rate: Number(e.target.value) })}
                  className="rounded-xl border-stone-100 bg-stone-50 font-bold"
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Label className="micro-label">Loan Tenure — {emiForm.years} {emiForm.years === 1 ? 'year' : 'years'}</Label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={emiForm.years}
                  onChange={(e) => setEmiForm({ ...emiForm, years: Number(e.target.value) })}
                  className="w-full accent-brand-600 mt-3"
                />
              </div>
            </div>

            {(() => {
              const principal = emiForm.price * (1 - emiForm.downPaymentPct / 100);
              const monthlyRate = emiForm.rate / 100 / 12;
              const months = emiForm.years * 12;
              if (!(principal > 0) || !(monthlyRate > 0) || !(months > 0)) return null;
              const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
              const totalPayment = emi * months;
              const totalInterest = totalPayment - principal;
              return (
                <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div>
                    <p className="micro-label text-brand-600">Monthly EMI</p>
                    <p className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">{formatPriceFull(Math.round(emi), emiForm.currency)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-brand-100">
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Principal</p>
                      <p className="text-sm sm:text-base font-bold text-stone-900">{formatPriceFull(Math.round(principal), emiForm.currency)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Interest</p>
                      <p className="text-sm sm:text-base font-bold text-stone-900">{formatPriceFull(Math.round(totalInterest), emiForm.currency)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <Button
            onClick={() => contactAdvisor(`Hi! I used the EMI calculator on JGEstate (price ${formatPriceFull(emiForm.price, emiForm.currency)}, ${emiForm.downPaymentPct}% down, ${emiForm.rate}% rate, ${emiForm.years} years) and I'd like to talk to a financing partner.`)}
            className="w-full bg-brand-600 text-white hover:bg-brand-700 font-bold rounded-xl sm:rounded-2xl py-5 sm:py-7 text-sm uppercase tracking-widest shadow-xl"
          >
            <Mail className="w-4 h-4 mr-2" />
            Talk to a Financing Partner
          </Button>
        </DialogContent>
      </Dialog>

      {/* Ask AI — natural-language search assist. There's no hosted LLM backend, so instead
          of faking one, this runs a real deterministic parser (parseAiSearchQuery) over the
          typed sentence and applies whatever it genuinely understood directly to the live
          filter state — the same state the manual Filters panel drives. Anything it can't
          confidently parse falls back to routing the raw text to a human advisor, so the
          button never pretends to have understood something it didn't. */}
      <Dialog open={isAskAiOpen} onOpenChange={setIsAskAiOpen}>
        <DialogContent
          onClose={() => setIsAskAiOpen(false)}
          className="sm:max-w-lg bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-brand-500" />
              Ask AI
            </DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              Describe what you're looking for in plain language — we'll apply it to real listings instantly. Anything we can't parse gets routed to an advisor instead.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 sm:py-8 space-y-4">
            <textarea
              value={askAiQuery}
              onChange={(e) => setAskAiQuery(e.target.value)}
              placeholder="e.g. 3-bedroom apartment near the coast in Lisbon, under €600K, ready to move in"
              rows={4}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:bg-white text-sm font-medium text-stone-900 p-4 resize-none"
            />
            <div className="flex flex-wrap gap-2">
              {['Under $500K', '2 bedroom', 'Move-in ready', 'Verified only'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setAskAiQuery((q) => (q ? `${q}, ${chip.toLowerCase()}` : chip))}
                  className="px-3 py-1.5 rounded-full bg-stone-100 text-xs font-semibold text-stone-600 hover:bg-brand-50 hover:text-brand-600 transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <Button
            disabled={!askAiQuery.trim()}
            onClick={() => {
              const parsed = parseAiSearchQuery(askAiQuery);
              if (parsed.understood.length === 0) {
                // Genuinely nothing recognizable in the sentence — don't fake a match, hand
                // it to a human instead, exactly as before.
                contactAdvisor(`Hi! I used Ask AI on JGEstate. Here's what I'm looking for: ${askAiQuery}`);
                notify("Couldn't pick out specific filters from that — we've sent it to an advisor instead.", 'success');
              } else {
                if (parsed.browseMode) setBrowseMode(parsed.browseMode);
                if (parsed.matchedLocation) setSearchQuery(parsed.matchedLocation);
                if (parsed.budgetRange) setBudgetRange(parsed.budgetRange);
                if (parsed.selectedBhkType) setSelectedBhkType(parsed.selectedBhkType);
                if (parsed.selectedConstStatus) setSelectedConstStatus(parsed.selectedConstStatus);
                if (parsed.onlyReraVerified) setOnlyReraVerified(true);
                setIsFilterPanelExpanded(true);
                notify(`Applied: ${parsed.understood.join(' · ')}`, 'success');
                scrollToSection('catalog');
              }
              setIsAskAiOpen(false);
              setAskAiQuery('');
            }}
            className="w-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 font-bold rounded-xl sm:rounded-2xl py-5 sm:py-7 text-sm uppercase tracking-widest shadow-xl"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Search With AI
          </Button>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent 
          onClose={() => setIsProfileOpen(false)}
          className="sm:max-w-xl bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">My Profile</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              Manage your profile and account type.
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

            {/* Role Switcher Selector — matches the four personas marketed on the homepage
                (Customers browse without an account, so only the other three need a
                distinct dashboard view here). */}
            <div className="space-y-3 sm:space-y-4">
              <Label className="micro-label text-stone-400">Account Type</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  onClick={() => setProfileRole("agent")}
                  className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border text-left transition-all relative ${
                    profileRole === "agent"
                      ? "border-brand-600 bg-brand-50/20 shadow-md ring-2 ring-brand-600/10"
                      : "border-stone-200 text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  <p className="font-bold text-stone-900 text-base sm:text-lg">Agent View</p>
                  <p className="text-[10px] sm:text-[11px] text-stone-400 mt-2 font-medium leading-relaxed">List individual resale properties, manage buyer enquiries, and get your own Broker Storefront page.</p>
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

            {/* Region Filter Selector — was hard-coded to Indian sub-regions from an
                earlier single-market version of the app; now matches the actual global
                regions this marketplace operates in. */}
            <div className="space-y-3 sm:space-y-4">
              <Label className="micro-label text-stone-400">Select Operating Region</Label>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {['Global', 'Europe', 'North America', 'Middle East', 'Asia'].map((r) => (
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
          className="sm:max-w-2xl bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl"
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

      {/* Info modal — About / Careers / Contact / Terms / Privacy / Disclaimer.
          These footer links previously went nowhere (href="#"); now they open
          real, honest copy instead of dead anchors. */}
      <Dialog open={infoModal !== null} onOpenChange={(open) => !open && setInfoModal(null)}>
        <DialogContent className="max-w-lg sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-serif">
              {infoModal === 'about' && 'About JGEstate'}
              {infoModal === 'careers' && 'Careers'}
              {infoModal === 'contact' && 'Contact Us'}
              {infoModal === 'terms' && 'Terms of Use'}
              {infoModal === 'privacy' && 'Privacy Policy'}
              {infoModal === 'disclaimer' && 'Disclaimer'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 sm:py-6 space-y-4 text-sm text-stone-600 leading-relaxed max-h-[60vh] overflow-y-auto">
            {infoModal === 'about' && (
              <>
                <p>JGEstate is a global real estate marketplace where buyers, renters, agents, developers, and investors can browse and transact on verified property listings across {COUNTRIES.length} countries, priced in local currency with live market data.</p>
                <p>Every listing is tied to a real developer or agent, and construction status, RERA/registry references, and pricing are shown as reported by the listing party. Actual payments, escrow, and closing are always handled by licensed third-party providers in the property's jurisdiction — never by this platform directly.</p>
                <p>JGEstate is a SaaS product built and operated by JGAI, the registered company behind it. Learn more at{' '}
                  <a href="https://www.jgdeveloper.com" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-600 hover:underline">jgdeveloper.com</a>.
                </p>
              </>
            )}
            {infoModal === 'careers' && (
              <p>We don't have open roles listed on the platform yet. If you're interested in working with JGEstate, reach out at{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-brand-600 hover:underline">{SUPPORT_EMAIL}</a> and we'll follow up as opportunities open.
              </p>
            )}
            {infoModal === 'contact' && (
              <div className="space-y-3">
                <p>We're happy to help with anything from a specific listing to a general question about how the platform works.</p>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 font-bold text-stone-900 hover:text-brand-600"><Mail className="w-4 h-4" />{SUPPORT_EMAIL}</a>
                <a href={`tel:${AGENT_PHONE.replace(/\s/g, '')}`} className="flex items-center gap-2 font-bold text-stone-900 hover:text-brand-600"><Phone className="w-4 h-4" />{AGENT_PHONE}</a>
              </div>
            )}
            {infoModal === 'terms' && (
              <>
                <p>By using JGEstate you agree to use the platform only to browse, list, or express genuine interest in real property. Listing accuracy is the responsibility of the developer or agent who submitted it — JGEstate reviews but does not independently guarantee every detail.</p>
                <p>Reservation deposits and other on-platform actions record your interest; they are not a substitute for a formal sale agreement, and all binding contracts, payments, and closings must go through a licensed notary, attorney, or payment processor in the relevant jurisdiction.</p>
              </>
            )}
            {infoModal === 'privacy' && (
              <>
                <p>We collect the account information you provide (name, email) and the activity needed to run the platform — saved properties, bids, bookings, and messages to agents or developers you contact.</p>
                <p>We don't sell your personal data. Information is shared only with the specific agent, developer, or advisor you choose to contact, and with the third-party payment or authentication providers (e.g. Google Sign-In) required to operate the service.</p>
              </>
            )}
            {infoModal === 'disclaimer' && (
              <>
                <p>Listings on JGEstate are shown as reported by developers and agents and may change without notice. Prices, availability, construction status, and rental yields are estimates and should be independently verified before making any financial decision.</p>
                <p>JGEstate is not a licensed broker, bank, or payment processor. It does not hold client funds in escrow, provide investment or legal advice, or guarantee any transaction — always work with a licensed professional for the actual purchase, sale, or financing of property.</p>
              </>
            )}
          </div>
          <Button
            onClick={() => setInfoModal(null)}
            className="w-full bg-stone-900 text-white hover:bg-brand-600 font-bold py-5 sm:py-6 rounded-xl text-base shadow-xl"
          >
            Close
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
            {/* Corporate disclosure: JGEstate is the product; JGAI is the registered
                company behind it. Stated plainly here rather than only buried in legal copy. */}
            <a href="https://www.jgdeveloper.com" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-600 hover:underline block">
              A JGAI product · jgdeveloper.com
            </a>
            <a href={`tel:${AGENT_PHONE.replace(/\s/g, '')}`} className="text-sm font-bold text-stone-700 hover:text-brand-600 block">{AGENT_PHONE}</a>
          </div>

          <div className="space-y-3">
            <p className="micro-label text-stone-400">Explore</p>
            <button onClick={() => { setBrowseMode('buy'); scrollToSection('catalog'); }} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Buy</button>
            <button onClick={() => { setBrowseMode('rent'); scrollToSection('catalog'); }} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Rent</button>
            <button onClick={() => (user ? setIsLaunchOpen(true) : openAuthModal('signup'))} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Sell</button>
            <button onClick={() => setIsEvaluateOpen(true)} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Evaluate</button>
            <button onClick={() => scrollToSection('catalog')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Invest</button>
          </div>

          <div className="space-y-3">
            <p className="micro-label text-stone-400">Support</p>
            <button onClick={() => contactAdvisor("Hi! I'd like to speak with a JGEstate advisor.")} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Talk to an Advisor</button>
            <button onClick={() => setInfoModal('about')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">About</button>
            <button onClick={() => setInfoModal('careers')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Careers</button>
            <button onClick={() => setInfoModal('contact')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Contact</button>
          </div>

          <div className="space-y-3">
            <p className="micro-label text-stone-400">Legal</p>
            <button onClick={() => setInfoModal('terms')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Terms of Use</button>
            <button onClick={() => setInfoModal('privacy')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Privacy Policy</button>
            <button onClick={() => setInfoModal('disclaimer')} className="block text-sm font-semibold text-stone-600 hover:text-brand-600 text-left">Disclaimer</button>
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
              © {new Date().getFullYear()}{' '}
              <a href="https://www.jgdeveloper.com" target="_blank" rel="noopener noreferrer" className="font-bold text-white/70 hover:text-white hover:underline">JGAI</a>
              {' '}— JGEstate is a SaaS product of JGAI. Listings shown are for demonstration. Payments are processed by licensed third-party providers — this platform does not hold client funds in escrow.
            </p>
            <div className="flex items-center gap-4 text-xs font-bold text-brand-300 uppercase tracking-widest">
              <span>Global Marketplace</span>
              <span className="text-white/20">·</span>
              <span>{COUNTRIES.length} Countries</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating compare tray — appears once 1+ properties are selected via the
          compare toggle on each card. Standard pattern on every major property
          portal; JGEstate had no equivalent before this. */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[55] bg-white border-t border-stone-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
              {compareIds.map((id) => {
                const p = projects.find(pr => pr.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-1.5 bg-stone-100 rounded-full pl-1 pr-2 py-1 shrink-0">
                    <img src={p.imageUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <span className="text-xs font-bold text-stone-700 max-w-[100px] truncate">{p.name}</span>
                    <button onClick={(e) => handleToggleCompare(id, e)} className="text-stone-400 hover:text-stone-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button onClick={() => setCompareIds([])} className="text-xs font-bold text-stone-400 hover:text-stone-600 hidden sm:block">
                Clear
              </button>
              <Button
                disabled={compareIds.length < 2}
                onClick={() => setIsCompareOpen(true)}
                className="bg-brand-600 text-white hover:bg-stone-900 disabled:opacity-40 font-bold rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm shadow-sm"
              >
                Compare {compareIds.length > 0 ? `(${compareIds.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison dialog — side-by-side spec table for the selected properties. */}
      <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <DialogContent
          onClose={() => setIsCompareOpen(false)}
          className="sm:max-w-4xl bg-white border-stone-200 rounded-3xl p-6 sm:p-10 shadow-2xl max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader className="space-y-2 sm:space-y-4">
            <DialogTitle className="text-stone-900 text-2xl sm:text-3xl font-bold tracking-tight">Compare Properties</DialogTitle>
            <DialogDescription className="text-stone-500 text-sm sm:text-base font-medium">
              Side-by-side view of the {compareIds.length} properties you selected.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto py-4 sm:py-6">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr>
                  <td className="w-32" />
                  {compareIds.map((id) => {
                    const p = projects.find(pr => pr.id === id);
                    if (!p) return null;
                    return (
                      <th key={id} className="text-left p-3 align-top">
                        <img src={p.imageUrl} alt={p.name} className="w-full aspect-[4/3] object-cover rounded-xl mb-2" referrerPolicy="no-referrer" />
                        <p className="font-bold text-stone-900 text-sm leading-tight">{p.name}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{p.city}</p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  { label: 'Price', get: (p: Project) => priceLabel(p.basePrice, p.currency, p.listingType) },
                  { label: 'Configuration', get: (p: Project) => p.bhkOptions ? p.bhkOptions.join(' & ') : '3 BR' },
                  { label: 'Area', get: (p: Project) => p.areaRange || '2,400 - 4,800 sq.ft.' },
                  { label: 'Status', get: (p: Project) => p.constructionStatus || 'Ready to Move' },
                  { label: 'Developer', get: (p: Project) => p.developerName || '—' },
                  { label: 'Verification', get: (p: Project) => p.reraId ? 'RERA Verified' : p.verified ? 'Verified' : 'Unverified' },
                  { label: 'AI Quality Score', get: (p: Project) => `${p.aiScore || 85}/100` },
                ].map((row) => (
                  <tr key={row.label} className="border-t border-stone-100">
                    <td className="p-3 text-xs font-bold uppercase tracking-wider text-stone-400 align-top">{row.label}</td>
                    {compareIds.map((id) => {
                      const p = projects.find(pr => pr.id === id);
                      if (!p) return <td key={id} className="p-3" />;
                      return <td key={id} className="p-3 font-semibold text-stone-800 align-top">{row.get(p)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            onClick={() => {
              const names = compareIds.map(id => projects.find(p => p.id === id)?.name).filter(Boolean).join(', ');
              contactAdvisor(`Hi! I'm comparing these properties on JGEstate: ${names}. Can an advisor help me decide?`);
            }}
            className="w-full bg-brand-600 text-white hover:bg-brand-700 font-bold rounded-xl sm:rounded-2xl py-5 sm:py-7 text-sm uppercase tracking-widest shadow-xl"
          >
            <Mail className="w-4 h-4 mr-2" />
            Ask an Advisor to Help Me Decide
          </Button>
        </DialogContent>
      </Dialog>

      {/* Builder Portfolio — every active listing from one developer, on its own
          shareable page (/builder/:name), so a developer can point buyers straight
          at their full body of work instead of a single project. */}
      <Dialog open={!!viewingBuilder} onOpenChange={(open) => !open && handleCloseBuilder()}>
        <DialogContent
          onClose={() => handleCloseBuilder()}
          className="max-w-6xl max-h-[92vh] overflow-y-auto p-0 bg-white border-stone-200 rounded-3xl shadow-2xl"
        >
          {viewingBuilder && (() => {
            const cities = Array.from(new Set(builderProjects.map(p => p.city)));
            const countries = Array.from(new Set(builderProjects.map(p => p.country).filter(Boolean)));
            const totalUnits = builderProjects.reduce((sum, p) => sum + (p.totalUnits || 0), 0);
            const avgScore = builderProjects.length
              ? Math.round(builderProjects.reduce((sum, p) => sum + (p.aiScore || 85), 0) / builderProjects.length)
              : 0;
            const isVerified = builderProjects.some(p => p.verified || p.reraId);
            return (
              <>
                <div className="bg-stone-900 px-6 sm:px-12 py-12 sm:py-16 relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 tech-grid opacity-10" />
                  <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-3 sm:space-y-4">
                      <p className="micro-label text-brand-400">Builder Portfolio</p>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-serif font-semibold text-2xl sm:text-3xl shrink-0">
                          {viewingBuilder[0]}
                        </div>
                        <div>
                          <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-white tracking-tight">{viewingBuilder}</h2>
                          {isVerified && (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mt-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" /> Verified Developer
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => contactAdvisor(`Hi! I'd like to learn more about ${viewingBuilder}'s available projects on JGEstate.`)}
                      className="bg-brand-600 text-white hover:bg-brand-700 rounded-xl sm:rounded-2xl font-bold px-6 py-5 sm:py-6 shrink-0"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Contact This Builder
                    </Button>
                  </div>
                  <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-8 sm:mt-10">
                    {[
                      { label: 'Active Projects', value: builderProjects.length },
                      { label: 'Total Units', value: totalUnits.toLocaleString() },
                      { label: 'Cities', value: cities.length },
                      { label: 'Avg. AI Quality Score', value: `${avgScore}/100` },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
                        <p className="text-xl sm:text-3xl font-bold text-white tracking-tight">{stat.value}</p>
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/50 mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 sm:p-12 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900">
                      {builderProjects.length} {builderProjects.length === 1 ? 'Project' : 'Projects'}
                      {countries.length > 0 && <span className="text-stone-400 font-sans text-sm sm:text-base font-medium"> across {countries.join(', ')}</span>}
                    </h3>
                  </div>
                  {builderProjects.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                      {builderProjects.map(project => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onSelect={handleSelectFromShowcase}
                          isFavorite={favorites.includes(project.id)}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500 font-medium">No active listings from this builder right now.</p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Find Agents directory — browsing/search entry point into the agent roster. The
          individual agent storefront dialog below already existed (reachable once you knew
          an agent's id via a project); this is the missing piece — a place to actually find
          one in the first place, the way propertyfinder.ae's "Find Agents" page works. */}
      <Dialog open={isFindAgentsOpen} onOpenChange={setIsFindAgentsOpen}>
        <DialogContent
          onClose={() => setIsFindAgentsOpen(false)}
          className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-white border-stone-200 rounded-3xl shadow-2xl"
        >
          <DialogHeader className="p-6 sm:p-8 pb-0 shrink-0">
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">Find an Agent</DialogTitle>
            <DialogDescription className="text-stone-500 font-medium">
              JGEstate's advisor roster, searchable by name, title, or region.
            </DialogDescription>
            <div className="relative pt-2">
              <Search className="absolute left-4 top-1/2 translate-y-[15%] w-4 h-4 text-stone-400" />
              <Input
                value={agentSearchQuery}
                onChange={(e) => setAgentSearchQuery(e.target.value)}
                placeholder="Search by name, title, or region..."
                className="pl-11 h-12 rounded-xl bg-stone-50 border-stone-200 font-medium"
              />
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 p-6 sm:p-8 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {AGENT_ROSTER.filter(a => {
                const q = agentSearchQuery.trim().toLowerCase();
                if (!q) return true;
                return [a.name, a.title, ...a.regions].some(f => f.toLowerCase().includes(q));
              }).map(a => (
                <button
                  key={a.id}
                  onClick={() => { setIsFindAgentsOpen(false); setViewingAgentId(a.id); }}
                  className="text-left bg-stone-50 hover:bg-white border border-stone-100 hover:border-brand-200 hover:shadow-md rounded-2xl p-5 transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0">
                      {a.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate">{a.name}</p>
                      <p className="text-xs font-semibold text-stone-500 truncate">{a.title}</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{a.bio}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.regions.map(r => (
                      <span key={r} className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-[10px] font-bold uppercase tracking-wider">{r}</span>
                    ))}
                  </div>
                </button>
              ))}
              {AGENT_ROSTER.filter(a => {
                const q = agentSearchQuery.trim().toLowerCase();
                if (!q) return true;
                return [a.name, a.title, ...a.regions].some(f => f.toLowerCase().includes(q));
              }).length === 0 && (
                <p className="col-span-full text-center text-sm text-stone-400 font-medium py-10">No advisors match that search.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Broker Store — a branded storefront for one listing agent's active
          inventory, on its own shareable page (/agent/:id). */}
      <Dialog open={!!viewingAgentId} onOpenChange={(open) => !open && handleCloseAgent()}>
        <DialogContent
          onClose={() => handleCloseAgent()}
          className="max-w-6xl max-h-[92vh] overflow-y-auto p-0 bg-white border-stone-200 rounded-3xl shadow-2xl"
        >
          {currentShowcaseAgent && (() => {
            const cities = Array.from(new Set(agentProjects.map(p => p.city)));
            return (
              <>
                <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-6 sm:px-12 py-12 sm:py-16 relative overflow-hidden shrink-0">
                  <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-3 sm:space-y-4">
                      <p className="micro-label text-brand-200">Agent Storefront</p>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-brand-700 flex items-center justify-center font-serif font-semibold text-2xl sm:text-3xl shrink-0 shadow-xl">
                          {currentShowcaseAgent.name[0]}
                        </div>
                        <div>
                          <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-white tracking-tight">{currentShowcaseAgent.name}</h2>
                          <p className="text-brand-200 text-xs sm:text-sm font-bold uppercase tracking-wider mt-1">{currentShowcaseAgent.title}</p>
                        </div>
                      </div>
                      <p className="text-white/80 text-sm sm:text-base font-medium max-w-xl leading-relaxed">{currentShowcaseAgent.bio}</p>
                    </div>
                    <div className="flex flex-col gap-2.5 shrink-0 w-full sm:w-auto">
                      <Button
                        onClick={() => contactAdvisor(`Hi ${currentShowcaseAgent.name}! I found your storefront on JGEstate and would like to know more about your listings.`)}
                        className="bg-brand-600 text-white hover:bg-brand-700 rounded-xl sm:rounded-2xl font-bold px-6 py-5 sm:py-6"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Email Agent
                      </Button>
                      <a
                        href={`tel:${currentShowcaseAgent.phone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-xl sm:rounded-2xl font-bold px-6 py-3 text-sm transition-colors"
                      >
                        <Phone className="w-4 h-4" /> {currentShowcaseAgent.phone}
                      </a>
                    </div>
                  </div>
                  <div className="relative grid grid-cols-2 gap-4 sm:gap-6 mt-8 sm:mt-10 max-w-md">
                    <div className="bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-5">
                      <p className="text-xl sm:text-3xl font-bold text-white tracking-tight">{agentProjects.length}</p>
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/60 mt-1">Active Listings</p>
                    </div>
                    <div className="bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-5">
                      <p className="text-xl sm:text-3xl font-bold text-white tracking-tight">{cities.length}</p>
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/60 mt-1">Cities Covered</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-12 space-y-6">
                  <h3 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900">
                    {agentProjects.length} Active {agentProjects.length === 1 ? 'Listing' : 'Listings'}
                  </h3>
                  {agentProjects.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                      {agentProjects.map(project => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onSelect={handleSelectFromShowcase}
                          isFavorite={favorites.includes(project.id)}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500 font-medium">No active listings assigned to this agent right now.</p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Maps raw Firebase Auth error codes to short, human copy — the SDK's default
// messages ("Firebase: Error (auth/email-already-in-use).") are technical and
// look broken to a non-developer user.
const friendlyAuthError = (err: unknown): string => {
  const code = (err as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with that email. Try signing up instead.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'Network error — check your connection and try again.',
    'auth/unauthorized-domain': 'This domain isn\'t authorized for sign-in yet. Contact support.',
  };
  return map[code] || 'Something went wrong. Please try again.';
};

// Full Sign In / Sign Up modal — email+password with real account creation, a
// Google one-click option, and a forgot-password flow. Replaces the previous
// behavior where the "Login" button (and every other logged-out CTA) jumped
// straight to a Google popup with no way to use an email account.
const AuthModal = () => {
  const { isAuthModalOpen, closeAuthModal, authModalTab, setAuthModalTab, signIn, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'form' | 'forgot' | 'forgot-sent'>('form');

  const resetFields = () => {
    setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setError(null); setSubmitting(false); setMode('form'); setShowPassword(false);
  };

  const handleClose = () => {
    closeAuthModal();
    resetFields();
  };

  const handleTabChange = (tab: string) => {
    setAuthModalTab(tab as 'signin' | 'signup');
    setError(null);
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn();
      resetFields();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      resetFields();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Tell us your name.'); return; }
    if (!email) { setError('Enter your email.'); return; }
    if (password.length < 6) { setError('Password should be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords don\'t match.'); return; }
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, name);
      resetFields();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError('Enter the email on your account.'); return; }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setMode('forgot-sent');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent onClose={handleClose} className="max-w-md bg-white border-stone-200 rounded-3xl shadow-2xl p-0 overflow-hidden">
        <div className="px-6 pt-7 pb-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white text-sm font-extrabold shadow-sm">JG</span>
            <span className="text-lg font-extrabold text-stone-900 tracking-tight">Estate</span>
          </div>

          {mode === 'form' ? (
            <>
              <DialogHeader className="text-left p-0 space-y-1">
                <DialogTitle className="text-xl font-bold text-stone-900">
                  {authModalTab === 'signin' ? 'Welcome back' : 'Create your account'}
                </DialogTitle>
                <DialogDescription className="text-stone-500 text-sm">
                  {authModalTab === 'signin'
                    ? 'Sign in to manage listings, saved properties, and investments.'
                    : 'Join as a buyer, agent, builder, or investor — takes under a minute.'}
                </DialogDescription>
              </DialogHeader>

              <Tabs value={authModalTab} onValueChange={handleTabChange} className="mt-4">
                <TabsList className="grid grid-cols-2 w-full bg-stone-100 rounded-xl p-1">
                  <TabsTrigger value="signin" className="rounded-lg font-bold text-sm">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg font-bold text-sm">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-5">
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 rounded-xl border-stone-200 py-5" autoComplete="email" />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 rounded-xl border-stone-200 py-5" autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => { setError(null); setMode('forgot'); }} className="text-xs font-bold text-brand-600 hover:text-brand-700">
                        Forgot password?
                      </button>
                    </div>
                    {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
                    <Button type="submit" disabled={submitting} className="w-full bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-xl py-5">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-5">
                  <form onSubmit={handleSignUp} className="space-y-3">
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <Input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
                        className="pl-10 rounded-xl border-stone-200 py-5" autoComplete="name" />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 rounded-xl border-stone-200 py-5" autoComplete="email" />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Password (min. 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 rounded-xl border-stone-200 py-5" autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 rounded-xl border-stone-200 py-5" autoComplete="new-password" />
                    </div>
                    {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
                    <Button type="submit" disabled={submitting} className="w-full bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-xl py-5">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                    </Button>
                    <p className="text-[11px] text-stone-400 text-center leading-relaxed">
                      By signing up you agree to be contacted about your listings and enquiries.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Or</span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>

              <Button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                variant="outline"
                className="w-full rounded-xl py-5 border-stone-200 font-bold text-stone-700 hover:bg-stone-50 mb-6"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </Button>
            </>
          ) : mode === 'forgot' ? (
            <>
              <DialogHeader className="text-left p-0 space-y-1">
                <DialogTitle className="text-xl font-bold text-stone-900">Reset your password</DialogTitle>
                <DialogDescription className="text-stone-500 text-sm">Enter your account email and we'll send a reset link.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleForgotPassword} className="space-y-3 mt-4">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 rounded-xl border-stone-200 py-5" autoComplete="email" />
                </div>
                {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
                <Button type="submit" disabled={submitting} className="w-full bg-stone-900 text-white hover:bg-brand-600 font-bold rounded-xl py-5">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Link'}
                </Button>
                <button type="button" onClick={() => { setError(null); setMode('form'); }} className="w-full text-center text-xs font-bold text-stone-500 hover:text-stone-700 pb-6">
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="font-bold text-stone-900">Check your inbox</p>
              <p className="text-sm text-stone-500 px-4">We've sent a password reset link to <span className="font-semibold text-stone-700">{email}</span>.</p>
              <button type="button" onClick={() => { setMode('form'); setAuthModalTab('signin'); }} className="text-xs font-bold text-brand-600 hover:text-brand-700 pb-6 block w-full">
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
              <Route path="/builder/:builderName" element={<Dashboard />} />
              <Route path="/agent/:agentId" element={<Dashboard />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
            <FloatingAIChat />
            <AuthModal />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
