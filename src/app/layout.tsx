import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VISTA | Marketing Superior Intelligence",
  description: "An Ambidexters technology for visibility, optimisation and intelligent marketing impact.",
  icons: { icon: "/vista.svg", apple: "/vista.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
