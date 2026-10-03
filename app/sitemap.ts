import type { MetadataRoute } from "next";
import { hotels } from "@/src/data/hotels";
import { DISCOVERY_PAGES } from "@/src/seo/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://example.vercel.app";
  const liveSeo=process.env.SEO_LIVE_INDEXING==="true"&&process.env.SEO_HAS_LIVE_PROVIDER_EVIDENCE==="true";
  return [
    {url:base,changeFrequency:"daily",priority:1},
    ...hotels.map(h=>({url:base+"/live/"+h.slug,changeFrequency:"daily" as const,priority:.7})),
    ...(liveSeo ? DISCOVERY_PAGES.map(p=>({url:base+"/discover/"+p.slug,changeFrequency:"daily" as const,priority:.8})) : [])
  ];
}
