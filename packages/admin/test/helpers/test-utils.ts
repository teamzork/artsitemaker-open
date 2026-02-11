import { vol } from 'memfs';
import yaml from 'js-yaml';

/**
 * Sets up a basic filesystem structure for tests
 */
export function setupTestFileSystem() {
  const dirs = [
    '/test/content',
    '/test/content/artworks',
    '/test/content/collections',
    '/test/content/pages',
    '/test/files',
  ];

  dirs.forEach(dir => {
    vol.mkdirSync(dir, { recursive: true });
  });
}

/**
 * Creates a YAML file in the mock filesystem
 */
export function createYAMLFile(path: string, data: any) {
  vol.writeFileSync(path, yaml.dump(data), 'utf8');
}

/**
 * Reads and parses a YAML file from the mock filesystem
 */
export function readYAMLFile(path: string) {
  const content = vol.readFileSync(path, 'utf8') as string;
  return yaml.load(content);
}

/**
 * Creates a mock collection
 */
export function createMockCollection(name: string, title: string) {
  const path = `/test/content/collections/${name}.yaml`;
  const data = {
    title,
    description: `Test collection: ${title}`,
    artworks: [],
  };
  createYAMLFile(path, data);
  return { path, data };
}

/**
 * Creates a mock artwork
 */
export function createMockArtwork(slug: string, title: string, sortOrder = 0) {
  const path = `/test/content/artworks/${slug}.yaml`;
  const data = {
    title,
    slug,
    sortOrder,
    date: '2024',
    images: {
      primary: `/files/${slug}.jpg`,
    },
  };
  createYAMLFile(path, data);
  return { path, data };
}

/**
 * Creates a mock settings file
 */
export function createMockSettings(data: any = {}) {
  const path = '/test/content/settings.yaml';
  const defaultSettings = {
    title: 'Test Gallery',
    description: 'A test gallery',
    ...data,
  };
  createYAMLFile(path, defaultSettings);
  return { path, data: defaultSettings };
}

/**
 * Lists all files in a directory in the mock filesystem
 */
export function listFiles(dir: string): string[] {
  try {
    return vol.readdirSync(dir) as string[];
  } catch {
    return [];
  }
}
