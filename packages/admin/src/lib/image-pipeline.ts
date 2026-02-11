/**
 * Image Processing Pipeline
 * Central module for all Sharp-based image processing.
 * All image processing in the admin should use this module.
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { getFilesPath, getContentPath, getThumbnailsPath } from './paths';
import { createStorageProvider, type ImageUrls, type ImageVariants } from './storage';
import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_MIME_TYPES, isAllowedImageExtension } from './image-constants';

// ============================================================================
// Configuration
// ============================================================================

export interface ProcessingConfig {
    sizes: {
        large: number;   // e.g., 2400
        medium: number;  // e.g., 1200
        small: number;   // e.g., 600
        thumb: number;   // e.g., 150
    };
    quality: number;   // WebP quality 75-100
    maxAspectRatio: number;  // e.g., 3
}

export const DEFAULT_CONFIG: ProcessingConfig = {
    sizes: {
        large: 2400,
        medium: 1200,
        small: 600,
        thumb: 150
    },
    quality: 90,
    maxAspectRatio: 3
};

// ============================================================================
// Path Resolution
// ============================================================================

export function getDefaultPaths() {
    return {
        files: getFilesPath(),
        content: getContentPath(),
        thumbnails: getThumbnailsPath(),
        originals: path.join(getFilesPath(), 'originals')
    };
}

export interface OutputPaths {
    files: string;
    thumbnails: string;
}

export interface ProcessingResult {
    slug: string;
    urls: ImageUrls;  // Changed from files to urls
    dimensions: {
        original: [number, number];
        processed: [number, number];
    };
    warnings: string[];
    padded: boolean;
    aspectRatio: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateUpload(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
        return { valid: false, error: `Invalid file type: ${file.type}` };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB (max 50MB)` };
    }

    if (!isAllowedImageExtension(file.name, ALLOWED_IMAGE_EXTENSIONS)) {
        const ext = path.extname(file.name).toLowerCase();
        return { valid: false, error: `Invalid file extension: ${ext || 'unknown'}` };
    }

    return { valid: true };
}

export function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
        .replace(/[^a-z0-9]+/g, '-')       // Replace non-alphanumeric
        .replace(/^-+|-+$/g, '')           // Trim hyphens
        .substring(0, 80);                  // Limit length
}

export async function processImage(
    inputPath: string,
    slug: string,
    config: ProcessingConfig,
    outputPaths: { files: string; thumbnails: string }
): Promise<ProcessingResult> {
    const warnings: string[] = [];

    // 1. Read original
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // 2. Calculate aspect ratio
    const aspectRatio = width / height;
    const needsPadding = aspectRatio > config.maxAspectRatio ||
        aspectRatio < (1 / config.maxAspectRatio);

    // 3. Check if upscaling needed
    if (width < config.sizes.large) {
        warnings.push('upscaled');
    }

    if (needsPadding) {
        warnings.push('padded');
    }

    const files: Record<string, string> = {};

    // 4. Generate each size
    for (const [sizeName, targetWidth] of Object.entries(config.sizes)) {
        let processed = sharp(inputPath);

        // Resize
        processed = processed.resize(targetWidth, undefined, {
            withoutEnlargement: false,
            fit: 'inside'
        });

        // Output format and path
        const isThumb = sizeName === 'thumb';
        const ext = isThumb ? 'png' : 'webp';
        const outputDir = isThumb ? outputPaths.thumbnails : path.join(outputPaths.files, sizeName);
        const outputPath = path.join(outputDir, `${slug}.${ext}`);

        // Ensure directory exists
        await fs.mkdir(outputDir, { recursive: true });

        // Save file
        if (isThumb) {
            await processed.png().toFile(outputPath);
        } else {
            await processed.webp({ quality: config.quality }).toFile(outputPath);
        }

        files[sizeName] = `${slug}.${ext}`;
    }

    return {
        slug,
        urls: files as any, // This is basically mapping size names to filenames
        dimensions: {
            original: [width, height],
            processed: [config.sizes.large, Math.round(config.sizes.large / aspectRatio)]
        },
        warnings,
        padded: needsPadding,
        aspectRatio
    };
}

export async function runImagePipeline(
    originalsPath: string,
    outputPaths: { files: string; thumbnails: string },
    config: ProcessingConfig
): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    // Scan originals folder
    const files = await fs.readdir(originalsPath);
    const imageFiles = files.filter((file) =>
        isAllowedImageExtension(file, ALLOWED_IMAGE_EXTENSIONS)
    );

    for (const file of imageFiles) {
        const inputPath = path.join(originalsPath, file);
        const slug = slugify(path.basename(file, path.extname(file)));

        try {
            const result = await processImage(inputPath, slug, config, outputPaths);
            results.push(result);
        } catch (error) {
            console.error(`Failed to process ${file}:`, error);
        }
    }

    return results;
}

// ============================================================================
// Buffer-based Processing (for direct uploads without saving original first)
// ============================================================================

/**
 * Generate all size variants from an image buffer and upload to storage.
 * This is the main function for processing uploaded images.
 */
export async function processImageFromBuffer(
    buffer: Buffer,
    slug: string,
    config: ProcessingConfig = DEFAULT_CONFIG
): Promise<ProcessingResult> {
    const warnings: string[] = [];

    // Get metadata from buffer
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Calculate aspect ratio
    const aspectRatio = width / height;
    const needsPadding = aspectRatio > config.maxAspectRatio ||
        aspectRatio < (1 / config.maxAspectRatio);

    // Check if upscaling needed
    if (width < config.sizes.large) {
        warnings.push('upscaled');
    }

    if (needsPadding) {
        warnings.push('padded');
    }

    // Generate all image variants as buffers
    const variants: ImageVariants = {
        large: await processVariant(buffer, config.sizes.large, config.quality),
        medium: await processVariant(buffer, config.sizes.medium, config.quality),
        small: await processVariant(buffer, config.sizes.small, config.quality),
        thumb: await processVariant(buffer, config.sizes.thumb, config.quality, 'png'),
        original: buffer, // Keep original for backup
    };

    // Upload to configured storage
    const storage = await createStorageProvider();
    const urls = await storage.uploadImages(slug, variants);

    return {
        slug,
        urls,
        dimensions: {
            original: [width, height],
            processed: [config.sizes.large, Math.round(config.sizes.large / aspectRatio)]
        },
        warnings,
        padded: needsPadding,
        aspectRatio
    };
}

/**
 * Process a single image variant
 */
async function processVariant(
    buffer: Buffer,
    targetWidth: number,
    quality: number,
    format: 'webp' | 'png' = 'webp'
): Promise<Buffer> {
    let processed = sharp(buffer);

    // Resize
    processed = processed.resize(targetWidth, undefined, {
        withoutEnlargement: false,
        fit: 'inside'
    });

    // Convert to target format
    if (format === 'png') {
        return processed.png().toBuffer();
    } else {
        return processed.webp({ quality }).toBuffer();
    }
}

/**
 * Generate sizes from an existing file path.
 * This reads the file into a buffer and uses the storage-aware processImageFromBuffer.
 */
export async function generateSizesFromPath(
    inputPath: string,
    slug: string,
    config: ProcessingConfig = DEFAULT_CONFIG
): Promise<ProcessingResult> {
    const buffer = await fs.readFile(inputPath);
    return processImageFromBuffer(buffer, slug, config);
}
