/**
 * Business signals extracted from one page: who the organisation is, what it sells, where and to
 * whom. Pure and bounded; every value is a direct observation from the HTML (structured data,
 * navigation, calls to action, prices, place names, audience nouns and claims). Interpretation
 * (industry, business model, markets) happens later in discovery and is labelled as inference.
 */
import type { CheerioAPI } from "cheerio";

export type CtaKind = "buy" | "enrol" | "book" | "quote" | "demo" | "contact" | "subscribe" | "download" | "donate" | "call";
export type BusinessSignals = {
  names: { value: string; source: string }[];
  description: string | null;
  entities: { type: string; name: string; description?: string; price?: string; currency?: string; areaServed?: string[] }[];
  nav: { text: string; url: string }[];
  footer: { text: string; url: string }[];
  ctas: { kind: CtaKind; text: string; url: string | null }[];
  prices: { currency: string; amount: string }[];
  subscription: boolean;
  places: { name: string; country: string; kind: "country" | "city" | "region"; count: number }[];
  addresses: { country?: string; region?: string; locality?: string }[];
  areaServed: string[];
  phoneCountries: string[];
  audiences: { phrase: string; count: number; excerpt?: string }[];
  claims: string[];
  hero: { heading: string | null; text: string | null };
};

const clean = (value: unknown, max = 200) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);
const nameOf = (value: unknown) => (typeof value === "string" ? clean(value) : value && typeof value === "object" ? clean((value as Record<string, unknown>).name) : "");

/** Canonical country → names that indicate it. Upper-case abbreviations are matched case-sensitively. */
export const countries: Record<string, string[]> = {
  "United Kingdom": ["United Kingdom", "UK", "U.K.", "Great Britain", "Britain", "British", "England", "Scotland", "Wales", "Northern Ireland"],
  "United States": ["United States", "USA", "U.S.", "U.S.A."], Ireland: ["Ireland", "Irish"], Canada: ["Canada", "Canadian"], Australia: ["Australia", "Australian"],
  "New Zealand": ["New Zealand"], Nigeria: ["Nigeria", "Nigerian"], Ghana: ["Ghana", "Ghanaian"], Kenya: ["Kenya", "Kenyan"], "South Africa": ["South Africa", "South African"],
  India: ["India", "Indian"], Pakistan: ["Pakistan"], Bangladesh: ["Bangladesh"], "Sri Lanka": ["Sri Lanka"], Nepal: ["Nepal"], Philippines: ["Philippines", "Filipino"],
  "United Arab Emirates": ["United Arab Emirates", "UAE"], "Saudi Arabia": ["Saudi Arabia", "KSA"], Qatar: ["Qatar"], Kuwait: ["Kuwait"], Oman: ["Oman"], Bahrain: ["Bahrain"],
  Germany: ["Germany", "German"], France: ["France", "French"], Spain: ["Spain", "Spanish"], Italy: ["Italy", "Italian"], Netherlands: ["Netherlands", "Dutch"], Belgium: ["Belgium"],
  Switzerland: ["Switzerland", "Swiss"], Sweden: ["Sweden", "Swedish"], Norway: ["Norway"], Denmark: ["Denmark"], Finland: ["Finland"], Poland: ["Poland", "Polish"], Portugal: ["Portugal"],
  Austria: ["Austria"], Greece: ["Greece"], Turkey: ["Turkey", "Türkiye"], Egypt: ["Egypt"], Morocco: ["Morocco"], Singapore: ["Singapore"], Malaysia: ["Malaysia"], Indonesia: ["Indonesia"],
  Japan: ["Japan"], China: ["China"], "Hong Kong": ["Hong Kong"], "South Korea": ["South Korea"], Brazil: ["Brazil"], Mexico: ["Mexico"], Jamaica: ["Jamaica"], Zimbabwe: ["Zimbabwe"],
  Zambia: ["Zambia"], Uganda: ["Uganda"], Tanzania: ["Tanzania"], Ethiopia: ["Ethiopia"], Rwanda: ["Rwanda"], Cameroon: ["Cameroon"], Israel: ["Israel"], Jordan: ["Jordan"],
  "Czech Republic": ["Czech Republic", "Czechia"], Romania: ["Romania"], Ukraine: ["Ukraine"], Luxembourg: ["Luxembourg"], Malta: ["Malta"], Cyprus: ["Cyprus"], Iceland: ["Iceland"],
};
export const cities: Record<string, string> = {
  London: "United Kingdom", Manchester: "United Kingdom", Birmingham: "United Kingdom", Leeds: "United Kingdom", Liverpool: "United Kingdom", Glasgow: "United Kingdom", Edinburgh: "United Kingdom",
  Bristol: "United Kingdom", Sheffield: "United Kingdom", Newcastle: "United Kingdom", Nottingham: "United Kingdom", Leicester: "United Kingdom", Cardiff: "United Kingdom", Belfast: "United Kingdom",
  Southampton: "United Kingdom", Brighton: "United Kingdom", Oxford: "United Kingdom", Cambridge: "United Kingdom", Reading: "United Kingdom", Coventry: "United Kingdom", Aberdeen: "United Kingdom",
  "Milton Keynes": "United Kingdom", Luton: "United Kingdom", Croydon: "United Kingdom",
  "New York": "United States", "Los Angeles": "United States", Chicago: "United States", "San Francisco": "United States", Boston: "United States", Seattle: "United States", Austin: "United States",
  Toronto: "Canada", Vancouver: "Canada", Montreal: "Canada", Sydney: "Australia", Melbourne: "Australia", Brisbane: "Australia", Auckland: "New Zealand", Dublin: "Ireland", Cork: "Ireland",
  Lagos: "Nigeria", Abuja: "Nigeria", "Port Harcourt": "Nigeria", Ibadan: "Nigeria", Accra: "Ghana", Kumasi: "Ghana", Nairobi: "Kenya", Johannesburg: "South Africa", "Cape Town": "South Africa",
  Dubai: "United Arab Emirates", "Abu Dhabi": "United Arab Emirates", Riyadh: "Saudi Arabia", Jeddah: "Saudi Arabia", Doha: "Qatar", Mumbai: "India", Delhi: "India", Bangalore: "India", Bengaluru: "India",
  Chennai: "India", Hyderabad: "India", Karachi: "Pakistan", Lahore: "Pakistan", Paris: "France", Berlin: "Germany", Munich: "Germany", Madrid: "Spain", Barcelona: "Spain", Amsterdam: "Netherlands",
  Rome: "Italy", Milan: "Italy", Zurich: "Switzerland", Stockholm: "Sweden", Lisbon: "Portugal", "Kuala Lumpur": "Malaysia", Manila: "Philippines", Tokyo: "Japan",
};
const regions = ["Europe", "European Union", "Africa", "West Africa", "East Africa", "Middle East", "GCC", "Asia", "Asia Pacific", "APAC", "EMEA", "North America", "Latin America", "Scandinavia"];
export const tldCountry: Record<string, string> = { uk: "United Kingdom", ie: "Ireland", ng: "Nigeria", gh: "Ghana", ke: "Kenya", za: "South Africa", in: "India", au: "Australia", nz: "New Zealand", ca: "Canada", de: "Germany", fr: "France", es: "Spain", it: "Italy", nl: "Netherlands", be: "Belgium", ch: "Switzerland", se: "Sweden", no: "Norway", dk: "Denmark", fi: "Finland", pl: "Poland", pt: "Portugal", at: "Austria", ae: "United Arab Emirates", sa: "Saudi Arabia", qa: "Qatar", sg: "Singapore", my: "Malaysia", ph: "Philippines", jp: "Japan", br: "Brazil", mx: "Mexico", pk: "Pakistan" };
export const phoneCountry: [string, string][] = [["+44", "United Kingdom"], ["+353", "Ireland"], ["+234", "Nigeria"], ["+233", "Ghana"], ["+254", "Kenya"], ["+27", "South Africa"], ["+91", "India"], ["+61", "Australia"], ["+64", "New Zealand"], ["+971", "United Arab Emirates"], ["+966", "Saudi Arabia"], ["+974", "Qatar"], ["+49", "Germany"], ["+33", "France"], ["+34", "Spain"], ["+39", "Italy"], ["+31", "Netherlands"], ["+65", "Singapore"], ["+92", "Pakistan"], ["+1", "United States or Canada"]];
export const currencyCountry: Record<string, string> = { GBP: "United Kingdom", NGN: "Nigeria", INR: "India", GHS: "Ghana", KES: "Kenya", AED: "United Arab Emirates", EUR: "Eurozone", USD: "United States" };

const audienceNouns = ["students", "graduates", "undergraduates", "learners", "trainees", "apprentices", "professionals", "practitioners", "clinicians", "doctors", "nurses", "midwives", "scientists", "technicians", "researchers", "laboratories", "hospitals", "clinics", "patients", "carers", "parents", "children", "teenagers", "families", "teachers", "schools", "universities", "colleges", "employers", "employees", "recruiters", "candidates", "job seekers", "jobseekers", "businesses", "companies", "organisations", "organizations", "enterprises", "startups", "smes", "retailers", "brands", "agencies", "consultants", "freelancers", "developers", "engineers", "designers", "marketers", "executives", "leaders", "managers", "founders", "investors", "homeowners", "landlords", "tenants", "buyers", "travellers", "travelers", "tourists", "athletes", "women", "seniors", "veterans", "charities", "councils", "manufacturers", "distributors", "suppliers", "pharmacists", "dentists", "lawyers", "accountants", "contractors", "owners", "migrants", "immigrants"];
const audiencePattern = new RegExp("\\b((?:[a-z][a-z-]{2,} ){0,2})(" + audienceNouns.join("|") + ")\\b", "g");
export const qualifiers = new Set("international overseas foreign domestic local regional national global uk british eu european african nigerian indian american biomedical biomedicine science sciences scientific medical clinical healthcare health nhs private public sector independent small medium large mid-size midsize growing established enterprise corporate commercial industrial retail technology tech digital software finance financial legal education educational school university postgraduate undergraduate graduate early career senior junior aspiring qualified experienced newly mature adult young first-time existing prospective potential part-time full-time career-changing career laboratory lab research hospital pharmaceutical engineering construction manufacturing creative marketing sales hr hospitality family-owned owner-managed high-net-worth b2b b2c ecommerce online saas start-up startup charity nonprofit not-for-profit government".split(" "));
const modifierStop = new Set("the and for with our your their all any more most many some these those who are can from into that this have has been will was were not only also such than then them they you get how new top best other each every shop shops filter filters sort view buy men mens women womens kids sale search menu faq faqs work experience parents carers teachers home account login".split(" "));

const ctaRules: [CtaKind, RegExp][] = [
  ["buy", /\b(add to (cart|basket|bag)|buy( now)?|shop now|checkout|order now)\b/i],
  ["enrol", /\b(enrol(l)?( now)?|register( now)?|apply( now| today)?|join (the|this|our) (course|programme|program)|book (a|your) (place|seat))\b/i],
  ["demo", /\b((request|book|get) a demo|free trial|start (your )?(free )?trial|try (it )?(for )?free)\b/i],
  ["quote", /\b((get|request) a (free )?quote|free quote)\b/i],
  ["book", /\b(book (a|an|your)? ?(consultation|appointment|call|meeting|session|viewing|visit)|schedule a (call|meeting))\b/i],
  ["contact", /\b(contact us|get in touch|enquire( now)?|make an enquiry|speak to (us|an? \w+)|talk to (us|an? \w+))\b/i],
  ["subscribe", /\b(subscribe|sign up|newsletter)\b/i],
  ["download", /\b(download|brochure|prospectus)\b/i],
  ["donate", /\b(donate|give now)\b/i],
];
const claimPattern = /\b(accredit(ed|ation)|certified|certification|award[- ]winning|awards?|years? of experience|\d{1,3}\+? years|trusted by|rated|guarantee(d)?|official|approved|regulated|registered with|member of|partner(ed|ship)? with|NHS|ISO ?\d{4,5}|UKAS|CPD|leading|specialist|expert(s|ise)?|hands-on|practical|placement|job[- ]ready|career support|money[- ]back|free (delivery|returns|shipping)|same[- ]day|next[- ]day|24\/7|bespoke)\b/i;
const pricePattern = /(£|€|\$|₦|₹|GH₵|KSh|AED|USD|GBP|EUR|NGN)\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d{1,2})?/g;
const currencyOf: Record<string, string> = { "£": "GBP", "€": "EUR", "$": "USD", "₦": "NGN", "₹": "INR", "GH₵": "GHS", KSh: "KES", AED: "AED", USD: "USD", GBP: "GBP", EUR: "EUR", NGN: "NGN" };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Count place names in visible text (word-bounded; abbreviations case-sensitive). */
export function placeMentions(text: string): BusinessSignals["places"] {
  const out = new Map<string, { name: string; country: string; kind: "country" | "city" | "region"; count: number }>();
  const count = (needle: string, caseSensitive: boolean) => (text.match(new RegExp("(^|[^\\p{L}])" + escape(needle) + "(?=$|[^\\p{L}])", caseSensitive ? "gu" : "giu")) || []).length;
  for (const [country, names] of Object.entries(countries)) {
    let n = 0;
    for (const name of names) n += count(name, /^[A-Z.]+$/.test(name) || name.length <= 4);
    if (n) out.set(country, { name: country, country, kind: "country", count: n });
  }
  for (const [city, country] of Object.entries(cities)) { const n = count(city, true); if (n) out.set(city, { name: city, country, kind: "city", count: n }); }
  for (const region of regions) { const n = count(region, true); if (n) out.set(region, { name: region, country: region, kind: "region", count: n }); }
  return [...out.values()].sort((a, b) => b.count - a.count).slice(0, 20);
}

/** Keep the audience noun and only the genuine qualifiers directly before it. */
export function normaliseAudience(phrase: string): string {
  const words = phrase.toLowerCase().split(" ").filter(Boolean);
  const noun = words.pop() || "";
  const kept: string[] = [];
  for (let i = words.length - 1; i >= 0 && kept.length < 2; i -= 1) { if (qualifiers.has(words[i])) kept.unshift(words[i]); else break; }
  return [...kept, noun].join(" ");
}

export function audiencePhrases(text: string): BusinessSignals["audiences"] {
  const counts = new Map<string, { count: number; excerpt?: string }>();
  const bump = (phrase: string, sentence: string) => { const e = counts.get(phrase) || { count: 0 }; e.count += 1; e.excerpt ||= sentence.slice(0, 220); counts.set(phrase, e); };
  for (const sentence of text.split(/(?<=[.!?])\s+|\s\.\s/)) {
    for (const m of sentence.toLowerCase().matchAll(audiencePattern)) {
      // Only genuine qualifiers ("international", "biomedical science", "public sector") form a segment name.
      const words = m[1].trim().split(" ").filter(w => w && !modifierStop.has(w) && !/^\d/.test(w));
      let modifiers: string[] = [];
      for (let i = words.length - 1; i >= 0 && modifiers.length < 2; i -= 1) { if (qualifiers.has(words[i])) modifiers.unshift(words[i]); else break; }
      bump([...modifiers.slice(-2), m[2]].join(" "), sentence.trim());
      if (modifiers.length) bump(m[2], sentence.trim());
    }
  }
  return [...counts.entries()].map(([phrase, v]) => ({ phrase, count: v.count, excerpt: v.excerpt })).sort((a, b) => b.count - a.count).slice(0, 16);
}

export function extractBusinessSignals($: CheerioAPI, base: URL, nodes: Record<string, unknown>[], mainText: string, headings: { level: number; text: string }[]): BusinessSignals {
  const typesOf = (n: Record<string, unknown>) => asList(n["@type"]).map(String);
  const names: BusinessSignals["names"] = [];
  const addName = (value: unknown, source: string) => { const v = clean(value, 120); if (v && v.length >= 2 && !names.some(n => n.value.toLowerCase() === v.toLowerCase())) names.push({ value: v, source }); };
  const org = nodes.find(n => typesOf(n).some(t => /(Organization|Corporation|LocalBusiness|EducationalOrganization|ProfessionalService|Store|OnlineStore|NGO|MedicalOrganization|LegalService|FinancialService|Restaurant|Hotel|School|CollegeOrUniversity|WebSite)$/.test(t)));
  for (const n of nodes.filter(n => typesOf(n).some(t => /(Organization|Corporation|LocalBusiness|ProfessionalService|Store|NGO|MedicalOrganization|LegalService|FinancialService|School|CollegeOrUniversity)$/.test(t)))) {
    addName(n.name, "Structured data name (" + typesOf(n)[0] + ")");
    for (const alt of asList(n.alternateName)) addName(alt, "Structured data alternateName");
    addName(n.legalName, "Structured data legalName");
  }
  addName($('meta[property="og:site_name"]').attr("content"), "og:site_name");
  addName($('meta[name="application-name" i]').attr("content"), "application-name meta tag");
  const title = clean($("title").first().text(), 200);
  for (const part of title.split(/\s[|–—:-]\s/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 40)) if (title.includes(" | ") || title.includes(" – ") || title.includes(" - ")) addName(part, "Page title segment");
  const description = clean(org?.description, 400) || null;

  const entities: BusinessSignals["entities"] = [];
  for (const n of nodes) {
    const type = typesOf(n).find(t => /^(Product|ProductGroup|Service|Course|EducationalOccupationalProgram|Event|SoftwareApplication|Offer|MedicalProcedure|MedicalTest|TouristTrip|Accommodation|HowTo|JobPosting)$/.test(t));
    const name = nameOf(n.name);
    if (!type || !name || entities.length >= 30 || entities.some(e => e.name === name && e.type === type)) continue;
    const offer = asList(n.offers)[0] as Record<string, unknown> | undefined;
    entities.push({ type, name, description: clean(n.description, 200) || undefined, price: offer && (typeof offer.price === "string" || typeof offer.price === "number") ? String(offer.price) : undefined, currency: offer && typeof offer.priceCurrency === "string" ? offer.priceCurrency : undefined, areaServed: asList(n.areaServed).map(nameOf).filter(Boolean).slice(0, 5) });
  }
  // ItemList entries often list courses, services or products on hub pages.
  for (const n of nodes.filter(n => typesOf(n).includes("ItemList"))) for (const item of asList(n.itemListElement).slice(0, 20)) {
    const record = item as Record<string, unknown>;
    const name = nameOf(record?.name) || nameOf(record?.item);
    if (name && entities.length < 30 && !entities.some(e => e.name === name)) entities.push({ type: "ListItem", name });
  }

  const linkList = (selector: string, max: number) => {
    const out: { text: string; url: string }[] = [];
    $(selector).find("a[href]").each((_, el) => {
      const text = clean($(el).text() || $(el).attr("aria-label"), 60);
      const href = $(el).attr("href") || "";
      if (!text || text.length < 2 || out.length >= max || /^(mailto|tel|javascript):/i.test(href) || href.startsWith("#")) return;
      try { const url = new URL(href, base); if (!out.some(o => o.text.toLowerCase() === text.toLowerCase())) out.push({ text, url: url.href }); } catch { /* ignore malformed */ }
    });
    return out;
  };
  const nav = linkList('nav, header, [role="navigation"]', 60);
  const footer = linkList("footer", 40);

  const ctas: BusinessSignals["ctas"] = [];
  $('a, button, input[type="submit"]').each((_, el) => {
    if (ctas.length >= 20) return;
    const node = $(el);
    const label = clean(node.text() || node.attr("value") || node.attr("aria-label"), 60);
    const href = node.attr("href") || "";
    if (/^tel:/i.test(href)) { if (!ctas.some(c => c.kind === "call")) ctas.push({ kind: "call", text: label || "Call", url: null }); return; }
    if (!label || label.length > 50) return;
    const rule = ctaRules.find(([, pattern]) => pattern.test(label));
    if (!rule || ctas.some(c => c.text.toLowerCase() === label.toLowerCase())) return;
    let url: string | null = null;
    try { url = href && !href.startsWith("#") && !/^(mailto|javascript):/i.test(href) ? new URL(href, base).href : null; } catch { url = null; }
    ctas.push({ kind: rule[0], text: label, url });
  });

  const prices: BusinessSignals["prices"] = [];
  for (const m of mainText.matchAll(pricePattern)) { if (prices.length >= 12) break; const currency = currencyOf[m[1]]; const amount = m[2].replace(/[\s,]/g, ""); if (currency && Number(amount) > 0 && !prices.some(p => p.currency === currency && p.amount === amount)) prices.push({ currency, amount }); }
  for (const e of entities) if (e.price && e.currency && prices.length < 12 && !prices.some(p => p.amount === e.price)) prices.push({ currency: e.currency, amount: e.price });

  const addresses: BusinessSignals["addresses"] = [];
  for (const n of nodes) for (const a of asList(n.address)) {
    const r = a as Record<string, unknown>;
    if (!r || typeof r !== "object" || addresses.length >= 5) continue;
    const country = nameOf(r.addressCountry);
    addresses.push({ country: country || undefined, region: clean(r.addressRegion, 60) || undefined, locality: clean(r.addressLocality, 60) || undefined });
  }
  const areaServed = [...new Set(nodes.flatMap(n => asList(n.areaServed).map(nameOf)).filter(Boolean))].slice(0, 10);
  const phones = new Set<string>();
  const phoneText = $('a[href^="tel:"]').map((_, el) => $(el).attr("href") || "").get().join(" ") + " " + nodes.map(n => clean(n.telephone, 40)).join(" ") + " " + mainText.slice(0, 50_000);
  for (const [code, country] of phoneCountry) if (new RegExp("(^|[^\\d])\\" + code + "[\\s(-]*\\d").test(phoneText)) phones.add(country);

  // Claims come from individual blocks (headings, paragraphs, list items) so adjacent elements are never glued together.
  const blocks: string[] = [];
  $("h1, h2, h3, p, li").each((_, el) => { if (blocks.length < 400 && !$(el).closest("nav, header, footer").length) blocks.push(clean($(el).text(), 600)); });
  const heroHeading = headings.find(h => h.level === 1)?.text || "";
  const sentences = blocks.flatMap(b => b.split(/(?<=[.!?])\s+/)).map(s => s.trim()).filter(s => s.length >= 20 && s.length <= 220 && s !== heroHeading);
  const claims: string[] = [];
  for (const s of sentences) { if (claims.length >= 10) break; if (claimPattern.test(s) && !claims.some(c => c.toLowerCase() === s.toLowerCase())) claims.push(s); }

  const heading = headings.find(h => h.level === 1)?.text || null;
  let heroText: string | null = null;
  const h1 = $("h1").first();
  if (h1.length) { const p = h1.nextAll("p").first().text() || h1.parent().find("p").first().text(); heroText = clean(p, 300) || null; }

  return {
    names: names.slice(0, 10), description, entities, nav, footer, ctas, prices,
    subscription: /\b(per month|\/ ?month|\/ ?mo\b|monthly plan|per user|billed annually)\b/i.test(mainText),
    places: placeMentions(mainText.slice(0, 120_000)), addresses, areaServed,
    phoneCountries: [...phones].slice(0, 5), audiences: audiencePhrases(blocks.filter(b => b.split(" ").length >= 6).join(" . ").slice(0, 120_000)), claims,
    hero: { heading, text: heroText },
  };
}
