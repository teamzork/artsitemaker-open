import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getBackupsPath, getContentPath } from '../../../lib/paths';

const execAsync = promisify(exec);
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/;

function resolveBackupFilePath(backupsPath: string, filename: string): string | null {
    const resolvedBackups = path.resolve(backupsPath);
    const resolvedFile = path.resolve(backupsPath, filename);

    if (!resolvedFile.startsWith(`${resolvedBackups}${path.sep}`)) {
        return null;
    }

    return resolvedFile;
}

function normalizeTarEntry(entry: string): string {
    return entry.replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
}

function validateBackupEntries(entries: string[]): { root: string } {
    if (entries.length === 0) {
        throw new Error('Backup archive is empty.');
    }

    let root = '';
    let hasSettings = false;

    for (const rawEntry of entries) {
        const normalized = normalizeTarEntry(rawEntry);
        if (!normalized) {
            continue;
        }

        if (normalized.startsWith('/')) {
            throw new Error('Backup archive contains absolute paths.');
        }

        const segments = normalized.split('/').filter(Boolean);
        if (segments.length === 0) {
            continue;
        }

        if (segments.includes('..')) {
            throw new Error('Backup archive contains unsafe paths.');
        }

        const entryRoot = segments[0];
        if (!root) {
            root = entryRoot;
        } else if (entryRoot !== root) {
            throw new Error('Backup archive must contain a single top-level folder.');
        }

        const relativePath = segments.slice(1).join('/');
        if (relativePath === 'settings.yaml' || relativePath === 'settings/settings.yaml') {
            hasSettings = true;
        }
    }

    if (!root) {
        throw new Error('Backup archive has no valid entries.');
    }

    if (!hasSettings) {
        throw new Error('Backup archive is missing settings.yaml.');
    }

    return { root };
}

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

async function clearContentDirectory(contentPath: string): Promise<void> {
    if (!existsSync(contentPath)) {
        await fs.mkdir(contentPath, { recursive: true });
        return;
    }

    const entries = await fs.readdir(contentPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.backup') || entry.name.startsWith('.')) {
            continue;
        }

        const entryPath = path.join(contentPath, entry.name);
        if (entry.isDirectory()) {
            await fs.rm(entryPath, { recursive: true });
        } else {
            await fs.unlink(entryPath);
        }
    }
}

async function copyDirSafe(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isSymbolicLink()) {
            throw new Error(`Backup contains unsupported symlink: ${entry.name}`);
        }

        if (entry.isDirectory()) {
            await copyDirSafe(srcPath, destPath);
        } else if (entry.isFile()) {
            await fs.copyFile(srcPath, destPath);
        } else {
            throw new Error(`Backup contains unsupported entry type: ${entry.name}`);
        }
    }
}

export const GET: APIRoute = async ({ params }) => {
    const { filename } = params;
    if (!filename) return new Response(null, { status: 404 });

    const backupsPath = getBackupsPath();
    const filePath = resolveBackupFilePath(backupsPath, filename);

    // Security check: ensure file is within backups folder
    if (!filePath) {
        return new Response('Forbidden', { status: 403 });
    }

    if (!existsSync(filePath)) {
        return new Response('Not found', { status: 404 });
    }

    // Stream file for download
    const stream = createReadStream(filePath);
    // @ts-ignore - ReadableStream/Node stream compat
    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${filename}"`
        }
    });
};

export const DELETE: APIRoute = async ({ params }) => {
    const { filename } = params;
    if (!filename) return new Response(null, { status: 404 });

    const backupsPath = getBackupsPath();
    const filePath = resolveBackupFilePath(backupsPath, filename);

    // Security check
    if (!filePath) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        await fs.unlink(filePath);
        return new Response(JSON.stringify({ success: true }), {
            status: 200
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to delete' }), {
            status: 500
        });
    }
};

export const POST: APIRoute = async ({ params }) => {
    const { filename } = params;
    if (!filename) return new Response(null, { status: 404 });

    if (!SAFE_FILENAME_REGEX.test(filename) || !filename.endsWith('.tar.gz')) {
        return new Response(JSON.stringify({ error: 'Invalid backup filename.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const backupsPath = getBackupsPath();
    const filePath = resolveBackupFilePath(backupsPath, filename);
    if (!filePath) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!existsSync(filePath)) {
        return new Response(JSON.stringify({ error: 'Backup not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { stdout } = await execAsync(`tar -tzf "${filePath}"`, { encoding: 'utf8' });
        const entries = stdout.split('\n').map((line: string) => line.trim()).filter(Boolean);

        try {
            validateBackupEntries(entries);
        } catch (error) {
            return new Response(JSON.stringify({
                error: error instanceof Error ? error.message : 'Backup validation failed.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let backupFile = '';
        try {
            backupFile = await createBackup();
        } catch (error) {
            console.warn('Backup failed, continuing with restore:', error);
        }

        const contentPath = getContentPath();
        const tempDir = path.join(backupsPath, `.restore-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(tempDir, { recursive: true });

        try {
            await execAsync(`tar -xzf "${filePath}" -C "${tempDir}" --strip-components=1`);
            await clearContentDirectory(contentPath);
            await copyDirSafe(tempDir, contentPath);
        } finally {
            if (existsSync(tempDir)) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            backupFile,
            filename,
            message: 'Backup restored successfully.'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Backup restore failed:', error);
        return new Response(JSON.stringify({
            error: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
