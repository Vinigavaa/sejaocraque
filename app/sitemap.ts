import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/ui/site'

/** O jogo inteiro vive numa rota so: o sitemap tem uma linha, e e a correta. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl().toString(),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
