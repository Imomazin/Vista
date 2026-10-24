import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VisTa | Marketing Superior Intelligence",
  description: "VisTa by Ambidexters. Nine interconnected elements spanning search visibility, impact, technical intelligence, content, authority, reputation, agency operations, analytics and AI exposure.",
  icons: { icon: "/vista.svg", apple: "/vista.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
