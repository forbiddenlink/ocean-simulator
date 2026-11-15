import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import robots from '../../public/robots.txt?raw';
import sitemap from '../../public/sitemap.xml?raw';

const HOST = 'https://ocean-simulator-silk.vercel.app';

describe('SEO metadata points at the live deployment', () => {
  it('index.html canonical, og:url and images use the live host', () => {
    expect(html).toContain(`<link rel="canonical" href="${HOST}/" />`);
    expect(html).toContain(`<meta property="og:url" content="${HOST}/" />`);
    expect(html).toContain(`<meta property="og:image" content="${HOST}/og-image.png" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${HOST}/og-image.png" />`);
    expect(html).not.toContain('//ocean-simulator.vercel.app');
  });

  it('sitemap and robots use the live host', () => {
    expect(sitemap).toContain(`<loc>${HOST}/</loc>`);
    expect(robots).toContain(`Sitemap: ${HOST}/sitemap.xml`);
  });
});
