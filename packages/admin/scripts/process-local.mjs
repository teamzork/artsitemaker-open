
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// We are in packages/admin/scripts/
const ROOT = path.join(__dirname, '../../..');
const ORIGINALS_DIR = path.join(ROOT, 'files/originals');
const PROCESSED_DIR = path.join(ROOT, 'files');
const CONTENT_DIR = path.join(ROOT, 'content/artworks');
const THUMBNAILS_DIR = path.join(ROOT, 'thumbnails');

const CONFIG = {
    sizes: {
        large: 2400,
        medium: 1200,
        small: 600,
        thumb: 150
    },
    quality: 90,
    maxAspectRatio: 3
};

function slugify(input) {
    return input
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
}

async function processImages() {
    console.log('Starting image processing from Admin context...');
    console.log('Root:', ROOT);

    // Ensure dirs exist
    for (const size of Object.keys(CONFIG.sizes)) {
        const dir = size === 'thumb' ? THUMBNAILS_DIR : path.join(PROCESSED_DIR, size);
        await fs.mkdir(dir, { recursive: true });
    }

    const files = await fs.readdir(ORIGINALS_DIR);
    const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    console.log(`Found ${images.length} images.`);

    for (const file of images) {
        const inputPath = path.join(ORIGINALS_DIR, file);
        const name = path.basename(file, path.extname(file));
        const slug = slugify(name);

        console.log(`Processing ${slug}...`);

        const image = sharp(inputPath);
        const metadata = await image.metadata();
        const aspectRatio = metadata.width / metadata.height;

        // Generate sizes
        for (const [size, width] of Object.entries(CONFIG.sizes)) {
            const isThumb = size === 'thumb';
            const outputDir = isThumb ? THUMBNAILS_DIR : path.join(PROCESSED_DIR, size);
            const ext = isThumb ? 'png' : 'webp';
            const outputPath = path.join(outputDir, `${slug}.${ext}`);

            let pipeline = sharp(inputPath).resize(width, undefined, {
                withoutEnlargement: false,
                fit: 'inside'
            });

            if (isThumb) {
                await pipeline.png().toFile(outputPath);
            } else {
                await pipeline.webp({ quality: CONFIG.quality }).toFile(outputPath);
            }
        }

        // Update YAML
        const yamlPath = path.join(CONTENT_DIR, `${slug}.yaml`);
        try {
            const content = await fs.readFile(yamlPath, 'utf-8');
            const data = yaml.load(content);

            data.primary = `${slug}.webp`;
            data.processing = {
                originalFile: file,
                originalDimensions: [metadata.width, metadata.height],
                processedAt: new Date().toISOString(),
                aspectRatio
            };

            await fs.writeFile(yamlPath, yaml.dump(data), 'utf-8');
            console.log(`Updated YAML for ${slug}`);
        } catch (e) {
            console.log(`No YAML found for ${slug}, skipping update.`);
        }
    }

    console.log('Done!');
}

processImages().catch(console.error);
