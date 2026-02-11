/**
 * YAML Manager Module
 * Handles reading and writing YAML content files (artworks, collections, settings)
 */

import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';

export interface ArtworkData {
    slug: string;
    title: string;
    year?: number;
    medium?: string;
    dimensions?: string;
    description?: string;
    collection?: string;
    tags: string[];
    sortOrder: number;
    sold: boolean;
    price: number | null;
    currency: string;
    inquireOnly: boolean;
    primary: string;
    additional: Array<{
        file: string;
        type: string;
        caption?: string;
    }>;
    processing?: {
        originalFile: string;
        originalDimensions: [number, number];
        processedAt: string;
        warnings: string[];
        aspectRatio: number;
        padded: boolean;
    };
    createdAt: string;
    updatedAt: string;
    published: boolean;
}

export interface CollectionData {
    slug: string;
    title: string;
    description?: string;
    sortOrder: number;
    cover?: string;
    visible: boolean;
}

export interface SettingsData {
    site: {
        title: string;
        tagline: string;
        url: string;
        imageBaseUrl: string;
        language: string;
    };
    seo: {
        description: string;
        keywords: string[];
        ogImage: string;
    };
    images: {
        sizes: {
            large: number;
            medium: number;
            small: number;
            thumb: number;
        };
        quality: number;
        maxAspectRatio: number;
        upscaleWarning: boolean;
    };
    git: {
        remote: string;
        branch: string;
        autoCommit: boolean;
        commitPrefix: string;
    };
    theme: string;
}

export class YamlManager {
    private contentPath: string;

    constructor(contentPath: string) {
        this.contentPath = contentPath;
    }

    // Artwork operations
    async getArtwork(slug: string): Promise<ArtworkData | null> {
        try {
            const filePath = path.join(this.contentPath, 'artworks', `${slug}.yaml`);
            const content = await fs.readFile(filePath, 'utf-8');
            return yaml.load(content) as ArtworkData;
        } catch {
            return null;
        }
    }

    async getAllArtworks(): Promise<ArtworkData[]> {
        const artworksPath = path.join(this.contentPath, 'artworks');
        const files = await fs.readdir(artworksPath);
        const artworks: ArtworkData[] = [];

        for (const file of files) {
            if (file.endsWith('.yaml')) {
                const slug = file.replace('.yaml', '');
                const artwork = await this.getArtwork(slug);
                if (artwork) artworks.push(artwork);
            }
        }

        return artworks.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    async saveArtwork(artwork: ArtworkData): Promise<void> {
        const filePath = path.join(this.contentPath, 'artworks', `${artwork.slug}.yaml`);
        const content = yaml.dump(artwork, { lineWidth: -1 });
        await fs.writeFile(filePath, content, 'utf-8');
    }

    async deleteArtwork(slug: string): Promise<void> {
        const filePath = path.join(this.contentPath, 'artworks', `${slug}.yaml`);
        await fs.unlink(filePath);
    }

    // Collection operations
    async getCollection(slug: string): Promise<CollectionData | null> {
        try {
            const filePath = path.join(this.contentPath, 'collections', `${slug}.yaml`);
            const content = await fs.readFile(filePath, 'utf-8');
            return yaml.load(content) as CollectionData;
        } catch {
            return null;
        }
    }

    async getAllCollections(): Promise<CollectionData[]> {
        const collectionsPath = path.join(this.contentPath, 'collections');

        try {
            const files = await fs.readdir(collectionsPath);
            const collections: CollectionData[] = [];

            for (const file of files) {
                if (file.endsWith('.yaml')) {
                    const slug = file.replace('.yaml', '');
                    const collection = await this.getCollection(slug);
                    if (collection) collections.push(collection);
                }
            }

            return collections.sort((a, b) => a.sortOrder - b.sortOrder);
        } catch {
            return [];
        }
    }

    async saveCollection(collection: CollectionData): Promise<void> {
        const filePath = path.join(this.contentPath, 'collections', `${collection.slug}.yaml`);
        const content = yaml.dump(collection, { lineWidth: -1 });
        await fs.writeFile(filePath, content, 'utf-8');
    }

    // Settings operations
    async getSettings(): Promise<SettingsData | null> {
        try {
            const filePath = path.join(this.contentPath, 'settings.yaml');
            const content = await fs.readFile(filePath, 'utf-8');
            return yaml.load(content) as SettingsData;
        } catch {
            return null;
        }
    }

    async saveSettings(settings: SettingsData): Promise<void> {
        const filePath = path.join(this.contentPath, 'settings.yaml');
        const content = yaml.dump(settings, { lineWidth: -1 });
        await fs.writeFile(filePath, content, 'utf-8');
    }
}

// Helper to create artwork from processing result
export function createArtworkFromProcessing(
    slug: string,
    title: string,
    processingResult: {
        originalFile: string;
        originalDimensions: [number, number];
        warnings: string[];
        aspectRatio: number;
        padded: boolean;
    }
): ArtworkData {
    const now = new Date().toISOString();

    return {
        slug,
        title,
        tags: [],
        sortOrder: 0,
        sold: false,
        price: null,
        currency: 'USD',
        inquireOnly: false,
        primary: `${slug}.webp`,
        additional: [],
        processing: {
            ...processingResult,
            processedAt: now
        },
        createdAt: now,
        updatedAt: now,
        published: true
    };
}
