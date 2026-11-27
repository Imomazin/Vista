import catalogue from "../../public/web-images/asset-catalogue.json";
import { studioPhotography } from "./editorial-photos";
import { photosFor, type PhotoArea } from "./premium-photography";

export type VisualCategory = "brand"|"cinematic"|"analytics"|"impact"|"authority"|"agency"|"ai-exposure"|"reputation"|"content"|"search"|"site";

export type VisualAsset = {
  path:string;
  title:string;
  placement:string;
  folder:VisualCategory;
  fallback?:string;
};

/** A photograph ready for a gallery card and its enlarged view. */
export type GalleryPhoto = {
  id:string;
  path:string;
  thumb:string;
  title:string;
  detail?:string;
  alt:string;
  objectPosition?:string;
  fallback?:string;
  fallbackAlt?:string;
};

export const visualAssets = catalogue.assets as VisualAsset[];

export const categoryForEngine = {
  1:"search",
  2:"impact",
  3:"site",
  4:"content",
  5:"authority",
  6:"reputation",
  7:"agency",
  8:"analytics",
  9:"ai-exposure",
} as const satisfies Record<number,VisualCategory&PhotoArea>;

/** Existing local photographs used only while an engine has fewer than three premium photographs. */
const supporting:Partial<Record<VisualCategory,GalleryPhoto[]>>={
  search:[{id:"legacy-search-touchscreen",path:"/web-images/search/search-engine-touchscreen.jpg",thumb:"/web-images/search/search-engine-touchscreen.jpg",title:"Search at a touch",alt:"Finger touching a tablet showing the Google search page"}],
  impact:[
    {id:"legacy-analyst-presenting",path:"/web-images/analytics/analyst-presenting-dashboard.jpg",thumb:"/web-images/analytics/analyst-presenting-dashboard.jpg",title:"Results the room can follow",alt:"Analyst presenting a data dashboard on a large screen while holding a tablet"},
    {id:"legacy-performance-presenter",path:"/web-images/analytics/performance-analytics-presenter.jpg",thumb:"/web-images/analytics/performance-analytics-presenter.jpg",title:"From numbers to a decision",alt:"Presenter gesturing towards colourful bar charts on a wall display"},
  ],
  agency:[{id:"legacy-data-wall",path:"/web-images/agency/data-wall-collaboration.jpg",thumb:"/web-images/agency/data-wall-collaboration.jpg",title:"Briefing the whole team",alt:"Team watching a presenter point at a large data wall"}],
  analytics:[{id:"legacy-executive-board",path:"/web-images/analytics/blue-executive-analytics-board.jpg",thumb:"/web-images/analytics/blue-executive-analytics-board.jpg",title:"Performance on the big screen",alt:"Two professionals reviewing charts on a large blue analytics wall"}],
};

export const getVisuals = (folder:VisualCategory) => visualAssets.filter(x=>x.folder===folder);

/** Lead photograph followed by the engine's premium collection; legacy imagery fills only thin galleries. */
export const getEngineVisuals = (id:keyof typeof categoryForEngine):GalleryPhoto[] => {
  const lead=studioPhotography[id];
  const premium=photosFor(categoryForEngine[id]).filter(p=>p.id!==lead.id);
  const fill=premium.length<3?(supporting[categoryForEngine[id]]??[]).slice(0,3-premium.length):[];
  return [lead,...premium,...fill];
};
export const cinematicVisuals=getVisuals("cinematic");
export const parentBrandVisuals=getVisuals("brand");
export const selectedPhotography=visualAssets.filter(x=>x.folder!=="brand");
export const fullSelectionCount=catalogue.uploads;

/** Existing local photographs for working tools that have no allocation in the premium collection. */
export const workingPagePhotos={
  audit:[{id:"legacy-site-audit",path:"/web-images/site/search-intelligence-audit.jpg",thumb:"/web-images/site/search-intelligence-audit.jpg",title:"Evidence before opinion",detail:"Every finding traced to the page itself.",alt:"Person reviewing printed documents with a pen beneath an illustrated search audit graphic"}],
  content:[{id:"legacy-production-studio",path:"/web-images/content/purple-production-studio.jpg",thumb:"/web-images/content/purple-production-studio.jpg",title:"Words built for the screen",detail:"Drafts shaped for every channel.",alt:"Production studio lit in violet with a camera, softbox lights and a presenter set"}],
} satisfies Record<string,GalleryPhoto[]>;
