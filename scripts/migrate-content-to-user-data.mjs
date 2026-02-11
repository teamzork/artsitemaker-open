#!/usr/bin/env node
/**
 * Migration Tool: content/ → user-data/
 * 
 * Usage:
 *   pnpm migrate:user-data [options]
 * 
 * Options:
 *   --project <path>  Site project path (default: current directory)
 *   --dry-run         Preview changes without making them
 *   --no-backup       Skip backup creation (not recommended)
 *   --force           Overwrite existing user-data/ directory
 */

import fs from 'fs/promises';
import { existsSync, cpSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Dynamic import for yaml to handle package resolution
async function loadYaml() {
    try {
        // Try loading from admin package node_modules
        const yamlModule = await import('../packages/admin/node_modules/js-yaml/dist/js-yaml.mjs');
        return yamlModule.default || yamlModule;
    } catch {
        // Fallback: try site package
        const yamlModule = await import('../packages/site/node_modules/js-yaml/dist/js-yaml.mjs');
        return yamlModule.default || yamlModule;
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    return {
        projectPath: getArgValue(args, '--project') || process.cwd(),
        dryRun: args.includes('--dry-run'),
        noBackup: args.includes('--no-backup'),
        force: args.includes('--force'),
        help: args.includes('--help') || args.includes('-h')
    };
}

// Main migration function
async function migrate(options) {
    const yaml = await loadYaml();
    const { projectPath, dryRun, noBackup, force } = options;

    console.log('🔄 Content → User-Data Migration Tool\n');

    if (dryRun) {
        console.log('📋 DRY RUN MODE - No changes will be made\n');
    }

    // Resolve paths
    const contentPath = path.join(projectPath, 'content');
    const userDataPath = path.join(projectPath, 'user-data');
    const configPath = path.join(projectPath, 'artis.config.yaml');
    const backupsPath = path.join(projectPath, 'backups');

    // Step 1: Validate preconditions
    console.log('Step 1: Checking preconditions...');

    if (!existsSync(contentPath)) {
        console.log('❌ No content/ directory found. Nothing to migrate.');
        console.log(`   Looked in: ${projectPath}`);
        process.exit(1);
    }

    if (existsSync(userDataPath) && !force) {
        console.log('❌ user-data/ already exists!');
        console.log('   Use --force to overwrite (data will be lost)');
        console.log('   Or manually remove user-data/ first');
        process.exit(1);
    }

    console.log(`   ✓ Found content/ at: ${contentPath}`);

    // Step 2: Create backup
    if (!noBackup) {
        console.log('\nStep 2: Creating backup...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupDir = path.join(backupsPath, `content-backup-${timestamp}`);

        if (dryRun) {
            console.log(`   Would create backup at: ${backupDir}`);
        } else {
            await fs.mkdir(backupsPath, { recursive: true });
            cpSync(contentPath, backupDir, { recursive: true });
            console.log(`   ✓ Backup created: ${backupDir}`);
        }
    } else {
        console.log('\nStep 2: Skipping backup (--no-backup)');
    }

    // Step 3: Rename directory
    console.log('\nStep 3: Renaming content/ → user-data/...');

    if (dryRun) {
        console.log(`   Would rename: ${contentPath}`);
        console.log(`   To: ${userDataPath}`);
    } else {
        if (existsSync(userDataPath) && force) {
            rmSync(userDataPath, { recursive: true });
            console.log('   ✓ Removed existing user-data/ (--force)');
        }
        await fs.rename(contentPath, userDataPath);
        console.log(`   ✓ Renamed to: ${userDataPath}`);
    }

    // Step 4: Update config file
    console.log('\nStep 4: Updating artis.config.yaml...');

    if (existsSync(configPath)) {
        if (dryRun) {
            console.log('   Would update config:');
            console.log('   - Change contentPath → userDataPath');
            console.log('   - Update path to point to user-data/');
        } else {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = yaml.load(configContent);

            // Update config
            if (config.contentPath) {
                config.userDataPath = config.contentPath.replace(/\/content\/?$/, '/user-data');
                delete config.contentPath;
            }

            // Write updated config
            const newConfigContent = yaml.dump(config, { lineWidth: -1 });
            await fs.writeFile(configPath, `# Artis Site Configuration\n${newConfigContent}`);
            console.log('   ✓ Config updated');
        }
    } else {
        console.log('   ⚠ No artis.config.yaml found (skipping)');
    }

    // Step 5: Validate migration
    console.log('\nStep 5: Validating migration...');

    if (!dryRun) {
        const hasUserData = existsSync(userDataPath);
        const hasSettings = existsSync(path.join(userDataPath, 'settings.yaml'));
        const hasArtworks = existsSync(path.join(userDataPath, 'artworks'));

        if (hasUserData && hasSettings) {
            console.log('   ✓ user-data/ directory exists');
            console.log('   ✓ settings.yaml found');
            if (hasArtworks) console.log('   ✓ artworks/ directory found');
        } else {
            console.log('   ⚠ Validation warnings - please check manually');
        }
    } else {
        console.log('   (Skipped in dry-run mode)');
    }

    // Done
    console.log('\n' + '─'.repeat(50));
    if (dryRun) {
        console.log('✅ Dry run complete. Run without --dry-run to apply changes.');
    } else {
        console.log('✅ Migration complete!');
        console.log('\nNext steps:');
        console.log('   1. Test your site: pnpm dev:site');
        console.log('   2. Test admin panel: pnpm dev:admin');
        if (!noBackup) {
            console.log('   3. After verification, you can delete the backup');
        }
        console.log('\nIf using Git, commit the changes:');
        console.log('   git add user-data/ artis.config.yaml');
        console.log('   git rm -r content/');
        console.log('   git commit -m "Migrate content/ to user-data/"');
    }
}

// Show help
function showHelp() {
    console.log(`
Content → User-Data Migration Tool

USAGE:
  pnpm migrate:user-data [options]

OPTIONS:
  --project <path>  Path to site project (default: current directory)
  --dry-run         Preview changes without making them
  --no-backup       Skip backup creation (not recommended)
  --force           Overwrite existing user-data/ directory
  --help, -h        Show this help message

EXAMPLES:
  pnpm migrate:user-data                    # Migrate in current directory
  pnpm migrate:user-data --dry-run          # Preview changes
  pnpm migrate:user-data --project ~/site   # Migrate specific project

WHAT THIS DOES:
  1. Creates backup of content/ in backups/
  2. Renames content/ → user-data/
  3. Updates artis.config.yaml (contentPath → userDataPath)
  4. Validates the migration

ROLLBACK:
  If something goes wrong, restore from backup:
    rm -rf user-data
    cp -r backups/content-backup-TIMESTAMP content

For Git users, use 'git mv' instead for better history:
    git mv content user-data
    # Then manually update artis.config.yaml
`);
}

// Helper function
function getArgValue(args, flag) {
    const index = args.indexOf(flag);
    if (index !== -1 && args[index + 1]) {
        return args[index + 1];
    }
    return null;
}

// Run
const options = parseArgs();
if (options.help) {
    showHelp();
} else {
    migrate(options).catch(err => {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    });
}
