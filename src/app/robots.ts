import type { MetadataRoute } from "next";

// S-9: quiet tool. Nothing here should be indexed.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
