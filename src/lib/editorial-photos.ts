import { photoById, studioLeads, type VistaEditorialAsset } from "./premium-photography";

/** Lead photograph for each intelligence studio, served locally with source attribution. */
export const studioPhotography: Record<1|2|3|4|5|6|7|8|9, VistaEditorialAsset> = {
  1: studioLeads.search,
  2: studioLeads.impact,
  3: studioLeads.site,
  4: studioLeads.content,
  5: photoById("authority-team-review-table"),
  6: studioLeads.reputation,
  7: studioLeads.agency,
  8: studioLeads.analytics,
  9: studioLeads["ai-exposure"],
};
export const commandPhotography = studioLeads.command;
/** Retired from the studio leads and kept in the secondary Visual Atlas. */
export const atlasOnlyPhotography: VistaEditorialAsset[] = [studioLeads.authority];
export const editorialPhotography: VistaEditorialAsset[] = [...Object.values(studioPhotography), commandPhotography];
