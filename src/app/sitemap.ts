import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{url:"https://vista.ambidexters.com/",changeFrequency:"weekly",priority:1}];
}
