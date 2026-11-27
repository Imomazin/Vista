/**
 * Locally served editorial photography with source and licence metadata.
 * Every binary is optimised by scripts/optimise-photography.ts from the original
 * Unsplash download and committed under public/web-images.
 */
export type PhotoArea =
  | "cinematic" | "command" | "search" | "impact" | "site" | "content" | "authority"
  | "reputation" | "agency" | "analytics" | "ai-exposure" | "benchmark" | "investigation"
  | "workspace" | "pricing" | "demo";

export type VistaEditorialAsset = {
  id: string;
  /** Optimised master served for enlarged and hero views. */
  path: string;
  /** Optimised thumbnail served for gallery cards. */
  thumb: string;
  title: string;
  /** Optional supporting sentence shown on cards where it adds value. */
  detail?: string;
  alt: string;
  section: PhotoArea;
  placement: "hero" | "gallery" | "editorial";
  photographer: string;
  sourceUrl: string;
  licence: string;
  width: number;
  height: number;
  objectPosition?: string;
  fallback?: string;
  fallbackAlt?: string;
  /** "premium" = the incremental collection; "studio" = existing studio leads now served locally. */
  collection: "premium" | "studio";
  /** Original image identifier on images.unsplash.com used by the optimisation script. */
  origin: string;
};

const UNSPLASH = "Unsplash License (free commercial use; served from images.unsplash.com, not Unsplash+)";

type Seed = Omit<VistaEditorialAsset, "path" | "thumb" | "licence" | "collection"> & { slug: string };
const premium = (s: Seed): VistaEditorialAsset => {
  const { slug, ...rest } = s;
  const base = "/web-images/premium/" + s.section + "/" + slug;
  return { ...rest, path: base + ".webp", thumb: base + "-thumb.webp", licence: UNSPLASH, collection: "premium" };
};
const studio = (s: Seed): VistaEditorialAsset => {
  const { slug, ...rest } = s;
  const base = "/web-images/editorial/studio/" + slug;
  return { ...rest, path: base + ".webp", thumb: base + "-thumb.webp", licence: UNSPLASH, collection: "studio" };
};

/** Incremental premium collection. Dimensions are those of the optimised master. */
export const premiumPhotography: VistaEditorialAsset[] = [
  premium({ id: "command-glass-conference-room", slug: "glass-conference-room", section: "command", placement: "editorial",
    title: "Align the room on what matters", detail: "Shared evidence for leadership conversations.",
    alt: "Three colleagues seated at a long conference table in a bright office with floor-to-ceiling windows and a wall screen",
    photographer: "Annie Spratt", sourceUrl: "https://unsplash.com/photos/3Lpe92E18G8", origin: "photo-1700241956155-6e3cae8a425d",
    width: 1600, height: 1079, objectPosition: "45% 55%" }),
  premium({ id: "search-google-laptop-phone", slug: "google-search-laptop-phone", section: "search", placement: "gallery",
    title: "Where every journey starts", detail: "Search demand across desktop and mobile.",
    alt: "Laptop open on the Google search page with a smartphone resting on its keyboard, on a wooden desk",
    photographer: "sarah b", sourceUrl: "https://unsplash.com/photos/DF0C0Lbs9qE", origin: "photo-1663090892982-56ba0bdc2319",
    width: 1200, height: 800 }),
  premium({ id: "content-cinema-camera-operator", slug: "cinema-camera-operator", section: "content", placement: "gallery",
    title: "Production with intent", detail: "Craft that carries the brief.",
    alt: "Camera operator framing a shot on a cinema camera rig with an external monitor",
    photographer: "Jose P. Ortiz", sourceUrl: "https://unsplash.com/photos/yvQnGDEDdjk", origin: "photo-1775559052522-2f7a4abbce8e",
    width: 1200, height: 1600, objectPosition: "50% 42%" }),
  premium({ id: "content-recording-desk-setup", slug: "recording-desk-setup", section: "content", placement: "gallery",
    title: "A studio on every desk", detail: "Recording kit ready for the next piece.",
    alt: "Mirrorless camera on a tripod beside a studio microphone and a tablet monitor, set up for recording by a window",
    photographer: "Detail .co", sourceUrl: "https://unsplash.com/photos/JrhuWchYQOQ", origin: "photo-1764664035133-0d2ca12016dd",
    width: 1200, height: 800 }),
  premium({ id: "authority-advisory-conversation", slug: "advisory-conversation", section: "authority", placement: "gallery",
    title: "Expertise people can hear", detail: "Credibility built in conversation.",
    alt: "Two colleagues talking at a desk with a laptop, one gesturing while explaining a point",
    photographer: "Headway", sourceUrl: "https://unsplash.com/photos/5QgIuuBxKwM", origin: "photo-1517245386807-bb43f82c33c4",
    width: 1200, height: 800, objectPosition: "40% 50%" }),
  premium({ id: "authority-team-review-table", slug: "team-review-table", section: "authority", placement: "hero",
    title: "Trust earned around the table", detail: "Relationships that make a brand credible.",
    alt: "Four colleagues gathered around a café table reviewing printed material together",
    photographer: "Andreea Avramescu", sourceUrl: "https://unsplash.com/photos/wR56AUlEsE4", origin: "photo-1630487656049-6db93a53a7e9",
    width: 1920, height: 1280 }),
  premium({ id: "reputation-street-interview", slug: "street-interview", section: "reputation", placement: "gallery",
    title: "On the record", detail: "What spokespeople say in public.",
    alt: "Woman in a cap speaking into a reporter's microphone during an outdoor interview",
    photographer: "saad ali", sourceUrl: "https://unsplash.com/photos/Ts8L9RUtUlI", origin: "photo-1778864874711-92e84bba3237",
    width: 1200, height: 2133, objectPosition: "50% 28%" }),
  premium({ id: "reputation-broadcast-camera", slug: "broadcast-camera-operator", section: "reputation", placement: "gallery",
    title: "Coverage as it happens", detail: "Broadcast crews shape first impressions.",
    alt: "Camera operator filming with a monitor-mounted camera rig in low light",
    photographer: "Rodrigo Rodrigues | WOLF Λ R T", sourceUrl: "https://unsplash.com/photos/_Zk0qLaMWkc", origin: "photo-1763259093035-09fce8e85879",
    width: 1200, height: 2133, objectPosition: "50% 42%" }),
  premium({ id: "agency-overhead-laptop-work", slug: "overhead-laptop-collaboration", section: "agency", placement: "gallery",
    title: "Delivery side by side", detail: "Client work moving across one table.",
    alt: "Overhead view of two people working on laptops across a white table",
    photographer: "Ben Spray", sourceUrl: "https://unsplash.com/photos/gEvMA8O6Et4", origin: "photo-1636647677481-f134fda3f408",
    width: 1200, height: 800 }),
  premium({ id: "analytics-bounce-rate-monitor", slug: "web-analytics-monitor", section: "analytics", placement: "gallery",
    title: "Behaviour in the numbers", detail: "Sessions, load time and bounce read together.",
    alt: "Monitor showing a web analytics dashboard with bounce-rate and session charts",
    photographer: "Luke Chesser", sourceUrl: "https://unsplash.com/photos/JKUTrJ4vK00", origin: "photo-1551288049-bebda4e38f71",
    width: 1200, height: 800 }),
  premium({ id: "ai-chatgpt-phone", slug: "assistant-prompt-phone", section: "ai-exposure", placement: "gallery",
    title: "Answers in the pocket", detail: "Where buyers now ask first.",
    alt: "Smartphone showing an AI assistant prompt screen beside a desktop computer in warm light",
    photographer: "Tim Witzdam", sourceUrl: "https://unsplash.com/photos/wq9YiAxN0sQ", origin: "photo-1746883741112-9fbcd2276cb1",
    width: 1200, height: 801 }),
  premium({ id: "ai-language-model-screen", slug: "language-model-screen", section: "ai-exposure", placement: "gallery",
    title: "Models that describe your brand", detail: "Generative systems shape discovery.",
    alt: "Laptop screen showing a green web page announcing a conversational language model",
    photographer: "Rolf van Root", sourceUrl: "https://unsplash.com/photos/oLthDWAG244", origin: "photo-1676272682018-b1435bad1cf0",
    width: 1200, height: 800 }),
  premium({ id: "ai-prompt-laptop", slug: "prompt-typing-laptop", section: "ai-exposure", placement: "gallery",
    title: "Every prompt is a query", detail: "Test what assistants say and cite.",
    alt: "Hands typing on a laptop showing an AI chat prompt on a dark interface",
    photographer: "Berke Citak", sourceUrl: "https://unsplash.com/photos/adrO5seSbBE", origin: "photo-1737641624486-7846df8528dc",
    width: 1200, height: 1800, objectPosition: "50% 62%" }),
  premium({ id: "pricing-boardroom-review", slug: "boardroom-document-review", section: "pricing", placement: "editorial",
    title: "Built for decision makers", detail: "Plans that scale with the organisation.",
    alt: "Four men in business attire reviewing documents together at a white table",
    photographer: "Sebastian Herrmann", sourceUrl: "https://unsplash.com/photos/O2o1hzDA7iE", origin: "photo-1551135049-8a33b5883817",
    width: 1600, height: 1067, objectPosition: "50% 30%" }),
];

/** Existing studio leads, previously hot-linked from images.unsplash.com and now served locally. */
export const studioLeads = {
  search: studio({ id: "studio-search-laptop-cafe", slug: "search-laptop-cafe", section: "search", placement: "hero",
    title: "Understanding how people search", alt: "Person typing a Google search on a laptop at a wooden café table beside a cup of coffee",
    photographer: "Firmbee.com", sourceUrl: "https://unsplash.com/photos/person-using-black-laptop-computer-eMemmpUojlw", origin: "photo-1616499370260-485b3e5ed653",
    width: 1920, height: 1280, fallback: "/web-images/search/search-engine-touchscreen.jpg", fallbackAlt: "Finger touching a tablet showing the Google search page" }),
  impact: studio({ id: "studio-impact-team-review", slug: "impact-team-review", section: "impact", placement: "hero",
    title: "Connecting evidence to business outcomes", alt: "Four colleagues standing at a desk in a creative office reviewing printed documents together",
    photographer: "Vitaly Gariev", sourceUrl: "https://unsplash.com/photos/diverse-team-collaborating-on-a-project-in-an-office-PSksbOVDhWk", origin: "photo-1758873269811-4e62e346b4b7",
    width: 1920, height: 1080, fallback: "/web-images/impact/holographic-growth-dashboard.jpg", fallbackAlt: "Hands using a tablet beneath a holographic growth chart" }),
  site: studio({ id: "studio-site-code-laptop", slug: "site-code-laptop", section: "site", placement: "hero",
    title: "Investigating technical performance", alt: "Laptop screen showing source code, a gauge and performance charts in a development tool",
    photographer: "Daniil Komov", sourceUrl: "https://unsplash.com/photos/laptop-screen-displaying-code-and-data-charts-GQOylIn892U", origin: "photo-1763568258367-1c52beb60be7",
    width: 1920, height: 1278, fallback: "/web-images/site/search-intelligence-audit.jpg", fallbackAlt: "Person reviewing documents beneath a search audit graphic" }),
  content: studio({ id: "studio-content-film-set", slug: "content-film-set", section: "content", placement: "hero",
    title: "Professional content production", alt: "Filmmaker looking at a professional cinema camera setup in a studio",
    photographer: "Cemrecan Yurtman", sourceUrl: "https://unsplash.com/photos/filmmaker-looking-at-a-professional-camera-setup-in-a-studio-9YWyzZJxd3c", origin: "photo-1781127445188-3b05a9316dde",
    width: 1920, height: 1079, fallback: "/web-images/content/broadcast-control-studio.jpg", fallbackAlt: "Broadcast control room with monitors and studio lights" }),
  authority: studio({ id: "studio-authority-handshake", slug: "authority-handshake", section: "authority", placement: "gallery",
    title: "Building trusted business relationships", alt: "Two businesswomen shaking hands in a modern office atrium, seen from below",
    photographer: "Vitaly Gariev", sourceUrl: "https://unsplash.com/photos/two-businesswomen-shaking-hands-in-a-modern-office-building-EyapdJ3818E", origin: "photo-1758518729240-7162d07427b8",
    width: 1200, height: 675, fallback: "/web-images/authority/emerald-neural-sculpture.jpg", fallbackAlt: "Green sculptural brain form on a pale background" }),
  reputation: studio({ id: "studio-reputation-interview", slug: "reputation-interview", section: "reputation", placement: "hero",
    title: "Media coverage and public perception", alt: "Young man being interviewed on the street with a microphone and a video camera",
    photographer: "Thiago Zanutigh", sourceUrl: "https://unsplash.com/photos/a-person-being-interviewed-with-a-microphone-and-camera-NKpRyt8ABRw", origin: "photo-1759659334772-c3a05b8178e9",
    width: 1920, height: 1440, fallback: "/web-images/reputation/livestream-brand-retail-creator.jpg", fallbackAlt: "Creator presenting products to a phone on a ring light" }),
  agency: studio({ id: "studio-agency-whiteboard", slug: "agency-whiteboard", section: "agency", placement: "hero",
    title: "Coordinating client work and delivery", alt: "Two women working with laptops while one writes on a whiteboard",
    photographer: "Rodrigo Rodrigues | WOLF Λ R T", sourceUrl: "https://unsplash.com/photos/two-women-working-on-laptops-near-whiteboard-PLncNBoO4fE", origin: "photo-1762784574847-16c5100cd1ff",
    width: 1920, height: 2880, objectPosition: "50% 45%", fallback: "/web-images/agency/data-wall-collaboration.jpg", fallbackAlt: "Team watching a presenter at a large data wall" }),
  analytics: studio({ id: "studio-analytics-laptop-report", slug: "analytics-laptop-report", section: "analytics", placement: "hero",
    title: "Reading digital marketing performance", alt: "Laptop screen showing marketing analytics statistics and a bar chart",
    photographer: "Swello", sourceUrl: "https://unsplash.com/photos/a-laptop-screen-displays-data-analytics-charts-and-statistics-fDisDvdiqrQ", origin: "photo-1784729553968-07da5d7b7c99",
    width: 1920, height: 1280, fallback: "/web-images/analytics/closeup-tablet-reporting.jpg", fallbackAlt: "Hand using a stylus on a reporting tablet" }),
  "ai-exposure": studio({ id: "studio-ai-search-bar", slug: "ai-search-bar", section: "ai-exposure", placement: "hero",
    title: "Exploring AI-powered search and answers", alt: "Dark laptop screen showing an AI search bar asking how it can help",
    photographer: "Aerps.com", sourceUrl: "https://unsplash.com/photos/a-laptop-displays-a-search-bar-asking-how-it-can-help-0Jk1QCGMz5o", origin: "photo-1745674684463-62f62cb88d4c",
    width: 1920, height: 1280, fallback: "/web-images/ai-exposure/generative-search-workstation.jpg", fallbackAlt: "Hands typing beneath floating generative search interface graphics" }),
  command: studio({ id: "studio-command-strategy-table", slug: "command-strategy-table", section: "command", placement: "hero",
    title: "Bring evidence to the table", detail: "Connect the team around decisions that matter.", alt: "Four colleagues around a table in a bright creative office discussing work on laptops and paper",
    photographer: "Vitaly Gariev", sourceUrl: "https://unsplash.com/photos/diverse-team-collaborating-around-a-table-in-office-oiqFyLx_KDU", origin: "photo-1758873269317-51888e824b28",
    width: 1920, height: 1080, fallback: "/web-images/editorial/marketing-team.jpg", fallbackAlt: "Team meeting around a table in a meeting room with a wall screen" }),
} as const satisfies Record<string, VistaEditorialAsset>;

export const studioPhotographyList: VistaEditorialAsset[] = Object.values(studioLeads);
export const allEditorialAssets: VistaEditorialAsset[] = [...premiumPhotography, ...studioPhotographyList];

export const photosFor = (area: PhotoArea) => premiumPhotography.filter(p => p.section === area);
export const photoById = (id: string) => {
  const found = allEditorialAssets.find(p => p.id === id);
  if (!found) throw new Error("Unknown editorial photograph " + id);
  return found;
};

/** Incremental allocation agreed for the premium collection. */
export const requiredAllocation: Record<PhotoArea, number> = {
  cinematic: 2, command: 4, search: 3, impact: 3, site: 3, content: 3, authority: 3, reputation: 3,
  agency: 3, analytics: 3, "ai-exposure": 3, benchmark: 2, investigation: 2, workspace: 1, pricing: 1, demo: 1,
};
