import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { getProjectStateDetails } from '../../src/lib/state-manager';

let contentPath = '/test/user-data/legacy';
let siteProjectPath: string | null = '/test/user-data/legacy';
let filesPath = '/test/files';
let imageStorage: 'local' | 'r2' | 'external' = 'local';
let themesPath = '/test/themes';
let repoRoot = '/test/repo';
let hasSiteProjectFlag = true;

vi.mock('../../src/lib/paths', () => ({
  getContentPath: () => contentPath,
  getSiteProjectPath: () => siteProjectPath,
  getRepoPath: () => repoRoot,
  getFilesPath: () => filesPath,
  getThemesPath: () => themesPath,
  getImageStorageMode: () => imageStorage,
  hasSiteProject: () => hasSiteProjectFlag,
}));

describe('Project State Detection', () => {
  beforeEach(() => {
    contentPath = '/test/user-data/legacy';
    siteProjectPath = '/test/user-data/legacy';
    filesPath = '/test/files';
    imageStorage = 'local';
    themesPath = '/test/themes';
    repoRoot = '/test/repo';
    hasSiteProjectFlag = true;
  });

  it('detects legacy settings.yaml layout as ready', () => {
    vol.fromJSON({
      '/test/user-data/legacy/settings.yaml': `
site:
  title: Legacy Site
  url: https://legacy.example
theme: minimalist
`,
      '/test/user-data/legacy/artworks/example.yaml': 'title: Example',
      '/test/files/large/example.webp': 'image',
    });

    const details = getProjectStateDetails();

    expect(details.state).toBe('READY');
    expect(details.hasSettings).toBe(true);
    expect(details.hasArtworks).toBe(true);
    expect(details.hasTheme).toBe(true);
    expect(details.missingRequirements).toEqual([]);
  });

  it('resolves new settings layout when content path points at settings directory', () => {
    contentPath = '/test/user-data/vasily/settings';
    siteProjectPath = '/test/user-data/vasily/settings';

    vol.fromJSON({
      '/test/user-data/vasily/settings/settings.yaml': `
site:
  title: Vasily Portfolio
  url: https://vasily.example
`,
      '/test/user-data/vasily/settings/theme.yaml': 'theme: minimalist',
      '/test/user-data/vasily/artworks/example.yaml': 'title: Example',
      '/test/files/large/example.webp': 'image',
    });

    const details = getProjectStateDetails();

    expect(details.state).toBe('READY');
    expect(details.hasSettings).toBe(true);
    expect(details.hasArtworks).toBe(true);
    expect(details.hasTheme).toBe(true);
    expect(details.userDataPath).toBe('/test/user-data/vasily');
  });

  it('flags invalid settings in new layout', () => {
    contentPath = '/test/user-data/invalid';
    siteProjectPath = '/test/user-data/invalid';

    vol.fromJSON({
      '/test/user-data/invalid/settings/settings.yaml': `
site:
  title: Missing Url
`,
      '/test/user-data/invalid/settings/theme.yaml': 'theme: minimalist',
      '/test/user-data/invalid/artworks/example.yaml': 'title: Example',
      '/test/files/large/example.webp': 'image',
    });

    const details = getProjectStateDetails();

    expect(details.state).toBe('SETUP');
    expect(details.hasSettings).toBe(false);
    expect(details.missingRequirements).toEqual(
      expect.arrayContaining(['Settings missing required fields (title, URL)'])
    );
  });
});
