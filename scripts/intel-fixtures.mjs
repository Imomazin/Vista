/**
 * Local fixture websites for end-to-end VisTa intelligence testing. Each site binds a distinct
 * loopback address on port 4810 so sites stay separate:
 *   127.0.0.11 ecommerce · 127.0.0.12 professional services · 127.0.0.13 corporate training
 *   127.0.0.14 complex multi-page · 127.0.0.15 restricted crawler access · 127.0.0.16 competitor shop
 * Usage: node scripts/intel-fixtures.mjs   (then start VisTa with VISTA_TEST_CRAWL_ORIGINS set to these origins)
 */
import http from "node:http";

const PORT = 4810;
const words = (topic, n) => Array.from({ length: n }, (_, i) => ["Our", topic, "guidance", "helps", "teams", "choose", "reliable", "options", "with", "clear", "evidence", "and", "practical", "steps."][i % 14]).join(" ");
const page = ({ title, description, h1, body = "", head = "", nav = [], lang = "en", footer = true }) => `<!doctype html><html${lang ? ` lang="${lang}"` : ""}><head><meta charset="utf-8">${title !== undefined ? `<title>${title}</title>` : ""}${description ? `<meta name="description" content="${description}">` : ""}<meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body><a href="#main">Skip to content</a><header><nav>${nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join(" ")}</nav></header><main id="main">${h1 ? `<h1>${h1}</h1>` : ""}${body}</main>${footer ? `<footer><a href="/contact">Contact us</a> <a href="/about">About</a> <a href="/privacy">Privacy policy</a> <a href="/terms">Terms and conditions</a> <a href="tel:+442000000000">020 0000 0000</a></footer>` : ""}</body></html>`;
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

function ecommerce(base, name = "Summit Outfitters", rival = false) {
  const nav = [["/", "Home"], ["/collections/boots", "Boots"], ["/collections/tents", "Tents"], ["/blog", "Journal"], ["/about", "About"], ["/missing-page", "Gift cards"]];
  const products = rival ? ["alpine-boot", "trail-runner", "dome-tent", "summit-pack"] : ["ridge-hiking-boot", "trail-hiking-boot", "storm-tent", "ultralight-tent", "daypack-25"];
  const pages = {
    "/": page({ title: name + " | Hiking boots, tents and outdoor equipment", description: "Shop hiking boots, tents and outdoor equipment with free UK delivery.", h1: name, nav, head: ld({ "@context": "https://schema.org", "@type": "OnlineStore", name, url: base, logo: base + "/logo.png", sameAs: rival ? ["https://www.linkedin.com/company/rival", "https://www.instagram.com/rival", "https://www.facebook.com/rival"] : ["https://www.instagram.com/summit"] }) + '<link rel="canonical" href="' + base + '/">', body: `<h2>Best sellers</h2><ul>${products.map(p => `<li><a href="/products/${p}">${p.replace(/-/g, " ")}</a></li>`).join("")}</ul><p>${words("outdoor", rival ? 520 : 160)}</p><img src="/img/hero.jpg"><img src="/img/boots.jpg" alt="Hiking boots on a mountain path"><a href="/collections/boots?sort=price">Sort by price</a><a href="/old-sale">Sale</a>` }),
    "/collections/boots": page({ title: "Hiking boots | " + name, description: "Waterproof hiking boots.", h1: "Hiking boots", nav, body: `<p>${words("boots", 220)}</p>${products.filter(p => p.includes("boot") || p.includes("runner")).map(p => `<a href="/products/${p}">${p}</a>`).join(" ")}<a href="/collections/boots?colour=brown">Brown</a>` }),
    "/collections/tents": page({ title: "Tents | " + name, h1: "Tents", nav, body: `<p>${words("tents", 180)}</p>${products.filter(p => p.includes("tent")).map(p => `<a href="/products/${p}">${p}</a>`).join(" ")}` }),
    "/blog": page({ title: "Journal | " + name, description: "Guides for hikers.", h1: "Journal", nav, body: `<a href="/blog/how-to-choose-hiking-boots">How to choose hiking boots</a><a href="/blog/tent-buying-guide">Tent buying guide</a><p>${words("journal", 90)}</p>` }),
    "/blog/how-to-choose-hiking-boots": page({ title: "How to choose hiking boots: a complete guide | " + name, description: "Choose the right hiking boots.", h1: "How to choose hiking boots", nav, head: ld({ "@type": "Article", headline: "How to choose hiking boots", author: { "@type": "Person", name: "Alex Ridge" }, datePublished: "2024-02-01", dateModified: "2024-03-01" }), body: `<h2>What size do I need?</h2><p>${words("boot fitting", 420)}</p><ul><li>Fit</li><li>Grip</li></ul><a href="https://www.nhs.uk/live-well/exercise/">NHS walking advice</a><a href="https://www.bmc.org.uk/">British Mountaineering Council</a>` }),
    "/blog/tent-buying-guide": page({ title: "Tent buying guide | " + name, h1: "Tent buying guide", nav, body: `<p>${words("tent", 300)}</p><a href="https://dead-link.example.invalid/x">Old reference</a>` }),
    "/about": page({ title: "About " + name, h1: "About us", nav, body: `<p>${words("company", 140)}</p>` }),
    "/contact": page({ title: "Contact " + name, h1: "Contact", nav, body: `<form><input type="email" name="email"><button></button></form><address>1 High Street, Keswick</address>` }),
    "/privacy": page({ title: "Privacy policy | " + name, h1: "Privacy", nav, body: `<p>${words("privacy", 200)}</p>`, head: '<meta name="robots" content="noindex">' }),
    "/terms": page({ title: "Terms | " + name, h1: "Terms", nav, body: `<p>${words("terms", 200)}</p>` }),
  };
  for (const p of products) pages["/products/" + p] = page({ title: rival ? p.replace(/-/g, " ") + " | " + name : "Product | " + name, description: rival ? "Buy " + p : undefined, h1: p.replace(/-/g, " "), nav, head: ld({ "@type": "Product", name: p, offers: { "@type": "Offer", price: "120", priceCurrency: "GBP" }, ...(rival ? { aggregateRating: { "@type": "AggregateRating", ratingValue: "4.7", reviewCount: "212" } } : {}) }), body: `<p>${words(p, rival ? 480 : 140)}</p><img src="/img/${p}.png"><a href="/collections/boots">Back</a>` });
  const redirects = rival ? {} : { "/old-sale": "/sale-2025", "/sale-2025": "/collections/boots" };
  const sitemap = [...Object.keys(pages).filter(p => p !== "/missing-page"), "/discontinued-item"].map(p => base + p);
  return { pages, redirects, sitemap, robots: "User-agent: *\nDisallow: /cart\nSitemap: " + base + "/sitemap.xml" };
}

function services(base) {
  const name = "Harbour Advisory";
  const nav = [["/", "Home"], ["/services/strategy", "Strategy"], ["/services/risk", "Risk"], ["/insights", "Insights"], ["/team", "Team"], ["/case-studies", "Case studies"]];
  const org = ld({ "@context": "https://schema.org", "@type": "ProfessionalService", name, url: base, logo: base + "/logo.svg", telephone: "+44 20 0000 0000", address: { "@type": "PostalAddress", addressLocality: "London" }, sameAs: ["https://www.linkedin.com/company/harbour", "https://www.wikidata.org/wiki/Q1", "https://find-and-update.company-information.service.gov.uk/company/0"] });
  const alt = (path) => `<link rel="alternate" hreflang="en-gb" href="${base}${path}"><link rel="alternate" hreflang="en-us" href="${base}/us${path === "/" ? "/" : path}"><link rel="alternate" hreflang="x-default" href="${base}${path}">`;
  const pages = {
    "/": page({ title: "Harbour Advisory | Strategy and risk consulting for boards", description: "Independent strategy and risk advice for boards and executive teams.", h1: "Clarity for complex decisions", nav, head: org + alt("/") + '<link rel="canonical" href="' + base + '/">', body: `<p>${words("advisory", 360)}</p><h2>How we help</h2><ul><li><a href="/services/strategy">Strategy</a></li><li><a href="/services/risk">Risk</a></li></ul>` }),
    "/services/strategy": page({ title: "Strategy consulting for boards | Harbour Advisory", description: "Board-level strategy consulting.", h1: "Strategy consulting", nav, head: ld({ "@type": "Service", name: "Strategy consulting", provider: { "@type": "Organization", name } }), body: `<h2>What does a strategy review include?</h2><p>${words("strategy", 520)}</p><ol><li>Diagnose</li><li>Decide</li></ol><a href="https://www.ft.com/">Financial Times</a><a href="https://hbr.org/">Harvard Business Review</a>` }),
    "/services/risk": page({ title: "Risk advisory | Harbour Advisory", description: "Enterprise risk advisory.", h1: "Risk advisory", nav, body: `<p>${words("risk", 480)}</p><h2>Why risk appetite matters</h2><p>${words("appetite", 120)}</p>` }),
    "/insights": page({ title: "Insights | Harbour Advisory", description: "Thinking for boards.", h1: "Insights", nav, body: `<a href="/insights/board-ai-governance">Board AI governance</a><a href="/insights/scenario-planning">Scenario planning</a><p>${words("insight", 80)}</p>` }),
    "/insights/board-ai-governance": page({ title: "How should boards govern AI? | Harbour Advisory", description: "A board guide to AI governance.", h1: "How should boards govern AI?", nav, head: ld({ "@type": "Article", author: { "@type": "Person", name: "Dr Jane Harbour" }, datePublished: "2026-09-01", dateModified: "2026-10-15" }), body: `<h2>What questions should directors ask?</h2><p>${words("governance", 640)}</p><ul><li>Accountability</li><li>Assurance</li></ul><table><tr><td>Risk</td></tr></table><a href="https://www.oecd.org/ai/">OECD AI</a><a href="https://www.gov.uk/government/publications/ai-regulation">UK AI regulation</a>` }),
    "/insights/scenario-planning": page({ title: "Scenario planning for uncertain markets | Harbour Advisory", description: "Scenario planning guide.", h1: "Scenario planning", nav, head: ld({ "@type": "Article", author: { "@type": "Person", name: "Sam Okafor" }, datePublished: "2026-06-01" }), body: `<p>${words("scenario", 560)}</p>` }),
    "/team": page({ title: "Our team | Harbour Advisory", description: "Senior advisers.", h1: "Our team", nav, body: `<p>${words("team", 260)}</p>` }),
    "/case-studies": page({ title: "Case studies | Harbour Advisory", description: "Client outcomes.", h1: "Case studies", nav, body: `<p>${words("case", 300)}</p>` }),
    "/about": page({ title: "About Harbour Advisory", description: "About us.", h1: "About", nav, body: `<p>${words("about", 200)}</p>` }),
    "/contact": page({ title: "Contact Harbour Advisory", description: "Contact us.", h1: "Contact", nav, body: `<form><label for="e">Email</label><input id="e" type="email"><button>Send</button></form>` }),
    "/privacy": page({ title: "Privacy | Harbour Advisory", description: "Privacy notice.", h1: "Privacy", nav, body: `<p>${words("privacy", 200)}</p>` }),
    "/terms": page({ title: "Terms | Harbour Advisory", description: "Terms.", h1: "Terms", nav, body: `<p>${words("terms", 150)}</p>` }),
  };
  return { pages, redirects: {}, sitemap: Object.keys(pages).map(p => base + p), robots: "User-agent: *\nAllow: /\nSitemap: " + base + "/sitemap.xml", headers: { "Strict-Transport-Security": "max-age=31536000", "Content-Security-Policy": "default-src 'self'" } };
}

function training(base) {
  const name = "Northstar Learning";
  const nav = [["/", "Home"], ["/courses", "Courses"], ["/resources", "Resources"], ["/faq", "FAQ"]];
  const courses = ["leadership-essentials", "project-management", "data-literacy", "presentation-skills", "coaching-for-managers"];
  const pages = {
    "/": page({ title: "Northstar Learning", description: "Corporate training courses.", h1: "Corporate training that changes behaviour", nav, head: ld({ "@type": "EducationalOrganization", name, url: base }), body: `<p>${words("training", 220)}</p>${courses.map(c => `<a href="/courses/${c}">${c}</a>`).join(" ")}` }),
    "/courses": page({ title: "Courses | Northstar Learning", description: "All courses.", h1: "Courses", nav, body: courses.map(c => `<a href="/courses/${c}">${c}</a>`).join(" ") + `<p>${words("courses", 120)}</p>` }),
    "/resources": page({ title: "Resources | Northstar Learning", h1: "Resources", nav, body: `<p>Coming soon.</p>` }),
    "/faq": page({ title: "Frequently asked questions | Northstar Learning", description: "Answers about our training.", h1: "FAQ", nav, head: ld({ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Do you train online?", acceptedAnswer: { "@type": "Answer", text: "Yes." } }] }), body: `<h2>Do you train online?</h2><p>${words("online", 160)}</p><h2>How long are courses?</h2><p>${words("duration", 160)}</p>` }),
  };
  courses.forEach((c, i) => { pages["/courses/" + c] = page({ title: i < 2 ? "Leadership training course | Northstar Learning" : c.replace(/-/g, " ") + " course | Northstar Learning", description: i % 2 ? "" : "Course details.", h1: c.replace(/-/g, " "), nav, head: ld({ "@type": "Course", name: c, provider: { "@type": "Organization", name } }), body: `<p>${words(i < 3 ? "course" : c, i < 3 ? 400 : 90)}</p><img src="/img/${c}.jpg">` }); });
  return { pages, redirects: { "/courses/old-leadership": "/courses/leadership-essentials" }, sitemap: Object.keys(pages).map(p => base + p), robots: "User-agent: *\nDisallow:\nSitemap: " + base + "/sitemap.xml" };
}

function complex(base) {
  const nav = [["/", "Home"], ["/catalogue", "Catalogue"], ["/regions", "Regions"], ["/news", "News"]];
  const pages = {
    "/": page({ title: "Meridian Group | Complex multi-page fixture", description: "Group home.", h1: "Meridian Group", nav, body: `<p>${words("group", 200)}</p><a href="/loop-a">Archive</a>` }),
    "/catalogue": page({ title: "Catalogue | Meridian", description: "Catalogue.", h1: "Catalogue", nav, body: Array.from({ length: 6 }, (_, i) => `<a href="/catalogue/section-${i}">Section ${i}</a>`).join(" ") + `<a href="/catalogue?page=2">Next</a>` }),
    "/regions": page({ title: "Regions | Meridian", description: "Regions.", h1: "Regions", nav, body: ["north", "south", "east", "west"].map(r => `<a href="/regions/${r}">${r}</a>`).join(" ") }),
    "/news": page({ title: "News | Meridian", description: "News.", h1: "News", nav, body: Array.from({ length: 4 }, (_, i) => `<a href="/news/2026/item-${i}">Item ${i}</a>`).join(" ") }),
  };
  for (let s = 0; s < 6; s++) { pages[`/catalogue/section-${s}`] = page({ title: `Section ${s} | Meridian`, description: "Section.", h1: `Section ${s}`, nav, body: Array.from({ length: 4 }, (_, i) => `<a href="/catalogue/section-${s}/item-${i}">Item ${i}</a>`).join(" ") }); for (let i = 0; i < 4; i++) pages[`/catalogue/section-${s}/item-${i}`] = page({ title: `Item ${i} in section ${s} | Meridian`, description: "Item.", h1: `Item ${i}`, nav, body: `<p>${words("item", 260)}</p>` + (i === 3 ? `<a href="/catalogue/section-${s}/item-${i}/detail">Detail</a>` : "") }); pages[`/catalogue/section-${s}/item-3/detail`] = page({ title: `Detail ${s} | Meridian`, h1: "Detail", nav, body: `<p>${words("detail", 120)}</p><a href="/catalogue/section-${s}/item-3/detail/specs">Specifications</a>` }); pages[`/catalogue/section-${s}/item-3/detail/specs`] = page({ title: `Specifications ${s} | Meridian`, h1: "Specifications", nav, body: `<p>${words("specs", 100)}</p>` }); }
  for (const r of ["north", "south", "east", "west"]) pages["/regions/" + r] = page({ title: "Meridian regional office", description: "Our regional office.", h1: "Regional office", nav, body: `<p>${words("regional office", 300)}</p>` });
  for (let i = 0; i < 4; i++) pages[`/news/2026/item-${i}`] = page({ title: `News item ${i} | Meridian`, description: "News.", h1: `News ${i}`, nav, head: ld({ "@type": "NewsArticle", datePublished: "2023-01-0" + (i + 1) }), body: `<p>${words("news", 150)}</p>` });
  pages["/orphan-landing"] = page({ title: "Campaign landing | Meridian", description: "Campaign.", h1: "Campaign", nav, body: `<p>${words("campaign", 200)}</p>` });
  return { pages, redirects: { "/loop-a": "/loop-b", "/loop-b": "/loop-a" }, sitemap: [...Object.keys(pages)].map(p => base + p), robots: "User-agent: *\nDisallow:\nSitemap: " + base + "/sitemap.xml" };
}

function restricted(base) {
  const pages = { "/": page({ title: "Private Members Club", description: "Members only.", h1: "Members", body: `<p>${words("members", 100)}</p><a href="/members">Members area</a>` }) };
  return { pages, redirects: {}, sitemap: [base + "/"], robots: "User-agent: VistaSiteIntelligence\nDisallow: /\n\nUser-agent: *\nDisallow: /members", forbidden: ["/members"] };
}

const sites = [["127.0.0.11", ecommerce], ["127.0.0.12", services], ["127.0.0.13", training], ["127.0.0.14", complex], ["127.0.0.15", restricted], ["127.0.0.16", base => ecommerce(base, "Ridgeline Supply", true)]];
for (const [host, build] of sites) {
  const base = `http://${host}:${PORT}`;
  const site = build(base);
  http.createServer((req, res) => {
    const url = new URL(req.url, base);
    const path = url.pathname;
    if (path === "/robots.txt") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end(site.robots); }
    if (path === "/sitemap.xml") { res.writeHead(200, { "Content-Type": "application/xml" }); return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${site.sitemap.map(u => `<url><loc>${u}</loc><lastmod>2026-10-01</lastmod></url>`).join("")}</urlset>`); }
    if (site.forbidden?.includes(path)) { res.writeHead(403, { "Content-Type": "text/html" }); return res.end("<h1>Forbidden</h1>"); }
    if (site.redirects[path]) { res.writeHead(301, { Location: site.redirects[path] }); return res.end(); }
    const html = site.pages[path];
    if (!html) { res.writeHead(404, { "Content-Type": "text/html" }); return res.end("<h1>Not found</h1>"); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...(site.headers || {}) });
    res.end(html);
  }).listen(PORT, host, () => console.log("fixture", base));
}
