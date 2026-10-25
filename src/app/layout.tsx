import type { Metadata } from "next";
import "./globals.css";
import "./appearance.css";

export const metadata: Metadata = {
  title: "VisTa | Marketing Superior Intelligence",
  description: "VisTa by Ambidexters. Nine interconnected elements spanning search visibility, impact, technical intelligence, content, authority, reputation, agency operations, analytics and AI exposure.",
  icons: { icon: "/vista.svg", apple: "/vista.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: "(function(){try{var saved=localStorage.getItem(\"vista-appearance\");var system=matchMedia(\"(prefers-color-scheme: light)\").matches;document.documentElement.dataset.appearance=saved===\"light\"||saved===\"dark\"?saved:system?\"light\":\"dark\";}catch(e){document.documentElement.dataset.appearance=\"dark\";}})();"}}/></head><body>{children}</body></html>;
}
