/**
 * Business profiling from crawled evidence. Deterministic rules run first and every value cites
 * the pages it came from; an optional AI interpretation is merged only where it is grounded in
 * the cited pages (its evidence URLs must be pages VisTa fetched and its wording must appear there).
 */
import type { Discovery } from "./crawl";
import type { Confidence } from "./model";
import type { PageRecord } from "./page";
import { cities, countries, currencyCountry, normaliseAudience, tldCountry } from "./business";
import { marketPhrase, recId, type Basis, type BusinessProfile, type EvidenceRef, type Rec } from "./discovery-model";

type Cue = { label: string; cues: string[] };
type IndustryDef = Cue & { schema: RegExp; subsectors: Cue[] };
export const industries: IndustryDef[] = [
  { label: "Education and training", schema: /^(EducationalOrganization|School|CollegeOrUniversity|Course|EducationalOccupationalProgram)$/, cues: ["course", "courses", "training", "academy", "enrol", "enrolment", "curriculum", "qualification", "certificate", "certification", "learners", "students", "tutor", "tuition", "diploma", "lessons", "programme", "workshop", "cpd", "apprenticeship", "module", "syllabus", "trainees"],
    subsectors: [
      { label: "Vocational and professional training", cues: ["professional", "career", "job-ready", "apprenticeship", "placement", "cpd", "upskill", "employability", "hands-on", "practical"] },
      { label: "Healthcare and laboratory training", cues: ["laboratory", "clinical", "biomedical", "histology", "haematology", "microbiology", "phlebotomy", "medical", "nhs", "healthcare", "pathology", "biochemistry"] },
      { label: "Higher education", cues: ["university", "degree", "undergraduate", "postgraduate", "masters", "phd", "campus"] },
      { label: "Online learning", cues: ["online", "e-learning", "elearning", "virtual", "self-paced", "webinar", "remote"] },
      { label: "Language education", cues: ["english", "ielts", "esol", "language", "toefl"] },
      { label: "Tutoring and exam preparation", cues: ["tutor", "tutoring", "gcse", "a-level", "exam", "revision"] },
      { label: "Corporate learning and development", cues: ["leadership", "management", "corporate", "workforce", "team", "coaching"] },
    ] },
  { label: "Healthcare and life sciences", schema: /^(MedicalOrganization|Hospital|MedicalClinic|Physician|Dentist|Pharmacy|MedicalBusiness|DiagnosticLab|MedicalProcedure|MedicalTest)$/, cues: ["patients", "patient", "clinical", "laboratory", "diagnostics", "diagnostic", "medical", "health", "healthcare", "nhs", "hospital", "clinic", "treatment", "therapy", "pathology", "biomedical", "pharmacy", "dental", "nursing"],
    subsectors: [
      { label: "Clinical laboratory and diagnostics", cues: ["laboratory", "pathology", "diagnostics", "histology", "haematology", "microbiology", "biomedical", "specimen", "biochemistry", "blood"] },
      { label: "Primary and specialist care", cues: ["clinic", "gp", "consultant", "surgery", "treatment", "patients", "appointment"] },
      { label: "Dental care", cues: ["dental", "dentist", "orthodontic", "implants"] },
      { label: "Pharmacy", cues: ["pharmacy", "prescription", "pharmacist"] },
      { label: "Mental health", cues: ["therapy", "counselling", "mental", "anxiety", "psychotherapy"] },
      { label: "Life sciences and biotechnology", cues: ["biotech", "research", "pharmaceutical", "trials", "genomics"] },
    ] },
  { label: "Professional services", schema: /^(ProfessionalService|LegalService|AccountingService|Attorney|EmploymentAgency)$/, cues: ["consulting", "consultancy", "advisory", "advisors", "advisers", "clients", "strategy", "expertise", "firm", "partners", "practice", "engagement", "solicitors", "accountants", "agency", "consultants"],
    subsectors: [
      { label: "Management consulting", cues: ["strategy", "transformation", "operations", "consulting", "performance", "change"] },
      { label: "Legal services", cues: ["solicitors", "lawyers", "legal", "litigation", "law", "conveyancing"] },
      { label: "Accounting and tax", cues: ["accountants", "accounting", "tax", "audit", "bookkeeping", "payroll"] },
      { label: "Marketing and digital agency", cues: ["marketing", "seo", "branding", "advertising", "campaigns", "social", "digital", "creative"] },
      { label: "Recruitment and HR", cues: ["recruitment", "recruiting", "hiring", "talent", "hr", "staffing", "vacancies"] },
      { label: "Risk and compliance advisory", cues: ["risk", "compliance", "governance", "regulatory", "assurance"] },
      { label: "Technology consulting", cues: ["cloud", "cybersecurity", "software", "transformation", "it"] },
    ] },
  { label: "Retail and ecommerce", schema: /^(Store|OnlineStore|Product|ProductGroup|ClothingStore|SportingGoodsStore)$/, cues: ["shop", "cart", "basket", "checkout", "delivery", "returns", "products", "collection", "sale", "sizes", "stock", "order", "buy", "shipping"],
    subsectors: [
      { label: "Fashion and apparel", cues: ["clothing", "fashion", "shoes", "apparel", "dresses", "menswear", "womenswear", "jackets"] },
      { label: "Outdoor and sports equipment", cues: ["hiking", "outdoor", "camping", "tents", "boots", "sports", "cycling", "waterproof"] },
      { label: "Home and garden", cues: ["furniture", "garden", "decor", "kitchen", "bedding", "homeware"] },
      { label: "Health and beauty", cues: ["skincare", "beauty", "cosmetics", "haircare", "fragrance"] },
      { label: "Consumer electronics", cues: ["electronics", "phones", "laptops", "gadgets", "audio"] },
      { label: "Food and drink", cues: ["food", "coffee", "wine", "groceries", "snacks", "tea"] },
    ] },
  { label: "Technology and software", schema: /^(SoftwareApplication|WebApplication|MobileApplication)$/, cues: ["software", "platform", "saas", "api", "integration", "integrations", "cloud", "dashboard", "analytics", "automation", "app", "apps", "data", "ai", "intelligence", "tool", "tools", "collaborative", "collaboration", "editor", "whiteboard", "open source", "developers"],
    subsectors: [
      { label: "Marketing and analytics technology", cues: ["analytics", "marketing", "seo", "insights", "intelligence", "dashboard"] },
      { label: "Artificial intelligence", cues: ["ai", "machine", "models", "automation", "generative"] },
      { label: "Developer tools", cues: ["api", "sdk", "developers", "deploy"] },
      { label: "Cybersecurity", cues: ["security", "cybersecurity", "threat", "compliance"] },
      { label: "Education technology", cues: ["lms", "learning", "edtech", "classroom"] },
    ] },
  { label: "Financial services", schema: /^(FinancialService|BankOrCreditUnion|InsuranceAgency|AccountingService)$/, cues: ["loans", "mortgage", "mortgages", "insurance", "investment", "investments", "banking", "wealth", "pension", "credit", "finance", "savings"], subsectors: [{ label: "Lending", cues: ["loans", "credit", "lending"] }, { label: "Insurance", cues: ["insurance", "cover", "policy"] }, { label: "Wealth and investment", cues: ["wealth", "investment", "pension", "portfolio"] }] },
  { label: "Hospitality and travel", schema: /^(Hotel|LodgingBusiness|Restaurant|FoodEstablishment|TravelAgency|TouristTrip|BedAndBreakfast)$/, cues: ["hotel", "rooms", "booking", "restaurant", "menu", "travel", "holidays", "tours", "stay", "guests", "dining"], subsectors: [{ label: "Accommodation", cues: ["hotel", "rooms", "stay", "suites"] }, { label: "Food service", cues: ["restaurant", "menu", "dining"] }, { label: "Travel and tours", cues: ["travel", "tours", "holidays", "trips"] }] },
  { label: "Real estate and property", schema: /^(RealEstateAgent|Residence|Apartment|House)$/, cues: ["property", "properties", "homes", "lettings", "rent", "estate", "landlords", "tenants", "valuation"], subsectors: [{ label: "Sales and lettings", cues: ["lettings", "rent", "sale", "valuation"] }, { label: "Property management", cues: ["landlords", "management", "maintenance"] }] },
  { label: "Construction and trades", schema: /^(HomeAndConstructionBusiness|GeneralContractor|Plumber|Electrician|RoofingContractor)$/, cues: ["construction", "builders", "roofing", "plumbing", "electrician", "renovation", "extension", "refurbishment", "contractors"], subsectors: [] },
  { label: "Manufacturing and industrial", schema: /^(Manufacturer)$/, cues: ["manufacturing", "industrial", "machinery", "components", "fabrication", "engineering", "production"], subsectors: [] },
  { label: "Non-profit and community", schema: /^(NGO|NonprofitOrganization)$/, cues: ["charity", "donate", "volunteer", "community", "foundation", "fundraising", "mission"], subsectors: [] },
  { label: "Media and publishing", schema: /^(NewsMediaOrganization|Blog|Periodical)$/, cues: ["news", "articles", "magazine", "podcast", "editorial", "stories"], subsectors: [] },
  { label: "Immigration and relocation services", schema: /^$/, cues: ["visa", "visas", "immigration", "sponsorship", "relocation", "settlement", "permit"], subsectors: [] },
  { label: "Logistics and transport", schema: /^(MovingCompany)$/, cues: ["logistics", "freight", "courier", "transport", "warehousing", "haulage"], subsectors: [] },
  { label: "Beauty, wellness and fitness", schema: /^(BeautySalon|DaySpa|HealthClub|ExerciseGym)$/, cues: ["salon", "spa", "fitness", "gym", "yoga", "massage", "wellness"], subsectors: [] },
];

const generic = new Set(["course", "product", "service", "programme", "program", "item", "category", "collection", "solution", "package", "plan", "treatment", "class", "workshop", "home", "homepage", "about", "about us", "contact", "contact us", "blog", "news", "faq", "faqs", "login", "log in", "sign in", "register", "cart", "basket", "search", "menu", "all courses", "courses", "our courses", "services", "our services", "products", "all products", "shop", "store", "resources", "careers", "team", "our team", "privacy", "privacy policy", "terms", "terms and conditions", "cookie policy", "policy", "gallery", "events", "testimonials", "reviews", "pricing", "apply", "apply now", "enrol", "enrol now", "more", "read more", "view all", "learn more", "get started", "book now", "shop now", "sitemap", "accessibility", "alumni", "partners", "support", "help", "account", "my account", "wishlist", "training", "solutions", "programmes", "programs", "categories", "explore", "discover", "insights", "case studies", "contact sales", "start free trial", "free trial", "request a demo", "book a demo"]);
const offeringPath = /\/(services?|solutions?|courses?|training|programmes?|programs?|products?|shop|collections?|categor(y|ies)|what-we-do|expertise|practice-areas?|treatments?|packages?|plans?)(\/|$)/i;
export const stop = new Set("a an the and or for of to in on at by with from your our their its is are be this that these those you we us it as into about over under more most best top new how what why when where which who per via vs".split(" "));
export const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/[\s-]+/).filter(t => t.length > 1 && !stop.has(t));
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, c => c.toUpperCase());
export function humaniseSlug(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(parts[parts.length - 1] || "").replace(/\.(html?|php|aspx?)$/i, "").replace(/[-_]+/g, " ").replace(/\b\d{3,}\b/g, "").replace(/\s+/g, " ").trim();
    return last.length >= 3 ? titleCase(last) : null;
  } catch { return null; }
}
const jaccard = (a: string, b: string) => { const x = new Set(tokens(a)), y = new Set(tokens(b)); if (!x.size || !y.size) return 0; let n = 0; for (const t of x) if (y.has(t)) n += 1; return n / (x.size + y.size - n); };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase() || jaccard(a, b) >= 0.75;

export function pageCorpus(p: PageRecord): string {
  const b = p.business;
  return [p.title, p.description, ...p.h1, ...p.headings.map(h => h.text), p.content.excerpt, ...(b ? [...b.nav.map(n => n.text), ...b.entities.map(e => e.name + " " + (e.description || "")), ...b.claims, b.hero.heading, b.hero.text, b.description, ...b.audiences.map(a => a.phrase), ...b.places.map(x => x.name)] : []), ...p.content.terms.map(t => t[0])].filter(Boolean).join(" \n ").toLowerCase();
}

const rec = (prefix: string, value: string, basis: Basis, confidence: Confidence, evidence: EvidenceRef[], note?: string, selected = true): Rec => ({ id: recId(prefix, value), value, basis, confidence, evidence: evidence.slice(0, 8), note, selected });

/** Score each industry by cue words across titles, headings, navigation, entities and body terms, plus schema types. */
export function industryScores(pages: PageRecord[]) {
  const corpus = pages.map(p => ({ url: p.finalUrl, text: [p.title, p.title, p.description, p.og.description, ...p.h1, ...p.h1, ...p.headings.map(h => h.text), ...(p.business?.nav.map(n => n.text) || []), ...(p.business?.entities.map(e => e.name) || [])].join(" ").toLowerCase(), terms: new Map(p.content.terms), types: p.schema.types }));
  const score = (cues: string[]) => {
    const hits = new Map<string, { count: number; urls: Set<string> }>();
    for (const page of corpus) for (const cue of cues) {
      const n = (page.text.match(new RegExp("\\b" + cue.replace(/[-]/g, "[- ]?") + "\\b", "g")) || []).length * 2 + (page.terms.get(cue) || 0);
      if (n) { const h = hits.get(cue) || { count: 0, urls: new Set<string>() }; h.count += n; h.urls.add(page.url); hits.set(cue, h); }
    }
    return { total: [...hits.values()].reduce((s, h) => s + Math.min(h.count, 60), 0), hits };
  };
  return industries.map(def => {
    const s = score(def.cues);
    const schemaPages = corpus.filter(p => p.types.some(t => def.schema.test(t)));
    return { def, score: s.total + schemaPages.length * 15, hits: s.hits, schemaPages: schemaPages.map(p => p.url), subsectors: def.subsectors.map(sub => ({ sub, ...score(sub.cues) })).filter(x => x.hits.size >= 2).sort((a, b) => b.total - a.total) };
  }).sort((a, b) => b.score - a.score);
}

function countryName(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(gb|uk)$/i.test(v)) return "United Kingdom";
  if (/^us(a)?$/i.test(v)) return "United States";
  if (/^[a-z]{2}$/i.test(v)) return tldCountry[v.toLowerCase()] || null;
  for (const [country, names] of Object.entries(countries)) if (names.some(n => n.toLowerCase() === v.toLowerCase()) || country.toLowerCase() === v.toLowerCase()) return country;
  return cities[v] || null;
}

export function marketRecs(pages: PageRecord[], website: string): Rec[] {
  const scores = new Map<string, { score: number; observed: boolean; evidence: EvidenceRef[] }>();
  const add = (market: string | null, points: number, observed: boolean, ev: EvidenceRef) => {
    if (!market) return;
    const e = scores.get(market) || { score: 0, observed: false, evidence: [] };
    e.score += points; e.observed ||= observed;
    if (e.evidence.length < 8 && !e.evidence.some(x => x.detail === ev.detail)) e.evidence.push(ev);
    scores.set(market, e);
  };
  for (const p of pages) {
    const b = p.business;
    if (!b) continue;
    for (const a of b.addresses) add(countryName(a.country || "") || countryName(a.locality || ""), 10, true, { url: p.finalUrl, detail: "Structured-data address" + (a.locality ? " in " + a.locality : "") + (a.country ? ", " + a.country : "") });
    for (const area of b.areaServed) add(countryName(area), 8, true, { url: p.finalUrl, detail: "Structured data declares areaServed: " + area });
    for (const country of b.phoneCountries) if (!country.includes(" or ")) add(country, 4, false, { url: p.finalUrl, detail: "Telephone number uses the " + country + " dialling code" });
    for (const price of b.prices.slice(0, 3)) { const c = currencyCountry[price.currency]; if (c && c !== "Eurozone" && price.currency !== "USD") add(c, 2, false, { url: p.finalUrl, detail: "Prices quoted in " + price.currency }); }
    const headline = [p.title, ...p.h1].join(" ");
    for (const place of b.places) {
      if (place.kind === "region") continue;
      const inHeadline = new RegExp("\\b" + place.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(headline) || (place.country === "United Kingdom" && /\bUK\b/.test(headline));
      add(place.country, Math.min(place.count, 6) + (inHeadline ? 6 : 0), inHeadline, { url: p.finalUrl, detail: (place.kind === "city" ? place.name + " (" + place.country + ")" : place.name) + " mentioned " + place.count + "×" + (inHeadline ? ", including the title or H1" : "") });
    }
  }
  try { const tld = new URL(website).hostname.split(".").pop() || ""; if (tldCountry[tld]) add(tldCountry[tld], 4, false, { url: website, detail: "Country-code domain ." + tld }); } catch { /* ignore */ }
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const top = ranked[0]?.[1].score || 0;
  return ranked.filter(([, v], i) => i === 0 || v.score >= Math.max(6, top * 0.25)).slice(0, 4).map(([market, v]) =>
    rec("market", market, v.observed ? "observed" : "inferred", v.score >= 14 ? "high" : v.score >= 7 ? "medium" : "low", v.evidence, v.observed ? undefined : "Inferred from contact, currency and place signals; confirm with the client."));
}

/** Buyer roles: who uses the offer, who pays, who influences the decision and who employs the end user. */
const roleRules: [RegExp, string][] = [
  [/\b(employers?|hospitals?|clinics?|laborator(y|ies)|labs?|nhs|trusts?|manufacturers?|retailers?|recruiters?)\b/, "Employer"],
  [/\b(businesses|companies|organi[sz]ations|enterprises|startups|smes|agencies|brands|charities|owners|founders|executives|leaders|managers|investors|councils|distributors|suppliers|contractors|landlords)\b/, "Purchaser"],
  [/\b(universities|colleges?|schools?|teachers?|consultants?|advisers?|advisors?|partners?)\b/, "Influencer"],
  [/\b(students?|graduates?|undergraduates?|learners?|trainees?|apprentices?|candidates?|job ?seekers?|jobseekers|migrants|immigrants|professionals?|practitioners?|clinicians?|doctors?|nurses?|midwives|scientists?|technicians?|researchers?|engineers?|developers?|designers?|marketers?|accountants?|lawyers?|pharmacists?|dentists?|patients?|carers?|parents?|children|teenagers|families|homeowners|tenants|buyers|travell?ers|tourists|athletes|women|seniors|veterans|freelancers)\b/, "End user"],
];
const roleOf = (phrase: string) => roleRules.find(([re]) => re.test(phrase))?.[1] || "End user";

/** Consolidate audience mentions into meaningful buyer segments: specific phrases first, synonyms merged, role stated. */
export function segmentRecs(pages: PageRecord[]): Rec[] {
  const agg = new Map<string, { count: number; urls: Set<string>; excerpt?: { url: string; text: string; at: string } }>();
  for (const p of pages) for (const a of p.business?.audiences || []) {
    const phrase = normaliseAudience(a.phrase);
    const e = agg.get(phrase) || { count: 0, urls: new Set<string>() };
    // A bare noun is also counted alongside each qualified phrase at extraction; avoid inflating it here.
    if (phrase !== a.phrase && !phrase.includes(" ")) continue;
    e.count += a.count; e.urls.add(p.finalUrl);
    if (!e.excerpt && a.excerpt) e.excerpt = { url: p.finalUrl, text: a.excerpt, at: p.fetchedAt };
    agg.set(phrase, e);
  }
  const byRole = new Map<string, [string, { count: number; urls: Set<string>; excerpt?: { url: string; text: string; at: string } }][]>();
  for (const entry of agg) { const role = roleOf(entry[0]); byRole.set(role, [...(byRole.get(role) || []), entry]); }
  const out: Rec[] = [];
  for (const [role, entries] of [...byRole.entries()].sort((a, b) => b[1].reduce((s, e) => s + e[1].count, 0) - a[1].reduce((s, e) => s + e[1].count, 0))) {
    const total = entries.reduce((s, e) => s + e[1].count, 0);
    if (total < 2) continue;
    const specific = entries.filter(([p, v]) => p.includes(" ") && v.count >= 2).sort((a, b) => b[1].count - a[1].count);
    // Specific phrases absorb the bare nouns they extend ("biomedical science graduates" absorbs "graduates").
    const picks: typeof entries = [];
    for (const e of specific) if (picks.length < 2 && !picks.some(([p]) => p.endsWith(e[0]) || e[0].endsWith(p))) picks.push(e);
    const bare = entries.filter(([p]) => !p.includes(" ")).sort((a, b) => b[1].count - a[1].count);
    // Each bare noun is merged into one segment only, so mentions are never counted twice.
    const used = new Set<string>();
    const groups: { name: string; members: typeof entries }[] = picks.map(e => { const members = entries.filter(([p]) => !used.has(p) && (p === e[0] || e[0].endsWith(" " + p))); members.forEach(([p]) => used.add(p)); return { name: e[0], members }; });
    if (!picks.length && bare.length) {
      const names = bare.slice(0, 3).map(([p]) => p);
      groups.push({ name: names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0], members: bare });
    }
    for (const g of groups) {
      const count = g.members.reduce((s, e) => s + e[1].count, 0);
      const urls = new Set(g.members.flatMap(([, v]) => [...v.urls]));
      const excerpts = g.members.map(([, v]) => v.excerpt).filter((x): x is { url: string; text: string; at: string } => !!x).slice(0, 3);
      const display = g.name.replace(/\b(nhs|uk|eu|smes|hr|b2b|b2c|saas)\b/g, w => w === "smes" ? "SMEs" : w === "saas" ? "SaaS" : w.toUpperCase());
      out.push({ ...rec("segment", display.charAt(0).toUpperCase() + display.slice(1), "inferred", urls.size >= 3 && count >= 6 ? "high" : count >= 3 ? "medium" : "low",
        excerpts.length ? excerpts.map(x => ({ url: x.url, detail: "Audience mention", excerpt: x.text, at: x.at, method: "Audience noun in a sentence" })) : [...urls].slice(0, 3).map(url => ({ url, detail: "Audience mention", method: "Audience noun in a sentence" })),
        role + " · " + count + " mentions across " + urls.size + " page" + (urls.size === 1 ? "" : "s") + (g.members.length > 1 ? "; merges " + g.members.map(([p, v]) => p + " (" + v.count + ")").slice(0, 5).join(", ") : "") + "."), tag: role });
      if (out.length >= 6) break;
    }
    if (out.length >= 6) break;
  }
  return out;
}

type Offering = { name: string; score: number; evidence: EvidenceRef[]; basis: Basis };
export function offeringRecs(pages: PageRecord[], site: Discovery | null, brand: string): Rec[] {
  const list: Offering[] = [];
  const brandTokens = new Set(tokens(brand));
  const clean = (raw: string) => {
    let name = raw.replace(/\s+/g, " ").replace(/[|•·].*$/, "").trim();
    if (/^\/|^https?:\/\//.test(name)) name = humaniseSlug(name.startsWith("/") ? "https://x.invalid" + name : name) || "";
    for (const t of brandTokens) name = name.replace(new RegExp("\\b" + t + "\\b", "ig"), "").trim();
    name = name.replace(/^[-–—:,\s]+|[-–—:,.\s]+$/g, "").replace(/^(our|the|all)\s+/i, "");
    if (name.length < 3 || name.length > 80 || generic.has(name.toLowerCase()) || /^(other|all|more|our|view|see|browse)\b/i.test(name) || !tokens(name).length || /^\d+$/.test(name)) return null;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const add = (raw: string, points: number, ev: EvidenceRef, basis: Basis = "observed") => {
    const name = clean(raw);
    if (!name) return;
    const existing = list.find(o => same(o.name, name));
    if (existing) { existing.score += points; if (existing.evidence.length < 6 && !existing.evidence.some(e => e.url === ev.url && e.detail === ev.detail)) existing.evidence.push(ev); return; }
    list.push({ name, score: points, evidence: [ev], basis });
  };
  const offeringPages = pages.filter(p => ["service", "course", "product", "category"].includes(p.pageType) || offeringPath.test(new URL(p.finalUrl).pathname));
  for (const p of pages) for (const e of p.business?.entities || []) if (e.type !== "Offer" && e.type !== "HowTo" && e.type !== "JobPosting") add(e.name, e.type === "ListItem" ? 2 : 4, { url: p.finalUrl, detail: e.type + " in structured data", excerpt: e.name, method: "Structured data (" + e.type + ")", at: p.fetchedAt });
  for (const p of offeringPages) if (p.h1[0]) add(p.h1[0], 3, { url: p.finalUrl, detail: "H1 of a " + p.pageType + " page", excerpt: p.h1[0], method: "Page heading (H1)", at: p.fetchedAt });
  const home = pages.find(p => p.pageType === "home") || pages[0];
  for (const n of home?.business?.nav || []) { try { const path = new URL(n.url).pathname; if (offeringPath.test(path) && path.split("/").filter(Boolean).length >= 2) add(n.text, 2, { url: n.url, detail: "Navigation item “" + n.text + "”", excerpt: n.text, method: "Main navigation", at: home.fetchedAt }); } catch { /* ignore */ } }
  for (const s of (site?.sitemapUrls || []).slice(0, 400)) { try { const path = new URL(s.loc).pathname; if (offeringPath.test(path) && path.split("/").filter(Boolean).length >= 2) { const name = humaniseSlug(s.loc); if (name) add(name, 1, { url: s.loc, detail: "Offering URL in the XML sitemap", excerpt: path, method: "XML sitemap URL" }); } } catch { /* ignore */ } }
  // Thin or JavaScript-rendered pages: fall back to what the title states the product is.
  if (!list.length && home?.title) for (const part of home.title.split(/\s[|–—:-]\s/)) add(part, 2, { url: home.finalUrl, detail: "Home page title" });
  // Service family (head noun) and delivery mode stated on the evidence pages.
  const corpusBy = new Map(pages.map(p => [p.finalUrl, [p.title, p.description, ...p.h1, ...p.headings.map(h => h.text), p.content.excerpt].join(" ").toLowerCase()]));
  const tagFor = (o: Offering) => {
    const text = o.evidence.map(e => corpusBy.get(e.url) || "").join(" ");
    const modes = [/\b(online|virtual|remote|e-learning|self-paced|webinars?|live classes)\b/.test(text) && "online", /\b(in-person|in person|on-site|onsite|classroom|hands-on|face-to-face|laboratory-based|in our (lab|laboratory|studio|clinic|centre|center))\b/.test(text) && "in person", /\b(blended|hybrid)\b/.test(text) && "blended"].filter(Boolean);
    const head = tokens(o.name).slice(-1)[0];
    const family = head && /^(training|course|courses|programme|programmes|program|programs|services?|consulting|consultancy|advisory|software|treatments?|therapy|insurance|tours?|classes|workshops?|development)$/.test(head) ? head.charAt(0).toUpperCase() + head.slice(1) : "";
    return [family, modes.length ? "Delivery: " + modes.join(", ") : ""].filter(Boolean).join(" · ") || undefined;
  };
  return list.sort((a, b) => b.score - a.score).slice(0, 14).map((o, i) => ({ ...rec("offering", o.name, o.basis, o.score >= 6 ? "high" : o.score >= 3 ? "medium" : "low", o.evidence, undefined, i < 8), tag: tagFor(o) }));
}

export function businessModel(pages: PageRecord[], segments: Rec[]): Rec {
  const ctas = pages.flatMap(p => (p.business?.ctas || []).map(c => ({ ...c, page: p.finalUrl })));
  const count = (kind: string) => ctas.filter(c => c.kind === kind).length;
  const products = pages.reduce((s, p) => s + (p.business?.entities.filter(e => /^Product/.test(e.type)).length || 0), 0);
  const courses = pages.filter(p => p.pageType === "course").length + pages.reduce((s, p) => s + (p.business?.entities.filter(e => /^(Course|EducationalOccupationalProgram)$/.test(e.type)).length || 0), 0);
  const services = pages.filter(p => p.pageType === "service").length;
  const articles = pages.filter(p => p.pageType === "article").length;
  const subscription = pages.some(p => p.business?.subscription);
  const segs = segments.map(s => s.value.toLowerCase()).join(" ");
  const b2b = /business|compan|organisation|organization|employer|enterprise|startup|sme|retailer|brand|agenc|hospital|clinic|laborator|school|universit|council|manufactur/.test(segs);
  const b2c = /student|graduate|learner|parent|famil|homeowner|traveller|traveler|women|patient|job seeker|jobseeker|athlete|tenant|buyer/.test(segs);
  const audience = b2b && b2c ? "B2B and B2C" : b2b ? "B2B" : b2c ? "B2C" : "audience not determined";
  const evidence = (kinds: string[]) => ctas.filter(c => kinds.includes(c.kind)).slice(0, 5).map(c => ({ url: c.page, detail: "Call to action “" + c.text + "”" }));
  let value = "", ev: EvidenceRef[] = [];
  const productPages = pages.filter(p => p.pageType === "product" || p.pageType === "category");
  const store = pages.find(p => p.schema.types.some(t => /^(Store|OnlineStore|ClothingStore|SportingGoodsStore|ElectronicsStore|HomeGoodsStore)$/.test(t)));
  if (count("buy") >= 2 || products >= 3 || (store && (products >= 1 || productPages.length >= 2)) || productPages.length >= 4) {
    value = "Online retail (ecommerce) · " + audience;
    ev = [...evidence(["buy"]), ...(store ? [{ url: store.finalUrl, detail: "Declares " + store.schema.types.find(t => /Store/.test(t)) + " in structured data" }] : []), ...(products ? [{ url: pages.find(p => p.business?.entities.some(e => /^Product/.test(e.type)))!.finalUrl, detail: products + " Product entities in structured data" }] : []), ...productPages.slice(0, 2).map(p => ({ url: p.finalUrl, detail: p.pageType + " page" }))];
  }
  else if (courses >= 2 && (count("enrol") || count("contact") || count("book"))) { value = "Course and training provider (enrolment and application led) · " + audience; ev = [...evidence(["enrol", "book", "contact"]), { url: pages[0].finalUrl, detail: courses + " course pages or Course entities" }]; }
  else if (subscription || count("demo")) { value = "Subscription or software (trial and demo led) · " + audience; ev = evidence(["demo", "subscribe"]); }
  else if (count("donate")) { value = "Non-profit (donation led)"; ev = evidence(["donate"]); }
  else if (services >= 1 || count("quote") || count("book") || count("contact")) { value = "Service provider (enquiry and lead-generation led) · " + audience; ev = evidence(["quote", "book", "contact", "call"]); }
  else if (articles >= pages.length * 0.6) { value = "Publisher (content and audience led)"; ev = [{ url: pages[0].finalUrl, detail: articles + " of " + pages.length + " sampled pages are articles" }]; }
  else { value = "Not determined from the sampled pages"; }
  return rec("model", value, "inferred", ev.length >= 3 ? "medium" : "low", ev, "Inferred from calls to action, page types and structured data; confirm with the client.");
}

export type AiProfile = {
  brand: string; aliases: string[]; industry: string; subsectors: string[];
  offerings: { name: string; evidence: string[] }[];
  segments: { name: string; evidence: string[]; basis: string }[];
  markets: { name: string; evidence: string[]; basis: string }[];
  businessModel: { value: string; evidence: string[] };
  valueProposition: { value: string; evidence: string[] };
  differentiators: { value: string; evidence: string[] }[];
  objectives: { value: string; rationale: string }[];
  industryTerms: string[];
  prompts: { prompt: string; category: string; rationale: string }[];
};

/** Deterministic profile from crawled pages. */
export function buildProfile(pages: PageRecord[], site: Discovery | null, website: string): BusinessProfile {
  const home = pages.find(p => p.pageType === "home") || pages[0];
  const host = (() => { try { return new URL(website).hostname.replace(/^www\./, ""); } catch { return website; } })();
  const label = host.split(".")[0];
  // Brand: structured-data name first, then og:site_name, then the title segment repeated across pages.
  const names = pages.flatMap(p => (p.business?.names || []).map(n => ({ ...n, url: p.finalUrl })));
  const bySource = (re: RegExp) => names.find(n => re.test(n.source));
  const segmentCounts = new Map<string, number>();
  for (const n of names.filter(n => n.source === "Page title segment")) segmentCounts.set(n.value, (segmentCounts.get(n.value) || 0) + 1);
  const repeated = [...segmentCounts.entries()].filter(([, c]) => c >= Math.max(2, pages.length * 0.4)).sort((a, b) => b[1] - a[1])[0];
  // Score each candidate: the site's own name usually matches the domain and og:site_name; structured data can
  // also describe affiliations (a university, an employer), which must not become the brand.
  const compact = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  const domainKey = compact(label);
  const candidates = [...names, ...(repeated ? [{ value: repeated[0], source: "Title segment on " + repeated[1] + " pages", url: home?.finalUrl || website }] : [])];
  const score = (n: { value: string; source: string }) => {
    const c = compact(n.value);
    let v = 0;
    if (domainKey.length >= 3 && c.length >= 3 && (c === domainKey || c.includes(domainKey) || domainKey.includes(c))) v += 6;
    if (/og:site_name/.test(n.source)) v += 3;
    if (/^Structured data name/.test(n.source)) v += /CollegeOrUniversity|School/.test(n.source) ? 1 : 3;
    if (/^Title segment on/.test(n.source)) v += 2;
    if (/application-name/.test(n.source)) v += 1;
    return v;
  };
  const chosen = candidates.filter(n => !generic.has(n.value.toLowerCase()) && n.value.length <= 60).sort((a, b) => score(b) - score(a))[0] || null;
  const brandValue = chosen?.value || label.charAt(0).toUpperCase() + label.slice(1);
  const corroborating = names.filter(n => n !== chosen && n.value.toLowerCase() === brandValue.toLowerCase()).map(n => n.source);
  const brand = rec("brand", brandValue, chosen ? "observed" : "inferred", chosen ? "high" : "low", chosen ? [{ url: chosen.url, detail: chosen.source, excerpt: chosen.value, method: chosen.source, at: pages.find(p => p.finalUrl === chosen.url)?.fetchedAt }, ...(domainKey && compact(brandValue).includes(domainKey) ? [{ url: website, detail: "Matches the domain name", method: "Domain comparison" }] : [])] : [{ url: website, detail: "Derived from the domain name", method: "Domain name" }], corroborating.length ? "Also declared in: " + [...new Set(corroborating)].slice(0, 3).join(", ") + "." : undefined);
  const aliasValues = new Map<string, EvidenceRef>();
  // Aliases are declared names only (alternateName, legalName, og:site_name, application name) and the domain;
  // page headings, navigation labels and title segments are never accepted as names.
  for (const n of names) if (n.value.toLowerCase() !== brandValue.toLowerCase() && !generic.has(n.value.toLowerCase()) && n.value.length <= 50 && !n.value.includes(",") && !/^(about|contact|home|welcome|blog|news|our|the|meet|join|why)\b/i.test(n.value) && /alternateName|legalName|og:site_name|application-name/.test(n.source)) aliasValues.set(n.value, { url: n.url, detail: n.source, excerpt: n.value, method: n.source, at: pages.find(p => p.finalUrl === n.url)?.fetchedAt });
  const ipHost = /^[\d.:]+$/.test(host.split(":")[0]);
  if (!ipHost && label && label !== brandValue.toLowerCase().replace(/\s/g, "")) aliasValues.set(label, { url: website, detail: "Domain label", method: "Domain name" });
  if (!ipHost) aliasValues.set(host, { url: website, detail: "Website domain", method: "Domain name" });
  const aliases = [...aliasValues.entries()].slice(0, 6).map(([v, e]) => rec("alias", v, "observed", "medium", [e]));

  const scored = industryScores(pages);
  const top = scored[0];
  const second = scored[1];
  const industryEvidence = (s: typeof top) => [...s.hits.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([cue, h]) => ({ url: [...h.urls][0], detail: "“" + cue + "” appears " + h.count + "× across " + h.urls.size + " page" + (h.urls.size === 1 ? "" : "s") }));
  const alternatives = scored.slice(1, 3).filter(x => x.score >= 8).map(x => x.def.label + " (" + x.score + ")").join(", ");
  const industry = top && top.score >= 8
    ? rec("industry", top.def.label, top.schemaPages.length ? "observed" : "inferred", top.schemaPages.length && top.score >= (second?.score || 0) * 1.6 ? "high" : top.score >= (second?.score || 0) * 1.25 ? "medium" : "low", [...(top.schemaPages.length ? [{ url: top.schemaPages[0], detail: "Structured data type matches " + top.def.label }] : []), ...industryEvidence(top)], (top.schemaPages.length ? "Declared in structured data and supported by site vocabulary (score " + top.score + ")." : "Inferred from site vocabulary (score " + top.score + ").") + (alternatives ? " Alternatives considered: " + alternatives + "." : ""))
    : rec("industry", "Not determined", "inferred", "low", [], "Too few industry signals in the sampled pages.");
  const subsectors: Rec[] = [];
  for (const s of [top, second].filter(Boolean)) {
    if (s !== top && s.score < top.score * 0.5) continue;
    for (const sub of s.subsectors.slice(0, 2)) if (!subsectors.some(x => x.value === sub.sub.label)) subsectors.push(rec("subsector", sub.sub.label, "inferred", sub.hits.size >= 4 ? "high" : "medium", [...sub.hits.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 4).map(([cue, h]) => ({ url: [...h.urls][0], detail: "“" + cue + "” " + h.count + "×" }))));
  }
  const segments = segmentRecs(pages);
  const heroPage = home;
  const hero = heroPage?.business?.hero;
  const vpText = [hero?.heading, hero?.text || heroPage?.description].filter(Boolean).join(" — ").slice(0, 280);
  const valueProposition = vpText ? rec("vp", vpText, "observed", "high", [{ url: heroPage!.finalUrl, detail: "Home page headline and introduction" }]) : rec("vp", "Not stated on the sampled pages", "inferred", "low", []);
  const claims: { claim: string; url: string }[] = [];
  for (const p of [home, ...pages.filter(p => p !== home)]) for (const c of p?.business?.claims || []) if (claims.length < 8 && !claims.some(x => jaccard(x.claim, c) > 0.6)) claims.push({ claim: c, url: p!.finalUrl });
  const differentiators = claims.map((c, i) => rec("diff", c.claim, "observed", "medium", [{ url: c.url, detail: "Claim stated on the page", excerpt: c.claim, method: "Claim wording on the page", at: pages.find(p => p.finalUrl === c.url)?.fetchedAt }], "Stated by the organisation; not independently verified.", i < 5));
  const model = businessModel(pages, segments);
  const offerings = offeringRecs(pages, site, brandValue);
  const markets = marketRecs(pages, website);
  return { brand, aliases, industry, subsectors, offerings, markets, segments, model, valueProposition, differentiators, objectives: objectiveRecs(model, offerings, segments, markets), industryTerms: [] };
}

export function objectiveRecs(model: Rec, offerings: Rec[], segments: Rec[], markets: Rec[]): Rec[] {
  const offering = offerings[0]?.value.toLowerCase() || "core services";
  const segment = segments[0]?.value.toLowerCase();
  const market = markets[0]?.value;
  const where = market ? " in " + marketPhrase(market) : "";
  const m = model.value;
  const list: string[] = [];
  if (/ecommerce/i.test(m)) list.push("Grow online sales of " + offering + where);
  else if (/Course/i.test(m)) list.push("Increase enrolments for " + offering + (segment ? " among " + segment : "") + where);
  else if (/Subscription/i.test(m)) list.push("Increase trial sign-ups and demo requests" + where);
  else if (/Non-profit/i.test(m)) list.push("Grow donations and supporter sign-ups" + where);
  else if (/Publisher/i.test(m)) list.push("Grow returning readership and subscriptions");
  else list.push("Increase qualified enquiries for " + offering + where);
  list.push("Improve organic search visibility for " + offering + " searches" + where);
  list.push("Be recommended and cited in AI answers about " + offering + where);
  return list.map((v, i) => rec("objective", v, "inferred", "low", model.evidence.slice(0, 2), "Inferred from the business model; confirm the commercial target with the client.", i < 3));
}

/** Compact, bounded evidence for the AI interpretation call. */
export function evidencePack(pages: PageRecord[], site: Discovery | null, website: string) {
  return {
    website,
    sitemapPaths: [...new Set((site?.sitemapUrls || []).map(s => { try { return new URL(s.loc).pathname; } catch { return ""; } }).filter(Boolean))].slice(0, 60),
    pages: pages.slice(0, 14).map(p => ({
      url: p.finalUrl, type: p.pageType, title: (p.title || "").slice(0, 160), description: (p.description || "").slice(0, 240), h1: p.h1.slice(0, 2).map(h => h.slice(0, 140)),
      headings: p.headings.filter(h => h.level <= 3).slice(0, 10).map(h => h.text.slice(0, 100)), nav: (p.business?.nav || []).slice(0, 25).map(n => n.text),
      entities: (p.business?.entities || []).slice(0, 12).map(e => e.type + ": " + e.name), claims: (p.business?.claims || []).slice(0, 5), audiences: (p.business?.audiences || []).slice(0, 6).map(a => a.phrase + " (" + a.count + ")"),
      places: (p.business?.places || []).slice(0, 6).map(x => x.name + " (" + x.count + ")"), prices: (p.business?.prices || []).slice(0, 4).map(x => x.currency + " " + x.amount), ctas: (p.business?.ctas || []).slice(0, 6).map(c => c.text),
      excerpt: p.content.excerpt.slice(0, 300), names: (p.business?.names || []).slice(0, 4).map(n => n.value),
    })),
  };
}

/** Merge an AI interpretation only where it is grounded in pages VisTa fetched. */
export function mergeAiProfile(profile: BusinessProfile, ai: AiProfile, pages: PageRecord[]): BusinessProfile {
  const byUrl = new Map(pages.map(p => [p.finalUrl, pageCorpus(p)]));
  const all = [...byUrl.values()].join(" \n ");
  const ground = (value: string, urls: string[]) => {
    const valid = urls.filter(u => byUrl.has(u)).slice(0, 5);
    const toks = tokens(value).filter(t => t.length > 2);
    const text = valid.length ? valid.map(u => byUrl.get(u)!).join(" ") : all;
    const share = toks.length ? toks.filter(t => text.includes(t)).length / toks.length : 0;
    return { valid, share };
  };
  /** minShare: the share of the item's words that must appear on the cited pages (offerings and claims must be stated there). */
  const modelRec = (prefix: string, value: string, urls: string[], basisHint?: string, minShare = 0.34): Rec | null => {
    const v = value.replace(/\s+/g, " ").trim().slice(0, 200);
    if (!v) return null;
    const g = ground(v, urls);
    if (!g.valid.length || g.share < minShare) return null;
    const stated = basisHint === "stated" && g.share >= 0.6;
    return rec(prefix, v, "model", g.share >= 0.6 ? "medium" : "low", g.valid.map(url => ({ url, detail: stated ? "Stated on this page (AI-extracted)" : "AI interpretation of this page" })), g.share >= 0.6 ? undefined : "Interpretation; the wording is not stated directly on the cited pages.", false);
  };
  const mergeList = (base: Rec[], extra: (Rec | null)[], max: number, selectNew: boolean) => {
    const out = [...base];
    for (const r of extra) if (r && !out.some(x => same(x.value, r.value)) && out.length < max) out.push({ ...r, selected: selectNew && r.confidence !== "low" });
    return out;
  };
  // AI-suggested aliases must use the brand, appear on the site, and must not be a heading, navigation label or title segment.
  const labels = new Set(pages.flatMap(p => [...p.h1, ...p.headings.map(h => h.text), ...(p.business?.nav.map(n => n.text) || []), ...(p.title || "").split(/\s[|–—:-]\s/)]).map(t => t.trim().toLowerCase()));
  const brandKey = profile.brand.value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = mergeList(profile.aliases, ai.aliases.filter(a => a && all.includes(a.toLowerCase()) && !labels.has(a.trim().toLowerCase()) && a.toLowerCase().replace(/[^a-z0-9]/g, "").includes(brandKey) && !/^(about|contact|home|welcome|blog|news|our|the|meet|join|why)\b/i.test(a)).map(a => rec("alias", a.slice(0, 60), "model", "medium", [{ url: pages[0].finalUrl, detail: "Brand usage on the website (AI-identified)", excerpt: a, method: "AI interpretation checked against page text" }])), 8, true);
  const subsectors = mergeList(profile.subsectors, [ai.industry, ...ai.subsectors].map(s => { const g = ground(s, pages.map(p => p.finalUrl)); return g.share >= 0.5 ? rec("subsector", s.slice(0, 80), "model", "medium", [{ url: pages[0].finalUrl, detail: "AI classification grounded in site vocabulary" }]) : null; }), 5, true);
  const strong = profile.offerings.filter(o => o.confidence === "high"), weak = profile.offerings.filter(o => o.confidence !== "high");
  const mergedOfferings = mergeList(strong, ai.offerings.filter(o => !generic.has(o.name.toLowerCase().trim()) && !/^(other|all|more)\b/i.test(o.name.trim())).map(o => modelRec("offering", o.name, o.evidence, undefined, 0.5)), 16, true);
  const offeringsAll = mergeList(mergedOfferings, weak, 16, false);
  const offerings = offeringsAll.map((o, i) => ({ ...o, selected: i < 8 && o.confidence !== "low" }));
  const segments = mergeList(profile.segments, ai.segments.map(s => modelRec("segment", s.name, s.evidence, s.basis)), 8, true);
  const markets = mergeList(profile.markets, ai.markets.map(m => { const name = countryName(m.name.replace(/\s*\(.*\)$/, "")); return name ? modelRec("market", name, m.evidence, m.basis, 0) : null; }), 6, false);
  const differentiators = mergeList(profile.differentiators, ai.differentiators.map(d => modelRec("diff", d.value, d.evidence, undefined, 0.5)), 10, false);
  const vp = modelRec("vp", ai.valueProposition.value, ai.valueProposition.evidence, undefined, 0.5);
  const modelGround = modelRec("model", ai.businessModel.value, ai.businessModel.evidence);
  const objectives = mergeList(profile.objectives, ai.objectives.map(o => { const v = o.value.replace(/\s+/g, " ").trim().slice(0, 160); return v ? rec("objective", v, "model", "low", profile.model.evidence.slice(0, 1), "AI-suggested objective: " + o.rationale.slice(0, 200), false) : null; }), 7, false);
  return {
    ...profile, aliases, subsectors, offerings, segments, markets, differentiators, objectives,
    valueProposition: vp && vp.confidence !== "low" ? { ...vp, selected: true, note: "Summary of the stated proposition: " + profile.valueProposition.value.slice(0, 160) } : profile.valueProposition,
    model: modelGround && profile.model.confidence === "low" ? { ...profile.model, note: (profile.model.note || "") + " AI interpretation: " + modelGround.value } : profile.model,
    industryTerms: ai.industryTerms.map(t => t.toLowerCase().trim()).filter(t => t.length >= 3 && t.length <= 60).slice(0, 30),
  };
}
