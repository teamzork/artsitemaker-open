import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from './paths';
import type { ArtworkData, PageData, SettingsData } from '../types/content';

interface ReadOptions {
  label?: string;
  silent?: boolean;
}

async function readYamlFile<T>(absolutePath: string, options: ReadOptions = {}): Promise<T | null> {
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return yaml.load(content) as T;
  } catch (error) {
    if (!options.silent) {
      console.error(`Failed to load ${options.label ?? absolutePath}:`, error);
    }
    return null;
  }
}

export async function loadSettings(): Promise<SettingsData | null> {
  const settingsPath = path.join(getContentPath(), 'settings.yaml');
  return readYamlFile<SettingsData>(settingsPath, { label: 'settings', silent: true });
}

export async function loadArtwork(slug: string): Promise<ArtworkData | null> {
  const filePath = path.join(getContentPath(), 'artworks', `${slug}.yaml`);
  return readYamlFile<ArtworkData>(filePath, { label: `artwork ${slug}`, silent: true });
}

export async function loadPage(pageSlug: string): Promise<PageData | null> {
  const filePath = path.join(getContentPath(), 'pages', `${pageSlug}.yaml`);
  return readYamlFile<PageData>(filePath, { label: `page ${pageSlug}`, silent: true });
}

interface ArtworkListOptions {
  onlyPublished?: boolean;
  sort?: boolean;
}

export async function listArtworks(options: ArtworkListOptions = {}): Promise<ArtworkData[]> {
  const artworksDir = path.join(getContentPath(), 'artworks');
  let entries: string[] = [];

  try {
    entries = await fs.readdir(artworksDir);
  } catch (error) {
    console.error('Failed to read artworks directory:', error);
    return [];
  }

  const artworks: ArtworkData[] = [];

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.yaml')) continue;

    const slug = entry.replace(/\.yaml$/i, '');
    const artwork = await loadArtwork(slug);
    if (!artwork) continue;

    if (options.onlyPublished !== false && artwork.published === false) {
      continue;
    }

    artworks.push(artwork);
  }

  if (options.sort !== false) {
    artworks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  return artworks;
}

export async function listArtworkSlugs(options: ArtworkListOptions = {}): Promise<string[]> {
  const artworks = await listArtworks(options);
  return artworks.map((artwork) => artwork.slug);
}

export type PageEntry = PageData & { slug: string; pageType?: string };

interface PageListOptions {
  onlyPublished?: boolean;
  predicate?: (page: PageEntry) => boolean;
}

export async function listPages(options: PageListOptions = {}): Promise<PageEntry[]> {
  const pagesDir = path.join(getContentPath(), 'pages');
  let entries: string[] = [];

  try {
    entries = await fs.readdir(pagesDir);
  } catch (error) {
    console.error('Failed to read pages directory:', error);
    return [];
  }

  const pages: PageEntry[] = [];

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.yaml')) continue;

    const slug = entry.replace(/\.yaml$/i, '');
    const page = await readYamlFile<PageEntry>(path.join(pagesDir, entry), { label: `page ${slug}`, silent: true });
    if (!page) continue;

    const normalizedPage: PageEntry = { ...page, slug };

    if (options.onlyPublished !== false && normalizedPage.published === false) {
      continue;
    }

    if (options.predicate && !options.predicate(normalizedPage)) {
      continue;
    }

    pages.push(normalizedPage);
  }

  return pages;
}
