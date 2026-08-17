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
  EUR: { symbol: '€', locale: 'de-DE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  INR: { symbol: '₹', locale: 'en-IN' },
  AED: { symbol: 'AED ', locale: 'en-AE' },
  PLN: { symbol: 'zł', locale: 'pl-PL', suffix: true },
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

// Rough static FX rates to USD — for cross-currency budget-range filtering only, not financial advice.
export const FX_TO_USD: Record<string, number> = { USD: 1, EUR: 1.09, GBP: 1.27, PLN: 0.25, AED: 0.27, INR: 0.012 };
export const toUSD = (price: number, currency: string = 'USD'): number => price * (FX_TO_USD[currency] ?? 1);
// Legacy EUR-basis helpers, kept in case anything else still references them.
export const FX_TO_EUR: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, PLN: 0.23, AED: 0.25, INR: 0.0105 };
export const toEUR = (price: number, currency: string = 'EUR'): number => price * (FX_TO_EUR[currency] ?? 1);

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

export const COUNTRIES: Country[] = [
  {
    code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', region: 'Europe', unitLabel: 'm²',
    cities: [
      { city: 'Berlin', pricePerUnit: 5450, yoyChange: 3.2, series: makeSeries(5250, 18, 0) },
      { city: 'Munich', pricePerUnit: 9200, yoyChange: 2.1, series: makeSeries(8950, 21, 1) },
    ],
  },
  {
    code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', region: 'Europe', unitLabel: 'm²',
    cities: [
      { city: 'Paris', pricePerUnit: 10450, yoyChange: -1.4, series: makeSeries(10650, -18, 2) },
      { city: 'Lyon', pricePerUnit: 4900, yoyChange: 1.8, series: makeSeries(4780, 10, 3) },
    ],
  },
  {
    code: 'ES', name: 'Spain', flag: '🇪🇸', currency: 'EUR', region: 'Europe', unitLabel: 'm²',
    cities: [
      { city: 'Barcelona', pricePerUnit: 4650, yoyChange: 5.6, series: makeSeries(4380, 24, 4) },
      { city: 'Madrid', pricePerUnit: 4300, yoyChange: 6.2, series: makeSeries(4020, 26, 5) },
    ],
  },
  {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', region: 'Europe', unitLabel: 'm²',
    cities: [
      { city: 'Amsterdam', pricePerUnit: 7100, yoyChange: 4.3, series: makeSeries(6800, 26, 6) },
    ],
  },
  {
    code: 'IT', name: 'Italy', flag: '🇮🇹', currency: 'EUR', region: 'Europe', unitLabel: 'm²',
    cities: [
      { city: 'Milan', pricePerUnit: 5350, yoyChange: 3.8, series: makeSeries(5150, 17, 7) },
    ],
  },
  {
    code: 'PT', name: 'Portugal', flag: '🇵🇹', currency: 'EUR', region: 'Europe', unitLabel: 'm²',
    cities: [
      { city: 'Lisbon', pricePerUnit: 4800, yoyChange: 7.1, series: makeSeries(4450, 30, 8) },
    ],
  },
  {
    code: 'PL', name: 'Poland', flag: '🇵🇱', currency: 'PLN', region: 'Europe', unitLabel: 'm²',
    cities: [
      { city: 'Warsaw', pricePerUnit: 16800, yoyChange: 8.4, series: makeSeries(15500, 108, 9) },
    ],
  },
  {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', region: 'Europe', unitLabel: 'sqft',
    cities: [
      { city: 'London', pricePerUnit: 850, yoyChange: -0.6, series: makeSeries(862, -6, 10) },
    ],
  },
  {
    code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', region: 'North America', unitLabel: 'sqft',
    cities: [
      { city: 'New York', pricePerUnit: 1450, yoyChange: 2.9, series: makeSeries(1390, 16, 11) },
      { city: 'Miami', pricePerUnit: 620, yoyChange: 4.7, series: makeSeries(580, 12, 12) },
    ],
  },
  {
    code: 'AE', name: 'UAE', flag: '🇦🇪', currency: 'AED', region: 'Middle East', unitLabel: 'sqft',
    cities: [
      { city: 'Dubai', pricePerUnit: 1780, yoyChange: 11.2, series: makeSeries(1580, 60, 13) },
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
    name: 'Spree Terraces', description: 'Riverside new-build apartments in Friedrichshain with A+ energy rating, floor heating, and private balconies overlooking the Spree.',
    location: 'Friedrichshain, Berlin', city: 'Berlin', country: 'Germany', countryCode: 'DE', currency: 'EUR', region: 'Europe',
    totalUnits: 64, basePrice: 620000, imageUrl: img('1560448204-e02f11c3d0e2'), developerName: 'Berlin Urban Living',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '68 - 118 m²',
    constructionStatus: 'Under Construction', rentalYield: 3.6, aiScore: 90,
    amenities: ['A+ Energy Rating', 'Underfloor Heating', 'Bike Storage', 'Riverside Balcony'],
    landmarks: [{ name: 'Ostkreuz S-Bahn', distance: '6 mins' }, { name: 'East Side Gallery', distance: '10 mins' }],
  },
  {
    name: 'Maximilian Residenz', description: 'Altbau-style new construction near the English Garden, blending classic Munich facades with modern smart-home interiors.',
    location: 'Schwabing, Munich', city: 'Munich', country: 'Germany', countryCode: 'DE', currency: 'EUR', region: 'Europe',
    totalUnits: 40, basePrice: 980000, imageUrl: img('1512917774080-9991f1c4c750'), developerName: 'Bayern Real Group',
    verified: true, marketTrend: 'Stable', bhkOptions: ['3 BR', '4 BR'], areaRange: '95 - 165 m²',
    constructionStatus: 'Ready to Move', rentalYield: 3.1, aiScore: 93,
    amenities: ['Smart Home', 'Parkside Location', 'Concierge', 'Underground Parking'],
    landmarks: [{ name: 'English Garden', distance: '4 mins' }, { name: 'Munich Hbf', distance: '15 mins' }],
  },
  {
    name: 'Haussmann Lumière', description: 'Restored Haussmannian building in the 9th arrondissement, high ceilings, herringbone parquet, walkable to Opéra.',
    location: '9th Arrondissement, Paris', city: 'Paris', country: 'France', countryCode: 'FR', currency: 'EUR', region: 'Europe',
    totalUnits: 22, basePrice: 1150000, imageUrl: img('1502672260266-1c1ef2d93688'), developerName: 'Groupe Lumière Immobilier',
    verified: true, marketTrend: 'Bearish', bhkOptions: ['2 BR', '3 BR'], areaRange: '58 - 105 m²',
    constructionStatus: 'Ready to Move', rentalYield: 2.9, aiScore: 88,
    amenities: ['Herringbone Parquet', 'High Ceilings', 'Concierge (Gardien)', 'Elevator'],
    landmarks: [{ name: 'Opéra Garnier', distance: '5 mins' }, { name: 'Gare Saint-Lazare', distance: '8 mins' }],
  },
  {
    name: 'Presqu\'île Loft District', description: 'Converted industrial lofts on the Presqu\'île peninsula, exposed brick, walkable riverside city center.',
    location: 'Presqu\'île, Lyon', city: 'Lyon', country: 'France', countryCode: 'FR', currency: 'EUR', region: 'Europe',
    totalUnits: 30, basePrice: 385000, imageUrl: img('1493809842364-78817add7ffb'), developerName: 'Rhône Loft Developers',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['1 BR', '2 BR'], areaRange: '45 - 80 m²',
    constructionStatus: 'Ready to Move', rentalYield: 4.2, aiScore: 85,
    amenities: ['Exposed Brick Loft', 'Riverside Walk', 'Bike Path Access'],
    landmarks: [{ name: 'Part-Dieu Station', distance: '10 mins' }, { name: 'Rhône Riverbank', distance: '2 mins' }],
  },
  {
    name: 'Eixample Terraza', description: 'Modernist-block apartments in the Eixample grid, private terrace, steps from Sagrada Família.',
    location: 'Eixample, Barcelona', city: 'Barcelona', country: 'Spain', countryCode: 'ES', currency: 'EUR', region: 'Europe',
    totalUnits: 48, basePrice: 495000, imageUrl: img('1512917774080-9991f1c4c750'), developerName: 'Costa Urban Homes',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '72 - 130 m²',
    constructionStatus: 'Under Construction', rentalYield: 4.8, aiScore: 91,
    amenities: ['Private Terrace', 'Rooftop Pool', 'Solar Panels', 'Communal Garden'],
    landmarks: [{ name: 'Sagrada Família', distance: '7 mins' }, { name: 'Passeig de Gràcia', distance: '5 mins' }],
  },
  {
    name: 'Salamanca Prime', description: 'Prime-district Madrid residences with polished stone lobbies and 24-hour concierge, near Retiro Park.',
    location: 'Salamanca, Madrid', city: 'Madrid', country: 'Spain', countryCode: 'ES', currency: 'EUR', region: 'Europe',
    totalUnits: 36, basePrice: 720000, imageUrl: img('1600585154340-be6161a56a0c'), developerName: 'Madrid Capital Homes',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['3 BR', '4 BR'], areaRange: '110 - 180 m²',
    constructionStatus: 'Ready to Move', rentalYield: 4.1, aiScore: 92,
    amenities: ['24h Concierge', 'Marble Lobby', 'Retiro Park Views', 'Private Gym'],
    landmarks: [{ name: 'Retiro Park', distance: '3 mins' }, { name: 'Puerta de Alcalá', distance: '6 mins' }],
  },
  {
    name: 'Canal Zicht Residences', description: 'Canal-front new-build in Amsterdam Noord with sustainable timber construction and roof terraces.',
    location: 'Amsterdam Noord', city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', currency: 'EUR', region: 'Europe',
    totalUnits: 52, basePrice: 645000, imageUrl: img('1449844908441-8829872d2607'), developerName: 'NoordWonen Development',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '70 - 120 m²',
    constructionStatus: 'Pre-Launch', rentalYield: 3.9, aiScore: 89,
    amenities: ['Canal Views', 'Timber Sustainable Build', 'Roof Terrace', 'EV Charging'],
    landmarks: [{ name: 'Amsterdam Centraal (ferry)', distance: '8 mins' }, { name: 'NDSM Wharf', distance: '4 mins' }],
  },
  {
    name: 'Navigli Atelier', description: 'Design-forward residences along the Navigli canals, close to Milan\'s fashion and design district.',
    location: 'Navigli, Milan', city: 'Milan', country: 'Italy', countryCode: 'IT', currency: 'EUR', region: 'Europe',
    totalUnits: 28, basePrice: 560000, imageUrl: img('1512917774080-9991f1c4c750'), developerName: 'Milano Design Homes',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['1 BR', '2 BR'], areaRange: '55 - 95 m²',
    constructionStatus: 'Ready to Move', rentalYield: 4.0, aiScore: 87,
    amenities: ['Canal-side Terrace', 'Designer Fit-out', 'Concierge'],
    landmarks: [{ name: 'Navigli Canals', distance: '1 min' }, { name: 'Milano Centrale', distance: '18 mins' }],
  },
  {
    name: 'Tejo Vista Residences', description: 'Riverfront Lisbon apartments with panoramic Tejo views, growing golden-visa demand district.',
    location: 'Parque das Nações, Lisbon', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', currency: 'EUR', region: 'Europe',
    totalUnits: 60, basePrice: 415000, imageUrl: img('1600585154340-be6161a56a0c'), developerName: 'Tejo Capital Real Estate',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '75 - 125 m²',
    constructionStatus: 'Under Construction', rentalYield: 5.1, aiScore: 90,
    amenities: ['River Views', 'Rooftop Pool', 'Co-working Lounge', 'EV Charging'],
    landmarks: [{ name: 'Vasco da Gama Bridge', distance: '5 mins' }, { name: 'Oriente Station', distance: '7 mins' }],
  },
  {
    name: 'Wisła Bulwary', description: 'Riverside Warsaw development on the Wisła boulevards, fast-growing district with strong rental demand.',
    location: 'Powiśle, Warsaw', city: 'Warsaw', country: 'Poland', countryCode: 'PL', currency: 'PLN', region: 'Europe',
    totalUnits: 70, basePrice: 2350000, imageUrl: img('1449844908441-8829872d2607'), developerName: 'Wisła Development Group',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '58 - 98 m²',
    constructionStatus: 'Under Construction', rentalYield: 5.6, aiScore: 88,
    amenities: ['River Boulevard Access', 'Underground Parking', 'Playground', 'Bike Storage'],
    landmarks: [{ name: 'Copernicus Science Centre', distance: '4 mins' }, { name: 'Warsaw Centralna', distance: '12 mins' }],
  },
  {
    name: 'Riverside Wharf Collection', description: 'South Bank riverside development with panoramic Thames views, part of a major regeneration zone.',
    location: 'Nine Elms, London', city: 'London', country: 'United Kingdom', countryCode: 'GB', currency: 'GBP', region: 'Europe',
    totalUnits: 90, basePrice: 780000, imageUrl: img('1512917774080-9991f1c4c750'), developerName: 'Thames Regeneration Partners',
    verified: true, marketTrend: 'Stable', bhkOptions: ['1 BR', '2 BR', '3 BR'], areaRange: '520 - 1,150 sqft',
    constructionStatus: 'Under Construction', rentalYield: 4.4, aiScore: 89,
    amenities: ['Thames Views', 'Concierge', 'Residents Gym', 'Private Cinema Room'],
    landmarks: [{ name: 'Nine Elms Station', distance: '3 mins' }, { name: 'US Embassy', distance: '5 mins' }],
  },
  {
    name: 'Hudson Yards Sky Collection', description: 'Full-floor residences above the High Line with skyline views and 5-star hotel-style amenities.',
    location: 'Hudson Yards, New York', city: 'New York', country: 'United States', countryCode: 'US', currency: 'USD', region: 'North America',
    totalUnits: 54, basePrice: 2450000, imageUrl: img('1545324418-cc1a3fa10c00'), developerName: 'Related Skyline Partners',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR', 'Penthouse'], areaRange: '1,100 - 3,400 sqft',
    constructionStatus: 'Ready to Move', rentalYield: 3.4, aiScore: 95,
    amenities: ['High Line Access', 'Private Cinema', '75ft Pool', 'Wellness Spa'],
    landmarks: [{ name: 'The High Line', distance: '1 min' }, { name: 'Penn Station', distance: '10 mins' }],
  },
  {
    name: 'Brickell Bayview Towers', description: 'Waterfront Miami tower with resort-style amenities and direct Biscayne Bay views.',
    location: 'Brickell, Miami', city: 'Miami', country: 'United States', countryCode: 'US', currency: 'USD', region: 'North America',
    totalUnits: 120, basePrice: 890000, imageUrl: img('1600585154340-be6161a56a0c'), developerName: 'Bayview Development Corp',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR'], areaRange: '1,050 - 2,200 sqft',
    constructionStatus: 'Under Construction', rentalYield: 4.9, aiScore: 90,
    amenities: ['Bay Views', 'Marina Access', 'Infinity Pool', 'Valet Parking'],
    landmarks: [{ name: 'Brickell City Centre', distance: '4 mins' }, { name: 'Miami Int\'l Airport', distance: '18 mins' }],
  },
  {
    name: 'Palm Jumeirah Vista', description: 'Beachfront branded residences on the Palm with private beach access and skyline views of the Dubai coastline.',
    location: 'Palm Jumeirah, Dubai', city: 'Dubai', country: 'UAE', countryCode: 'AE', currency: 'AED', region: 'Middle East',
    totalUnits: 80, basePrice: 3200000, imageUrl: img('1512917774080-9991f1c4c750'), developerName: 'Palm Coastal Developers',
    verified: true, marketTrend: 'Bullish', bhkOptions: ['2 BR', '3 BR', 'Penthouse'], areaRange: '1,400 - 4,800 sqft',
    constructionStatus: 'Under Construction', rentalYield: 6.8, aiScore: 94,
    amenities: ['Private Beach', 'Infinity Pool', 'Concierge', 'Valet & Security'],
    landmarks: [{ name: 'Atlantis The Palm', distance: '6 mins' }, { name: 'Dubai Marina', distance: '15 mins' }],
  },
  {
    name: 'Lodha World Towers', description: 'Iconic luxury residences in the heart of Mumbai with world-class amenities and Arabian Sea views.',
    location: 'Lower Parel, Mumbai', city: 'Mumbai', country: 'India', countryCode: 'IN', currency: 'INR', region: 'Asia',
    totalUnits: 120, basePrice: 45000000, imageUrl: img('1545324418-cc1a3fa10c00'), developerName: 'Lodha Group',
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
];

// A handful of listings double as "for rent" — monthly rent figures (not sale price), spread
// across currencies so the Rent mode demonstrates the same multi-country coverage as Buy.
const RENT_MONTHLY_PRICE: Record<string, number> = {
  "Presqu'île Loft District": 1450, // EUR / month, Lyon
  'Navigli Atelier': 1800, // EUR / month, Milan
  'Haussmann Lumière': 2800, // EUR / month, Paris
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
