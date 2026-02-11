import type { APIRoute } from 'astro';
import { getContentPath, getImageBaseUrl } from '../../lib/paths';
import { YamlManager, type ArtworkData } from '../../lib/yaml-manager';

type ArtworkListItem = {
  slug: string;
  title: string;
  thumbnailUrl: string;
  published: boolean;
};

export const GET: APIRoute = async () => {
  try {
    const contentPath = getContentPath();
    const manager = new YamlManager(contentPath);
    let artworks: ArtworkData[] = [];

    try {
      artworks = await manager.getAllArtworks();
    } catch {
      artworks = [];
    }

    const baseUrl = getImageBaseUrl();
    const normalizedBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    const thumbnailsBase = normalizedBaseUrl
      ? `${normalizedBaseUrl}/thumbnails`
      : '/thumbnails';

    const items: ArtworkListItem[] = artworks.map((artwork) => {
      const hasThumbnail = Boolean(artwork.processing?.processedAt);
      return {
        slug: artwork.slug,
        title: artwork.title || artwork.slug,
        thumbnailUrl: hasThumbnail ? `${thumbnailsBase}/${artwork.slug}.png` : '',
        published: artwork.published !== false
      };
    });

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to list artworks'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
