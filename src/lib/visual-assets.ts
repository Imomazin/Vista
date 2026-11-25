import catalogue from "../../public/web-images/asset-catalogue.json";

export type VisualCategory = "brand"|"cinematic"|"analytics"|"impact"|"authority"|"agency"|"ai-exposure"|"reputation"|"content"|"search"|"site";

export type VisualAsset = {
  path:string;
  title:string;
  placement:string;
  folder:VisualCategory;
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
} as const satisfies Record<number,VisualCategory>;

export const getVisuals = (folder:VisualCategory) => visualAssets.filter(x=>x.folder===folder);
const humanStories:VisualAsset[]=[
 {path:'/web-images/editorial/marketing-team.jpg',title:'Marketing team reviewing campaign evidence',placement:'Engine opening',folder:'analytics'},
 {path:'/web-images/editorial/creative-collaboration.jpg',title:'Creative colleagues collaborating on a project',placement:'Engine opening',folder:'content'}
];
export const getEngineVisuals = (id:keyof typeof categoryForEngine)=>[{...humanStories[[4,7,9].includes(id)?1:0],folder:categoryForEngine[id]},...getVisuals(categoryForEngine[id])];
export const cinematicVisuals=getVisuals("cinematic");
export const parentBrandVisuals=getVisuals("brand");
export const selectedPhotography=visualAssets.filter(x=>x.folder!=="brand");
export const fullSelectionCount=catalogue.uploads;
