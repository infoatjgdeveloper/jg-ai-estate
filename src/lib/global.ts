/**
 * Global multi-country marketplace layer.
 * Currency formatting, country/city reference data, simulated market indices,
 * and seed listings — global coverage across Europe, North America, Asia and
 * the Middle East. USD is the common baseline (used for cross-market filtering
 * and default fallbacks); every listing still displays in its own local currency,
 * and that changes automatically as the user switches country/market.
 */

// ---------- Currency ----------
export const CURRENCY_META: Record<string, { symbol: string; locale: string; suffix?: boolean }> = {
  USD: { symbol: '$', locale: 'en-US' },
  INR: { symbol: '₹', locale: 'en-IN' },
};

const formatIndianWord = (price: number) => {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2).replace(/\.00$/, '')} Lakh`;
  return `₹${price.toLocaleString('en-IN')}`;
};

/** Universal price formatter: India uses Lakh/Cr, everyone else uses K/M with the local symbol. */
export const formatPrice = (price: number, currency: string = 'USD'): string => {
  if (currency === 'INR') return formatIndianWord(price);
  const meta = CURRENCY_META[currency] || CURRENCY_META.USD;
  let value: string;
  if (price >= 1_000_000) value = `${(price / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  else if (price >= 1_000) value = `${(price / 1_000).toFixed(0)}K`;
  else value = price.toLocaleString(meta.locale);
  return meta.suffix ? `${value} ${meta.symbol}` : `${meta.symbol}${value}`;
};

// Rough static FX rate to USD — for cross-currency budget-range filtering only, not financial advice.
export const FX_TO_USD: Record<string, number> = {
  USD: 1, INR: 0.012,
};
export const toUSD = (price: number, currency: string = 'USD'): number => price * (FX_TO_USD[currency] ?? 1);

export const formatPriceFull = (price: number, currency: string = 'USD'): string => {
  const meta = CURRENCY_META[currency] || CURRENCY_META.USD;
  const value = price.toLocaleString(meta.locale);
  return meta.suffix ? `${value} ${meta.symbol}` : `${meta.symbol}${value}`;
};

// ---------- Countries & simulated market index ----------
export interface CityIndex {
  city: string;
  pricePerUnit: number; // per sqm (EU/UK/India-metric) or per sqft (US) — see unitLabel
  yoyChange: number; // %
  series: number[]; // 12 simulated index points
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  region: 'Europe' | 'North America' | 'Asia' | 'Middle East';
  unitLabel: 'm²' | 'sqft';
  cities: CityIndex[];
}

// Deterministic pseudo-random series so the "index" looks alive but is stable across renders
const makeSeries = (base: number, drift: number, seedOffset: number): number[] => {
  const points: number[] = [];
  let v = base;
  for (let i = 0; i < 12; i++) {
    const wave = Math.sin((i + seedOffset) / 2.1) * (base * 0.015);
    v = v + drift + wave;
    points.push(Math.round(v));
  }
  return points;
};

// JGEstate narrowed its market focus to the United States and India only
// (previously covered all 27 EU member states plus the UK and UAE — that
// coverage was removed in full, not just hidden, per a deliberate scope
// decision to go deep on two markets instead of thin across many).
export const COUNTRIES: Country[] = [
  {
    code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', region: 'North America', unitLabel: 'sqft',
    cities: [
      { city: 'New York', pricePerUnit: 1450, yoyChange: 2.9, series: makeSeries(1390, 16, 11) },
      { city: 'Miami', pricePerUnit: 620, yoyChange: 4.7, series: makeSeries(580, 12, 12) },
    ],
  },
  {
    code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', region: 'Asia', unitLabel: 'sqft',
    cities: [
      { city: 'Mumbai', pricePerUnit: 24500, yoyChange: 9.1, series: makeSeries(22200, 190, 14) },
      { city: 'Bengaluru', pricePerUnit: 12200, yoyChange: 6.4, series: makeSeries(11400, 68, 15) },
    ],
  },
];

// ---------- Seed listings (one flagship + one secondary project per market) ----------
export interface GlobalSeedProject {
  name: string;
  description: string;
  location: string;
  city: string;
  country: string; // country name, matches Country.name
  countryCode: string;
  currency: string;
  region: Country['region'];
  totalUnits: number;
  basePrice: number; // sale: total asking price. rent: monthly rent in local currency.
  listingType?: 'sale' | 'rent'; // defaulted to 'sale' for raw entries; finalized in GLOBAL_SEED_PROJECTS below.
  imageUrl: string;
  images?: string[];
  lat?: number;
  lng?: number;
  developerName: string;
  reraId?: string; // India only
  verified: boolean;
  marketTrend: 'Bullish' | 'Stable' | 'Bearish';
  bhkOptions: string[];
  areaRange: string;
  constructionStatus: 'Ready to Move' | 'Under Construction' | 'Pre-Launch';
  rentalYield: number;
  aiScore: number;
  amenities: string[];
  landmarks: { name: string; distance: string }[];
}

const img = (seed: string) => `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;

// Approximate city-center coordinates used to place map pins.
const CITY_COORDS: Record<string, [number, number]> = {
  'Berlin': [52.5200, 13.4050], 'Munich': [48.1351, 11.5820],
  'Paris': [48.8566, 2.3522], 'Lyon': [45.7640, 4.8357],
  'Barcelona': [41.3874, 2.1686], 'Madrid': [40.4168, -3.7038],
  'Amsterdam': [52.3676, 4.9041], 'Milan': [45.4642, 9.1900],
  'Lisbon': [38.7223, -9.1393], 'Warsaw': [52.2297, 21.0122],
  'London': [51.5072, -0.1276], 'New York': [40.7128, -74.0060],
  'Miami': [25.7617, -80.1918], 'Dubai': [25.2048, 55.2708],
  'Mumbai': [19.0760, 72.8777], 'Bengaluru': [12.9716, 77.5946],
  'Ahmedabad': [23.0225, 72.5714],
  'Vienna': [48.2082, 16.3738], 'Brussels': [50.8503, 4.3517],
  'Sofia': [42.6977, 23.3219], 'Zagreb': [45.8150, 15.9819],
  'Nicosia': [35.1856, 33.3823], 'Prague': [50.0755, 14.4378],
  'Copenhagen': [55.6761, 12.5683], 'Tallinn': [59.4370, 24.7536],
  'Helsinki': [60.1699, 24.9384], 'Athens': [37.9838, 23.7275],
  'Budapest': [47.4979, 19.0402], 'Dublin': [53.3498, -6.2603],
  'Riga': [56.9496, 24.1052], 'Vilnius': [54.6872, 25.2797],
  'Luxembourg City': [49.6116, 6.1319], 'Valletta': [35.8989, 14.5146],
  'Bucharest': [44.4268, 26.1025], 'Bratislava': [48.1486, 17.1077],
  'Ljubljana': [46.0569, 14.5058], 'Stockholm': [59.3293, 18.0686],
  'Gurugram': [28.4595, 77.0266],
};

// Real, web-verified developer names, mapped from the earlier placeholder/fictional
// names that shipped in the original demo catalog. Used to (a) seed fresh Firestore
// instances with real names from day one, and (b) patch already-seeded live
// instances in place (see migrateRealBuilderData() in App.tsx) so existing
// deployments pick up the correction without a manual database reset.
// Sources: ensun.io/researchgermany.com (Germany), FPI/Cogedim/Bouygues Immobilier
// coverage (France), kredium.com (Spain), egeriagroup.com (Netherlands), COIMA
// (Milan), Vanguard Properties (Lisbon), Echo Investment (Warsaw), Ballymore Group
// (Nine Elms, London), Related Companies (Hudson Yards, NYC), Related Group
// (Brickell, Miami), Nakheel (Palm Jumeirah, Dubai).
export const DEVELOPER_NAME_MIGRATIONS: Record<string, string> = {
  'Berlin Urban Living': 'Bauwerk',
  'Bayern Real Group': 'DEMOS Wohnbau',
  'Groupe Lumière Immobilier': 'Cogedim',
  'Rhône Loft Developers': 'Bouygues Immobilier',
  'Costa Urban Homes': 'AEDAS Homes',
  'Madrid Capital Homes': 'Pryconsa',
  'NoordWonen Development': 'AM',
  'Milano Design Homes': 'COIMA',
  'Tejo Capital Real Estate': 'Vanguard Properties',
  'Wisła Development Group': 'Echo Investment',
  'Thames Regeneration Partners': 'Ballymore Group',
  'Related Skyline Partners': 'Related Companies',
  'Bayview Development Corp': 'Related Group',
  'Palm Coastal Developers': 'Nakheel',
};

// Small pool of interior/exterior stock photos reused to build a photo-grid gallery per listing.
const GALLERY_POOL = [
  '1512917774080-9991f1c4c750', '1600585154340-be6161a56a0c', '1449844908441-8829872d2607',
  '1502672260266-1c1ef2d93688', '1493809842364-78817add7ffb', '1545324418-cc1a3fa10c00',
  '1560448204-e02f11c3d0e2', '1616486338812-3dadae4b4ace', '1600607687939-ce8a6c25118c',
];

// Deterministic small offset so pins in the same city don't stack exactly on top of each other.
const jitter = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000;
  return (h / 1000 - 0.5) * 0.03;
};

const RAW_SEED_PROJECTS: GlobalSeedProject[] = [
  {
    name: 'Hudson Yards Sky Collection', description: 'Full-floor residences above the High Line with skyline views and 5-star hotel-style amenities.',
    location: 'Hudson Yards, New York', city: 'New York', country: 'United States', countryCode: 'US', currency: 'USD', region: 'North America',
    totalUnits: 54, basePrice: 2450000, imageUrl: img('1600585154340-be6161a56a0c'), developerName: 'Related Companies',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR', 'Penthouse'], areaRange: '1,100 - 3,400 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 3.4, aiScore: 95,
    amenities: ['High Line Access', 'Private Cinema', '75ft Pool', 'Wellness Spa'],
    landmarks: [{ name: 'The High Line', distance: '1 min' }, { name: 'Penn Station', distance: '10 mins' }],
  },
  {
    name: 'Brickell Bayview Towers', description: 'Waterfront Miami tower with resort-style amenities and direct Biscayne Bay views.',
    location: 'Brickell, Miami', city: 'Miami', country: 'United States', countryCode: 'US', currency: 'USD', region: 'North America',
    totalUnits: 120, basePrice: 890000, imageUrl: img('1449844908441-8829872d2607'), developerName: 'Related Group',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '1,050 - 2,200 sqft',
    constructionStatus: 'Under Construction', rentalYield: 4.9, aiScore: 90,
    amenities: ['Bay Views', 'Marina Access', 'Infinity Pool', 'Valet Parking'],
    landmarks: [{ name: 'Brickell City Centre', distance: '4 mins' }, { name: 'Miami Int\'l Airport', distance: '18 mins' }],
  },
  {
    name: 'Lodha World Towers', description: 'Iconic luxury residences in the heart of Mumbai with world-class amenities and Arabian Sea views.',
    location: 'Lower Parel, Mumbai', city: 'Mumbai', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 120, basePrice: 45000000, imageUrl: img('1560448204-e02f11c3d0e2'), developerName: 'Lodha Group',
    reraId: 'P51900008345', verified: true, marketTrend: 'Bullish', bhkOptions: ['3 BR', '4 BR', 'Penthouse'], areaRange: '2,400 - 5,200 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 4.8, aiScore: 94,
    amenities: ['Spa & Wellness Center', 'Arabian Sea View Deck', 'Private Elevators'],
    landmarks: [{ name: 'Lower Parel Metro', distance: '2 mins' }, { name: 'Int\'l Airport', distance: '25 mins' }],
  },
  {
    name: 'Prestige King\'s Court', description: 'Elegant apartments in Bangalore\'s prime location, proximity to major IT hubs.',
    location: 'Koramangala, Bengaluru', city: 'Bengaluru', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 80, basePrice: 28000000, imageUrl: img('1512917774080-9991f1c4c750'), developerName: 'Prestige Group',
    reraId: 'PRM/KA/RERA/1251/310/PR/170915/000187', verified: true, marketTrend: 'Stable', bhkOptions: ['3 BR', '4 BR'], areaRange: '1,950 - 3,400 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 5.2, aiScore: 91,
    amenities: ['Rooftop Jogging Route', 'Smart Home Automation', 'Heated Pool'],
    landmarks: [{ name: 'Koramangala Club', distance: '3 mins' }, { name: 'Forum Mall', distance: '5 mins' }],
  },
  // --- Gujarat / Ahmedabad, India — real, web-verified developers and project names ---
  {
    name: 'Shantigram - La Marina', description: 'Waterfront residences within Shantigram, a 600-acre integrated township on SG Highway between Ahmedabad and Gandhinagar, developed by Adani Realty.',
    location: 'Shantigram, SG Highway, Ahmedabad', city: 'Ahmedabad', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 96, basePrice: 9500000, imageUrl: img('1600607687939-ce8a6c25118c'), developerName: 'Adani Realty',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR', '4 BR'], areaRange: '1,250 - 2,800 sqft',
    constructionStatus: 'Under Construction', rentalYield: 4.3, aiScore: 92,
    amenities: ['Township Clubhouse', 'Landscaped Boulevards', 'Lake-Facing Decks', '24x7 Security'],
    landmarks: [{ name: 'SG Highway', distance: '2 mins' }, { name: 'Gandhinagar', distance: '15 mins' }],
  },
  {
    name: 'Godrej Garden City', description: "Ahmedabad's first self-sufficient integrated township within AMC limits, at Jagatpur, developed by Godrej Properties.",
    location: 'Jagatpur, Ahmedabad', city: 'Ahmedabad', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 110, basePrice: 7200000, imageUrl: img('1493809842364-78817add7ffb'), developerName: 'Godrej Properties',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '1,050 - 2,100 sqft',
    constructionStatus: 'Under Construction', rentalYield: 4.0, aiScore: 90,
    amenities: ['Central Green Spine', 'Clubhouse', 'Sports Courts', 'School Within Township'],
    landmarks: [{ name: 'Sabarmati Riverfront', distance: '12 mins' }, { name: 'Jagatpur Circle', distance: '3 mins' }],
  },
  {
    name: 'Arvind Bel Air', description: 'Premium residences by Arvind SmartSpaces, the real estate arm of the Kasturbhai Lalbhai Group, in one of Ahmedabad\'s established western-corridor neighborhoods.',
    location: 'Bopal, Ahmedabad', city: 'Ahmedabad', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 72, basePrice: 6400000, imageUrl: img('1616486338812-3dadae4b4ace'), developerName: 'Arvind SmartSpaces',
    verified: true, marketTrend: 'Stable', bhkOptions: ['2 BR', '3 BR'], areaRange: '980 - 1,850 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 3.8, aiScore: 89,
    amenities: ['Landscaped Podium Garden', 'Clubhouse', 'Multipurpose Hall', 'Kids\' Play Area'],
    landmarks: [{ name: 'SP Ring Road', distance: '5 mins' }, { name: 'Bopal-Ghuma Road', distance: '2 mins' }],
  },
  // --- Maharashtra / Mumbai, India — additional real, web-verified developers ---
  {
    name: 'Three Sixty West', description: 'Oberoi Realty\'s ultra-luxury waterfront twin towers in Worli, one of Mumbai\'s most recognized skyline landmarks.',
    location: 'Worli, Mumbai', city: 'Mumbai', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 60, basePrice: 90000000, imageUrl: img('1512917774080-9991f1c4c750'), developerName: 'Oberoi Realty',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['4 BR', 'Penthouse'], areaRange: '3,200 - 7,600 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 3.2, aiScore: 96,
    amenities: ['Private Cinema', 'Racquetball & Squash Court', 'Sky Lounge', 'Sea-Facing Deck'],
    landmarks: [{ name: 'Worli Sea Face', distance: '2 mins' }, { name: 'Bandra-Worli Sea Link', distance: '5 mins' }],
  },
  {
    name: 'Hiranandani Gardens', description: 'A landmark self-contained planned township in Powai by Hiranandani Group, with lakeside promenades, schools, and retail woven into the residential precincts.',
    location: 'Powai, Mumbai', city: 'Mumbai', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 140, basePrice: 32000000, imageUrl: img('1449844908441-8829872d2607'), developerName: 'Hiranandani Group',
    verified: true, marketTrend: 'Stable', bhkOptions: ['2 BR', '3 BR', '4 BR'], areaRange: '1,400 - 3,600 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 3.9, aiScore: 93,
    amenities: ['Powai Lake Promenade', 'Landscaped Township', 'Clubhouse', 'On-Site Schools'],
    landmarks: [{ name: 'Powai Lake', distance: '3 mins' }, { name: 'Hiranandani Business Park', distance: '6 mins' }],
  },
  // --- Karnataka / Bengaluru, India — additional real, web-verified developers ---
  {
    name: 'Sobha Dream Acres', description: 'A large gated residential community by Sobha Limited in the Panathur-Whitefield IT corridor, known for Sobha\'s in-house construction quality standards.',
    location: 'Panathur, Bengaluru', city: 'Bengaluru', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 150, basePrice: 12500000, imageUrl: img('1600585154340-be6161a56a0c'), developerName: 'Sobha Limited',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['1 BR', '2 BR', '3 BR'], areaRange: '650 - 1,650 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 4.6, aiScore: 90,
    amenities: ['Clubhouse', 'Multiple Swimming Pools', 'Sports Arena', 'Landscaped Gardens'],
    landmarks: [{ name: 'Panathur Main Road', distance: '2 mins' }, { name: 'Whitefield IT Corridor', distance: '10 mins' }],
  },
  {
    name: 'Brigade Cornerstone Utopia', description: 'A large integrated residential enclave in Whitefield by Brigade Group, one of Bengaluru\'s established developers.',
    location: 'Whitefield, Bengaluru', city: 'Bengaluru', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 130, basePrice: 9800000, imageUrl: img('1545324418-cc1a3fa10c00'), developerName: 'Brigade Group',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '1,150 - 2,050 sqft',
    constructionStatus: 'Under Construction', rentalYield: 4.4, aiScore: 91,
    amenities: ['Central Clubhouse', 'Amphitheatre', 'Jogging Trails', 'Multi-Sport Courts'],
    landmarks: [{ name: 'ITPL Whitefield', distance: '8 mins' }, { name: 'Whitefield Metro', distance: '6 mins' }],
  },
  {
    name: 'DLF The Camellias', description: 'An ultra-luxury residential enclave on Golf Course Road, Gurugram by DLF, India\'s largest listed real estate developer.',
    location: 'Golf Course Road, Gurugram', city: 'Gurugram', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 70, basePrice: 180000000, imageUrl: img('1600585154340-be6161a56a0c'), developerName: 'DLF',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['4 BR', 'Penthouse'], areaRange: '4,400 - 8,600 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 3.0, aiScore: 97,
    amenities: ['Golf Course Views', 'Private Elevators', 'Clubhouse & Spa', '24x7 Concierge'],
    landmarks: [{ name: 'DLF Golf & Country Club', distance: '2 mins' }, { name: 'Cyber Hub', distance: '12 mins' }],
  },
];

// A handful of listings double as "for rent" — monthly rent figures (not sale price), spread
// across currencies so the Rent mode demonstrates the same multi-country coverage as Buy.
const RENT_MONTHLY_PRICE: Record<string, number> = {
  "Prestige King's Court": 95000, // INR / month, Bengaluru
};

// Attach map coordinates + a photo gallery to every seed listing.
export const GLOBAL_SEED_PROJECTS: GlobalSeedProject[] = RAW_SEED_PROJECTS.map((p, idx) => {
  const coords = CITY_COORDS[p.city] || [52.5, 13.4];
  const gallery = [0, 1, 2, 3].map((n) => GALLERY_POOL[(idx + n) % GALLERY_POOL.length]).map(img);
  const isRent = p.name in RENT_MONTHLY_PRICE;
  return {
    ...p,
    lat: coords[0] + jitter(p.name),
    lng: coords[1] + jitter(p.name + p.city),
    images: [p.imageUrl, ...gallery.filter((g) => g !== p.imageUrl)].slice(0, 5),
    listingType: isRent ? 'rent' : 'sale',
    basePrice: isRent ? RENT_MONTHLY_PRICE[p.name] : p.basePrice,
  };
});
