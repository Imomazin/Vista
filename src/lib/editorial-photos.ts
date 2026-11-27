import type { VisualCategory } from "./visual-assets";

/** Editorial photography; source pages record the original photographer and Unsplash licence. */
export type EditorialPhoto={path:string;title:string;placement:string;folder:VisualCategory;source:string;photographer:string;fallback:string};
const photo=(id:string,title:string,folder:VisualCategory,source:string,photographer:string,fallback:string):EditorialPhoto=>({
 path:"https://images.unsplash.com/"+id+"?auto=format&fit=crop&w=1800&q=80",title,folder,placement:"Editorial photography",source,photographer,fallback
});
export const studioPhotography={
 1:photo("photo-1616499370260-485b3e5ed653","Understanding how people search","search","https://unsplash.com/photos/person-using-black-laptop-computer-eMemmpUojlw","Firmbee.com","/web-images/search/search-engine-touchscreen.jpg"),
 2:photo("photo-1758873269811-4e62e346b4b7","Connecting evidence to business outcomes","impact","https://unsplash.com/photos/diverse-team-collaborating-on-a-project-in-an-office-PSksbOVDhWk","Vitaly Gariev","/web-images/impact/holographic-growth-dashboard.jpg"),
 3:photo("photo-1763568258367-1c52beb60be7","Investigating technical performance","site","https://unsplash.com/photos/laptop-screen-displaying-code-and-data-charts-GQOylIn892U","Daniil Komov","/web-images/site/search-intelligence-audit.jpg"),
 4:photo("photo-1781127445188-3b05a9316dde","Professional content production","content","https://unsplash.com/photos/filmmaker-looking-at-a-professional-camera-setup-in-a-studio-9YWyzZJxd3c","Cemrecan Yurtman","/web-images/content/broadcast-control-studio.jpg"),
 5:photo("photo-1758518729240-7162d07427b8","Building trusted business relationships","authority","https://unsplash.com/photos/two-businesswomen-shaking-hands-in-a-modern-office-building-EyapdJ3818E","Vitaly Gariev","/web-images/authority/emerald-neural-sculpture.jpg"),
 6:photo("photo-1759659334772-c3a05b8178e9","Media coverage and public perception","reputation","https://unsplash.com/photos/a-person-being-interviewed-with-a-microphone-and-camera-NKpRyt8ABRw","Thiago Zanutigh","/web-images/reputation/livestream-brand-retail-creator.jpg"),
 7:photo("photo-1762784574847-16c5100cd1ff","Coordinating client work and delivery","agency","https://unsplash.com/photos/two-women-working-on-laptops-near-whiteboard-PLncNBoO4fE","Rodrigo Rodrigues | WOLF Λ R T","/web-images/agency/data-wall-collaboration.jpg"),
 8:photo("photo-1784729553968-07da5d7b7c99","Reading digital marketing performance","analytics","https://unsplash.com/photos/a-laptop-screen-displays-data-analytics-charts-and-statistics-fDisDvdiqrQ","Swello","/web-images/analytics/closeup-tablet-reporting.jpg"),
 9:photo("photo-1745674684463-62f62cb88d4c","Exploring AI-powered search and answers","ai-exposure","https://unsplash.com/photos/a-laptop-displays-a-search-bar-asking-how-it-can-help-0Jk1QCGMz5o","Aerps.com","/web-images/ai-exposure/generative-search-workstation.jpg")
} as const;
export const commandPhotography=photo("photo-1758873269317-51888e824b28","Collaboration around a marketing strategy","cinematic","https://unsplash.com/photos/diverse-team-collaborating-around-a-table-in-office-oiqFyLx_KDU","Vitaly Gariev","/web-images/editorial/marketing-team.jpg");
export const editorialPhotography=[...Object.values(studioPhotography),commandPhotography];
