import { describe, expect, it } from 'vitest';

// The project has no @types/node, so load fs through a non-literal specifier. The
// specifier is built at runtime so tsc does not try to resolve the module's types.
async function bytes(file: string): Promise<number> {
  const fs = await import(/* @vite-ignore */ ['node', 'fs'].join(':'));
  return fs.statSync(new URL(`../../public/${file}`, import.meta.url)).size;
}

// The loading-screen video is fetched before the first frame of the app, and the
// OG image is fetched by every link-preview crawler. Keep both small.
describe('public asset size budget', () => {
  it('hero.mp4 stays under 3 MB', async () => {
    expect(await bytes('hero.mp4')).toBeLessThan(3 * 1024 * 1024);
  });

  it('og-image.png stays under 300 KB', async () => {
    expect(await bytes('og-image.png')).toBeLessThan(300 * 1024);
  });
});
