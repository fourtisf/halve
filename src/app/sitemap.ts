import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return ['', '/app', '/lend', '/oracle', '/token', '/docs', '/legal/terms', '/legal/privacy', '/legal/risk'].map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: 'daily', priority: p === '' ? 1 : 0.8 }))
}
