import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getContentPath, getBackupsPath } from '../../lib/paths';
import { resolveUserPath } from '../../lib/path-utils';

const execAsync = promisify(exec);

// Helper to create a backup before modifying content
async function createBackup(): Promise<string> {
    const backupsPath = getBackupsPath();
    if (!existsSync(backupsPath)) {
        await fs.mkdir(backupsPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `content-backup-${timestamp}.tar.gz`;
    const destPath = path.join(backupsPath, filename);

    const contentPath = getContentPath();
    await execAsync(`tar -czf "${destPath}" -C "${path.dirname(contentPath)}" "${path.basename(contentPath)}"`);

    return filename;
}

// Helper to copy directory recursively
async function copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

// Validate that source folder has expected content structure
async function validateSourceFolder(sourcePath: string): Promise<{ valid: boolean; error?: string }> {
    // Check if folder exists
    if (!existsSync(sourcePath)) {
        return { valid: false, error: `Source folder not found: ${sourcePath}` };
    }

    // Check for required files/folders
    // Must have settings.yaml in settings/ folder
    const requiredItems = ['settings/settings.yaml'];
    const optionalFolders = ['artworks', 'pages', 'collections'];

    for (const item of requiredItems) {
        if (!existsSync(path.join(sourcePath, item))) {
            return { valid: false, error: `Required file missing: ${item}` };
        }
    }

    // Should have at least one content folder
    const hasContentFolder = optionalFolders.some(folder =>
        existsSync(path.join(sourcePath, folder))
    );

    if (!hasContentFolder) {
        return { valid: false, error: 'No content folders found (artworks, pages, or collections)' };
    }

    return { valid: true };
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { sourcePath: rawSourcePath, mode = 'replace' } = body;

        if (!rawSourcePath) {
            return new Response(JSON.stringify({ error: 'Source path is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Resolve the path (handle ~ and relative paths)
        const sourcePath = resolveUserPath(rawSourcePath);
        const contentPath = getContentPath();

        // Prevent importing from the same location
        if (path.resolve(sourcePath) === path.resolve(contentPath)) {
            return new Response(JSON.stringify({
                error: 'Source path cannot be the same as the current content path'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate source folder structure
        const validation = await validateSourceFolder(sourcePath);
        if (!validation.valid) {
            return new Response(JSON.stringify({ error: validation.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create backup first
        let backupFile = '';
        try {
            backupFile = await createBackup();
        } catch (e) {
            console.warn('Backup failed, but continuing with import:', e);
        }

        if (mode === 'replace') {
            // Clear existing content (but keep backups and hidden files)
            if (existsSync(contentPath)) {
                const entries = await fs.readdir(contentPath, { withFileTypes: true });
                for (const entry of entries) {
                    const entryPath = path.join(contentPath, entry.name);
                    if (entry.name.startsWith('.backup') || entry.name.startsWith('.')) {
                        continue;
                    }
                    if (entry.isDirectory()) {
                        await fs.rm(entryPath, { recursive: true });
                    } else {
                        await fs.unlink(entryPath);
                    }
                }
            }
        }

        // Copy source content to destination
        await copyDir(sourcePath, contentPath);

        return new Response(JSON.stringify({
            success: true,
            backupFile,
            sourcePath,
            mode,
            message: `Content ${mode === 'replace' ? 'replaced' : 'merged'} successfully`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Import failed:', error);
        return new Response(JSON.stringify({
            error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
