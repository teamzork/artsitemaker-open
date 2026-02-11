// packages/admin/scripts/process-sample-images.mjs

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// We are in packages/admin/scripts/
const ROOT = path.join(__dirname, '../../..');
const DEMO_ORIGINALS = path.join(ROOT, 'demo-site/files/originals');
const DEMO_FILES = path.join(ROOT, 'demo-site/files');

const CONFIG = {
    sizes: {
        large: 2400,
        medium: 1200,
        small: 600,
        thumb: 150
    },
    quality: 90
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
    console.log('🎨 Processing demo images...');
    console.log(`📂 Source: ${DEMO_ORIGINALS}`);
    console.log(`📂 Output: ${DEMO_FILES}`);
    console.log('');

    // Check if source directory exists
    try {
        await fs.access(DEMO_ORIGINALS);
    } catch (error) {
        console.error(`❌ Source directory not found: ${DEMO_ORIGINALS}`);
        process.exit(1);
    }

    // Ensure output directories exist
    for (const size of Object.keys(CONFIG.sizes)) {
        const dir = path.join(DEMO_FILES, size);
        await fs.mkdir(dir, { recursive: true });
    }

    // Find all image files
    const files = await fs.readdir(DEMO_ORIGINALS);
    const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    if (images.length === 0) {
        console.log('⚠️  No images found in the originals directory.');
        process.exit(0);
    }

    console.log(`📷 Found ${images.length} image(s) to process\n`);

    let processed = 0;
    let failed = 0;

    for (const file of images) {
        const inputPath = path.join(DEMO_ORIGINALS, file);
        const name = path.basename(file, path.extname(file));
        const slug = slugify(name);

        console.log(`⚙️  Processing: ${file}`);
        console.log(`   Slug: ${slug}`);

        try {
            const image = sharp(inputPath);
            const metadata = await image.metadata();
            const aspectRatio = metadata.width / metadata.height;

            console.log(`   Original size: ${metadata.width}x${metadata.height}`);
            console.log(`   Aspect ratio: ${aspectRatio.toFixed(2)}`);

            // Generate each size
            for (const [sizeName, targetWidth] of Object.entries(CONFIG.sizes)) {
                const isThumb = sizeName === 'thumb';
                const ext = isThumb ? 'png' : 'webp';
                const outputDir = path.join(DEMO_FILES, sizeName);
                const outputPath = path.join(outputDir, `${slug}.${ext}`);

                let pipeline = sharp(inputPath).resize(targetWidth, undefined, {
                    withoutEnlargement: false,
                    fit: 'inside'
                });

                if (isThumb) {
                    await pipeline.png().toFile(outputPath);
                } else {
                    await pipeline.webp({ quality: CONFIG.quality }).toFile(outputPath);
                }

                console.log(`   ✓ ${sizeName}: ${outputPath.replace(ROOT, '.')}`);
            }

            processed++;
            console.log(`   ✅ Done!\n`);

        } catch (error) {
            console.error(`   ❌ Failed: ${error.message}\n`);
            failed++;
        }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Successfully processed: ${processed}`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

processImages().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
