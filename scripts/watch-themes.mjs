#!/usr/bin/env node
/**
 * Theme File Watcher
 * 
 * Automatically syncs theme files from /themes/ to /packages/site/public/themes/
 * during development. Uses chokidar for efficient file watching.
 */

import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const THEMES_SRC = path.join(projectRoot, 'themes');
const THEMES_DEST = path.join(projectRoot, 'packages/site/public/themes');

// Track sync operations for debounce logging
let pendingSyncs = new Map();
let syncTimeout = null;

/**
 * Get current timestamp for logging
 */
function timestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

/**
 * Log a sync operation
 */
function logSync(filePath, operation = 'synced') {
    const relativePath = path.relative(THEMES_SRC, filePath);
    const themeName = relativePath.split(path.sep)[0];
    const fileName = path.basename(filePath);
    
    const key = `${themeName}/${fileName}`;
    pendingSyncs.set(key, { themeName, fileName, operation, time: timestamp() });
    
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        for (const [key, info] of pendingSyncs) {
            const icon = info.operation === 'removed' ? '✗' : '✓';
            console.log(`${icon} ${info.operation} ${info.themeName}/${info.fileName} (${info.time})`);
        }
        pendingSyncs.clear();
    }, 100);
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        // Directory might already exist
    }
}

/**
 * Copy file from source to destination (preserves exact content, no formatting)
 */
async function copyFile(srcPath, destPath) {
    try {
        await ensureDir(path.dirname(destPath));
        
        // Read source file exactly as-is (preserving all whitespace, line endings, etc.)
        const content = await fs.readFile(srcPath);
        
        // Write to destination without any modification
        await fs.writeFile(destPath, content);
        
        // Verify copy succeeded by comparing sizes
        const srcStat = await fs.stat(srcPath);
        const destStat = await fs.stat(destPath);
        
        if (srcStat.size !== destStat.size) {
            console.error(`✗ Size mismatch: ${srcPath} (${srcStat.size} vs ${destStat.size})`);
            return false;
        }
        
        return true;
    } catch (err) {
        console.error(`✗ Failed to copy ${srcPath}: ${err.message}`);
        return false;
    }
}

/**
 * Remove file from destination
 */
async function removeFile(destPath) {
    try {
        await fs.unlink(destPath);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Calculate destination path for a source file
 */
function getDestPath(srcPath) {
    const relativePath = path.relative(THEMES_SRC, srcPath);
    return path.join(THEMES_DEST, relativePath);
}

/**
 * Sync a single file
 */
async function syncFile(srcPath) {
    // Skip content assets (fonts, logos, textures)
    if (srcPath.includes('/fonts/') || srcPath.includes('/logos/') || srcPath.includes('/textures/')) {
        return;
    }
    if (srcPath.endsWith('.woff2') || srcPath.endsWith('.woff') || srcPath.endsWith('.ttf')) {
        return;
    }
    // Skip recommended-assets
    if (srcPath.includes('/recommended-assets/')) {
        return;
    }
    
    const destPath = getDestPath(srcPath);
    const success = await copyFile(srcPath, destPath);
    if (success) {
        logSync(srcPath, 'synced');
    }
}

/**
 * Remove a synced file
 */
async function unsyncFile(srcPath) {
    const destPath = getDestPath(srcPath);
    const success = await removeFile(destPath);
    if (success) {
        logSync(srcPath, 'removed');
    }
}

/**
 * Perform initial sync
 */
async function initialSync() {
    console.log('🔄 Performing initial theme sync...\n');
    
    const { execSync } = await import('child_process');
    try {
        execSync('./scripts/sync-themes.sh', { 
            cwd: projectRoot,
            stdio: 'inherit'
        });
    } catch (err) {
        console.error('Initial sync failed:', err.message);
    }
}

/**
 * Start the file watcher
 */
async function startWatcher() {
    console.log('\n👀 Starting theme file watcher...\n');
    console.log(`Watching: ${THEMES_SRC}`);
    console.log(`Output:   ${THEMES_DEST}`);
    console.log('');

    // Watch all files in themes directory
    const watcher = chokidar.watch(THEMES_SRC, {
        ignored: [
            /node_modules/,
            /\.git/,
            /recommended-assets/,
            /fonts/,
            /logos/,
            /textures/,
            /\.woff2$/,
            /\.woff$/,
            /\.ttf$/
        ],
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 50
        },
        persistent: true
    });

    // Handle file changes
    watcher.on('change', async (filePath) => {
        await syncFile(filePath);
    });

    // Handle new files
    watcher.on('add', async (filePath) => {
        await syncFile(filePath);
    });

    // Handle file removals
    watcher.on('unlink', async (filePath) => {
        await unsyncFile(filePath);
    });

    // Handle errors
    watcher.on('error', (error) => {
        console.error('Watcher error:', error);
    });

    // Handle ready state
    watcher.on('ready', () => {
        console.log('✓ Watcher ready. Edit theme files to see changes instantly.\n');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Stopping theme watcher...');
        await watcher.close();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await watcher.close();
        process.exit(0);
    });
}

// Main entry point
async function main() {
    try {
        await fs.access(THEMES_SRC);
    } catch {
        console.error(`✗ Themes directory not found: ${THEMES_SRC}`);
        process.exit(1);
    }

    await initialSync();
    await startWatcher();
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
