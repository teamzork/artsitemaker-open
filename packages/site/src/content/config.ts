import { defineCollection, z } from 'astro:content';

// Artwork schema matching the spec
const artworksCollection = defineCollection({
    type: 'data',
    schema: z.object({
        slug: z.string(),
        title: z.string(),
        year: z.number().optional().nullable(),
        medium: z.string().optional().nullable(),
        dimensions: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        collection: z.string().optional().nullable(),
        tags: z.array(z.string()).default([]),
        sortOrder: z.number().default(0),
        sold: z.boolean().default(false),
        price: z.number().nullable().default(null),
        currency: z.string().default('USD'),
        inquireOnly: z.boolean().default(false),
        primary: z.string(),
        additional: z.array(z.union([
            z.string(),
            z.object({
                file: z.string(),
                type: z.string().optional(),
                title: z.string().optional(),
                caption: z.string().optional()
            })
        ])).default([]),
        processing: z.object({
            originalFile: z.string(),
            originalDimensions: z.array(z.number()),
            processedAt: z.string(),
            warnings: z.array(z.string()),
            aspectRatio: z.number(),
            padded: z.boolean()
        }).optional(),
        images: z.object({
            large: z.string(),
            medium: z.string(),
            small: z.string(),
            thumbnail: z.string(),
            original: z.string()
        }).optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
        published: z.boolean().default(true)
    })
});

// Collection schema for grouping artworks
const collectionsCollection = defineCollection({
    type: 'data',
    schema: z.object({
        slug: z.string(),
        title: z.string(),
        description: z.string().optional(),
        sortOrder: z.number().default(0),
        cover: z.string().optional(),
        visible: z.boolean().default(true)
    })
});

// Pages schema for about, contact, custom pages
const pagesCollection = defineCollection({
    type: 'data',
    schema: z.object({
        slug: z.string(),
        title: z.string(),
        template: z.string().optional(),
        pageType: z.string().optional(),
        sortOrder: z.number().default(0),
        showInNav: z.boolean().default(true),
        published: z.boolean().default(true),
        content: z.string(),
        featuredArtwork: z.string().optional(),
        featuredImage: z.string().optional()
    })
});

export const collections = {
    artworks: artworksCollection,
    collections: collectionsCollection,
    pages: pagesCollection
};
