#!/usr/bin/env node

/**
 * Image Migration Script
 * 
 * Migrates artwork YAML files from old image format to new storage-aware format.
 * 
 * Usage:
 *   node scripts/migrate-images.js [content-path]
 * 
 * This script:
 * 1. Scans artwork YAML files
 * 2. Converts old 'primary' field to new 'images' object
 * 3. Updates image URLs based on current storage configuration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrateArtworks(contentPath) {
    const artworksPath = path.join(contentPath, 'artworks');
    
    try {
        const files = await fs.readdir(artworksPath);
        const yamlFiles = files.filter(f => f.endsWith('.yaml'));
        
        console.log(`Found ${yamlFiles.length} artwork files to check`);
        
        let migrated = 0;
        let skipped = 0;
        
        for (const file of yamlFiles) {
            const filePath = path.join(artworksPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const artwork = yaml.load(content);
            
            // Check if already migrated
            if (artwork.images && typeof artwork.images === 'object') {
                skipped++;
                continue;
            }
            
            // Check if has old format
            if (!artwork.primary) {
                console.log(`⚠️  ${file}: No primary image field found`);
                skipped++;
                continue;
            }
            
            // Migrate to new format
            const slug = artwork.slug || path.basename(file, '.yaml');
            const baseUrl = process.env.LOCAL_IMAGES_URL || 'http://localhost:3001';
            
            artwork.images = {
                large: `${baseUrl}/large/${slug}.webp`,
                medium: `${baseUrl}/medium/${slug}.webp`,
                small: `${baseUrl}/small/${slug}.webp`,
                thumb: `${baseUrl}/thumbnails/${slug}.webp`
            };
            
            // Remove old fields
            delete artwork.primary;
            delete artwork.additional;
            
            // Add processing metadata if missing
            if (!artwork.processing) {
                artwork.processing = {
                    dimensions: { original: [0, 0], processed: [0, 0] },
                    warnings: [],
                    aspectRatio: 1,
                    padded: false
                };
            }
            
            // Update timestamp
            artwork.updatedAt = new Date().toISOString();
            
            // Write back
            await fs.writeFile(filePath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');
            
            console.log(`✅ ${file}: Migrated`);
            migrated++;
        }
        
        console.log(`\nMigration complete:`);
        console.log(`  Migrated: ${migrated} files`);
        console.log(`  Skipped: ${skipped} files`);
        
        if (migrated > 0) {
            console.log(`\n⚠️  Important: Re-upload your images through the admin panel to generate proper image variants.`);
        }
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Get content path from command line or use default
const contentPath = process.argv[2] || path.join(__dirname, '..', 'content');

console.log(`Migrating artworks in: ${contentPath}`);
migrateArtworks(contentPath);