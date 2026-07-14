import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://social-network-chain.vercel.app";

  return [{ url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 }];
}
