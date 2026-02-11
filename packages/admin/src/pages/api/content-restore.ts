import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getContentPath, getBackupsPath, getRepoPath } from '../../lib/paths';

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

export const POST: APIRoute = async () => {
    try {
        const contentPath = getContentPath();
        const defaultContentPath = path.join(getRepoPath(), 'demo-site', 'user-data');

        // Verify default content exists
        if (!existsSync(defaultContentPath)) {
            return new Response(JSON.stringify({
                error: 'Default content not found. The demo-site folder may be missing.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create backup first
        let backupFile = '';
        try {
            backupFile = await createBackup();
        } catch (e) {
            console.warn('Backup failed, but continuing with restore:', e);
        }

        // Clear existing content (but keep the folder)
        if (existsSync(contentPath)) {
            const entries = await fs.readdir(contentPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(contentPath, entry.name);
                // Skip backup folders and hidden files
                if (entry.name.startsWith('.backup') || entry.name.startsWith('.')) {
                    continue;
                }
                if (entry.isDirectory()) {
                    await fs.rm(entryPath, { recursive: true });
                } else {
                    await fs.unlink(entryPath);
                }
            }
        } else {
            await fs.mkdir(contentPath, { recursive: true });
        }

        // Copy default content
        await copyDir(defaultContentPath, contentPath);

        return new Response(JSON.stringify({
            success: true,
            backupFile,
            message: 'Default content restored successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Restore failed:', error);
        return new Response(JSON.stringify({
            error: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
