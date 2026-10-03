import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Atlas — Your retirement. Everywhere.",
    template: "%s · Atlas",
  },
  description:
    "Explore what your pension and home income can buy around the world. Long-stay living, verified offers and route planning.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://example.vercel.app"),
  openGraph: {
    title: "You retired from work. Not from the world.",
    description: "Turn recurring income into months of life around the world.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
