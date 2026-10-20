import "server-only";
import type { CrawlResult } from "./crawl";
import type { BusinessProfile } from "@/lib/types";
import { domainOf } from "./mentions";

/*
 * Free, deterministic business profile from the website (no AI call): name, what the business is, city, country.
 * It is a guess; the owner confirms or corrects it in one step before any AI question is asked, which keeps the
 * questions accurate without paying for a profile call.
 */

/* schema.org types → plain words. */
const SCHEMA_TYPES: Record<string, string> = {
  Dentist: "dentist",
  Restaurant: "restaurant",
  CafeOrCoffeeShop: "coffee shop",
  Bakery: "bakery",
  BarOrPub: "bar",
  Plumber: "plumber",
  Electrician: "electrician",
  HVACBusiness: "heating and air conditioning company",
  RoofingContractor: "roofing contractor",
  GeneralContractor: "contractor",
  HousePainter: "painter",
  Locksmith: "locksmith",
  MovingCompany: "moving company",
  HairSalon: "hair salon",
  BeautySalon: "beauty salon",
  NailSalon: "nail salon",
  DaySpa: "spa",
  HealthClub: "gym",
  ExerciseGym: "gym",
  AutoRepair: "car repair shop",
  AutoDealer: "car dealer",
  RealEstateAgent: "real estate agent",
  Attorney: "lawyer",
  LegalService: "law firm",
  AccountingService: "accountant",
  InsuranceAgency: "insurance agency",
  Physician: "doctor",
  MedicalClinic: "clinic",
  Optician: "optician",
  Pharmacy: "pharmacy",
  VeterinaryCare: "vet",
  Hotel: "hotel",
  LodgingBusiness: "hotel",
  ChildCare: "childcare",
  Florist: "florist",
  ClothingStore: "clothing store",
  JewelryStore: "jewelry store",
  FurnitureStore: "furniture store",
  PetStore: "pet store",
  BikeStore: "bike shop",
  SportsActivityLocation: "sports venue",
  AmusementPark: "activity park",
  TravelAgency: "travel agency",
  Photographer: "photographer",
};

/* Keyword fallback, checked against title, H1 and meta description. First match wins, so specific words go first. */
const KEYWORDS: [RegExp, string][] = [
  [/\bdentist|dental\b|tandarts|zahnarzt|dentiste/i, "dentist"],
  [/orthodont/i, "orthodontist"],
  [/physiotherap|physical therap|fysio/i, "physiotherapist"],
  [/chiropract/i, "chiropractor"],
  [/\bvet(erinar)?\b|dierenarts|tierarzt/i, "vet"],
  [/plumb|loodgieter|klempner/i, "plumber"],
  [/electrician|electrical contractor|elektricien|elektriker/i, "electrician"],
  [/hvac|air condition|heating|airco|warmtepomp|heat pump/i, "heating and air conditioning company"],
  [/roof|dakdekker/i, "roofing contractor"],
  [/window|kozijn|fenster/i, "window company"],
  [/solar|zonnepanel/i, "solar panel installer"],
  [/locksmith|slotenmaker/i, "locksmith"],
  [/barber|kapper|friseur|coiffeur|hair ?salon|hairdress/i, "hair salon"],
  [/nail/i, "nail salon"],
  [/beauty|salon|schoonheid|kosmetik/i, "beauty salon"],
  [/\bspa\b|massage/i, "spa"],
  [/\bgym\b|fitness|crossfit|sportschool/i, "gym"],
  [/yoga|pilates/i, "yoga studio"],
  [/pizza|pizzeria/i, "pizzeria"],
  [/sushi/i, "sushi restaurant"],
  [/coffee|caf[eé]\b|espresso/i, "coffee shop"],
  [/bakery|bakkerij|bäckerei|boulangerie/i, "bakery"],
  [/restaurant|bistro|trattoria|brasserie|grill/i, "restaurant"],
  [/hotel|b&b|bed and breakfast|guesthouse|hostel/i, "hotel"],
  [/real estate|realtor|makelaar|immobilien/i, "real estate agent"],
  [/lawyer|attorney|law firm|advocaat|anwalt|solicitor/i, "lawyer"],
  [/accountant|bookkeep|boekhoud|steuerberater|tax/i, "accountant"],
  [/garage|car repair|auto repair|mechanic|autobedrijf|werkstatt/i, "car repair shop"],
  [/photograph|fotograf/i, "photographer"],
  [/wedding|bruiloft/i, "wedding service"],
  [/clean(ing|ers)|schoonmaak|reinigung/i, "cleaning company"],
  [/moving|movers|verhuis|umzug/i, "moving company"],
  [/florist|flower|bloem/i, "florist"],
  [/marketing agency|seo|web design|webdesign/i, "marketing agency"],
  [/perfume|parfum|fragrance/i, "perfume shop"],
  [/jewel|sieraden|schmuck/i, "jewelry store"],
];

const TLD_COUNTRY: Record<string, string> = { nl: "NL", be: "BE", de: "DE", fr: "FR", es: "ES", it: "IT", pt: "PT", uk: "GB", ie: "IE", au: "AU", nz: "NZ", ca: "CA", us: "US", at: "AT", ch: "CH", se: "SE", dk: "DK", no: "NO", fi: "FI", pl: "PL", ph: "PH", th: "TH", sg: "SG", my: "MY", za: "ZA", ae: "AE", in: "IN", mx: "MX", br: "BR" };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : Array.isArray(v) ? str(v[0]) : "");
const types = (n: Record<string, unknown>) => ([] as unknown[]).concat(n["@type"] ?? []).map(String);

function cleanName(raw: string, domain: string): string {
  // "Home | Bright Smile Dental – Austin" → "Bright Smile Dental"
  const parts = raw.split(/\s[|–—\-:·•]\s/).map((p) => p.trim()).filter(Boolean);
  const notGeneric = parts.filter((p) => !/^(home|homepage|welcome|start|startseite|accueil|inicio)$/i.test(p));
  const root = domain.split(".")[0].replace(/[-_]/g, "");
  const byDomain = notGeneric.find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(root.slice(0, 5)));
  const pick = byDomain || notGeneric.sort((a, b) => a.length - b.length)[0] || "";
  return pick.slice(0, 80);
}

export function guessProfile(crawl: CrawlResult, countryHint: string): BusinessProfile {
  const domain = domainOf(crawl.startUrl);
  const all = crawl.pages.flatMap((p) => p.jsonld);
  const biz = all.find((n) => types(n).some((t) => SCHEMA_TYPES[t] || /Business|Organization|Store|Restaurant|Service/.test(t)));
  const home = crawl.pages.find((p) => p.kind === "home") || crawl.pages[0];

  const name =
    str(biz?.name) ||
    home.ogSiteName ||
    cleanName(home.title, domain) ||
    domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  let category = biz ? types(biz).map((t) => SCHEMA_TYPES[t]).find(Boolean) || "" : "";
  if (!category) {
    const hay = [home.title, ...home.h1, home.metaDescription, ...home.headings.slice(0, 6)].join(" ");
    category = KEYWORDS.find(([re]) => re.test(hay))?.[1] || "";
  }

  const addr = (biz?.address || all.find((n) => types(n).includes("PostalAddress"))) as Record<string, unknown> | undefined;
  const city = str(addr?.addressLocality);
  let country = str(addr?.addressCountry).toUpperCase();
  if (typeof addr?.addressCountry === "object") country = str((addr.addressCountry as Record<string, unknown>).name).toUpperCase();
  if (country.length !== 2) country = TLD_COUNTRY[domain.split(".").pop() || ""] || countryHint || "US";

  const ecommerce = all.some((n) => types(n).some((t) => /Product|Offer/.test(t))) && !addr;

  return {
    name,
    website: crawl.startUrl,
    domain,
    category,
    service: "",
    city,
    country,
    reach: ecommerce ? "online" : "local",
    confirmed: false,
  };
}
