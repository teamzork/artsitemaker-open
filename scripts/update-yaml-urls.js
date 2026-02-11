/**
 * Update YAML files to use R2 image URLs
 * 
 * This script updates artwork YAML files to add full R2 URLs
 * for all image references.
 * 
 * Usage:
 *   cd scripts
 *   node update-yaml-urls.js
 * 
 * Environment variables required (from ../.env):
 *   R2_PUBLIC_URL, USER_NAMESPACE
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const REPO_ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(REPO_ROOT, 'content', 'artworks');
const BACKUP_DIR = path.join(REPO_ROOT, 'content', '.backup-' + Date.now());
const R2_BASE_URL = `${process.env.R2_PUBLIC_URL}/${process.env.USER_NAMESPACE}`;

async function backupFile(filePath, backupDir) {
    const relativePath = path.relative(CONTENT_DIR, filePath);
    const backupPath = path.join(backupDir, relativePath);

    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
}

async function updateYamlFile(filePath, backupDir) {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.load(content);

    if (!data.slug) {
        return { updated: false, reason: 'No slug found' };
    }

    const slug = data.slug;
    const changes = [];

    // Add images object with R2 URLs
    if (!data.images) {
        data.images = {};
    }

    // Set R2 URLs for all sizes
    const sizes = ['large', 'medium', 'small'];

    for (const size of sizes) {
        // Determine extension - processed images are .webp
        const ext = 'webp';
        const newUrl = `${R2_BASE_URL}/${size}/${slug}.${ext}`;

        if (data.images[size] !== newUrl) {
            changes.push(`${size}: ${data.images[size] || 'none'} → ${newUrl}`);
            data.images[size] = newUrl;
        }
    }

    // Thumbnail (PNG format)
    const thumbnailUrl = `${R2_BASE_URL}/thumbnails/${slug}.png`;
    if (data.images.thumbnail !== thumbnailUrl) {
        changes.push(`thumbnail: ${data.images.thumbnail || 'none'} → ${thumbnailUrl}`);
        data.images.thumbnail = thumbnailUrl;
    }

    // Original - check manifest or use the originalFile extension
    let originalExt = 'jpg';
    if (data.processing && data.processing.originalFile) {
        originalExt = path.extname(data.processing.originalFile).slice(1) || 'jpg';
    }

    // Check if original exists in our upload
    const manifestPath = path.join(__dirname, 'migration-manifest.json');
    try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        const originalUpload = manifest.uploads.find(u =>
            u.r2Key.includes(`originals/${slug}.`)
        );
        if (originalUpload) {
            originalExt = path.extname(originalUpload.localPath).slice(1);
        }
    } catch (e) {
        // Manifest not found, use default
    }

    const originalUrl = `${R2_BASE_URL}/originals/${slug}.${originalExt}`;
    if (data.images.original !== originalUrl) {
        changes.push(`original: ${data.images.original || 'none'} → ${originalUrl}`);
        data.images.original = originalUrl;
    }

    if (changes.length === 0) {
        return { updated: false, reason: 'No changes needed' };
    }

    // Backup original file
    await backupFile(filePath, backupDir);

    // Write updated YAML
    const newContent = yaml.dump(data, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        quotingType: "'",
        forceQuotes: false
    });

    await fs.writeFile(filePath, newContent, 'utf-8');

    return { updated: true, changes };
}

async function updateAllYaml() {
    console.log(chalk.blue.bold('\n📝 Updating YAML files with R2 URLs\n'));
    console.log(`Content directory: ${CONTENT_DIR}`);
    console.log(`R2 base URL: ${R2_BASE_URL}`);
    console.log(`Backup directory: ${BACKUP_DIR}\n`);

    // Create backup directory
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const files = await fs.readdir(CONTENT_DIR);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    console.log(`Found ${yamlFiles.length} YAML files\n`);

    const report = {
        total: yamlFiles.length,
        updated: 0,
        skipped: 0,
        errors: 0,
        details: []
    };

    for (const file of yamlFiles) {
        const filePath = path.join(CONTENT_DIR, file);

        try {
            const result = await updateYamlFile(filePath, BACKUP_DIR);

            if (result.updated) {
                report.updated++;
                console.log(chalk.green(`✓ ${file}`));
                result.changes.forEach(change => {
                    console.log(chalk.gray(`  ${change}`));
                });
                report.details.push({ file, status: 'updated', changes: result.changes });
            } else {
                report.skipped++;
                console.log(chalk.yellow(`- ${file} (${result.reason})`));
                report.details.push({ file, status: 'skipped', reason: result.reason });
            }
        } catch (error) {
            report.errors++;
            console.error(chalk.red(`✗ ${file} - ${error.message}`));
            report.details.push({ file, status: 'error', error: error.message });
        }
    }

    // Save report
    const reportPath = path.join(__dirname, 'yaml-update-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(chalk.green.bold('\n✅ Update Complete!\n'));
    console.log(`Total: ${report.total}`);
    console.log(chalk.green(`Updated: ${report.updated}`));
    console.log(chalk.yellow(`Skipped: ${report.skipped}`));
    console.log(chalk.red(`Errors: ${report.errors}`));
    console.log(`\nBackups saved to: ${BACKUP_DIR}`);
    console.log(`Report saved to: ${reportPath}\n`);

    if (report.errors > 0) {
        console.log(chalk.yellow('⚠️  Some files had errors. Check report for details.'));
        process.exit(1);
    }
}

updateAllYaml().catch(error => {
    console.error(chalk.red('Update failed:'), error);
    process.exit(1);
});
