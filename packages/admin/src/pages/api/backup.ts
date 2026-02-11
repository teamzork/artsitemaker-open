import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getContentPath, getBackupsPath } from '../../lib/paths';

const execAsync = promisify(exec);

export const GET: APIRoute = async () => {
    try {
        if (!existsSync(getBackupsPath())) {
            await fs.mkdir(getBackupsPath(), { recursive: true });
        }

        const files = await fs.readdir(getBackupsPath());
        const backups = await Promise.all(
            files
                .filter(f => f.endsWith('.tar.gz'))
                .map(async (f) => {
                    const stats = await fs.stat(path.join(getBackupsPath(), f));
                    return {
                        filename: f,
                        createdAt: stats.birthtime,
                        size: stats.size
                    };
                })
        );

        // Sort newest first
        backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return new Response(JSON.stringify(backups), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to list backups' }), {
            status: 500
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!existsSync(getBackupsPath())) {
            await fs.mkdir(getBackupsPath(), { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `content-backup-${timestamp}.tar.gz`;
        const destPath = path.join(getBackupsPath(), filename);

        // Create backup using tar
        // -c: create, -z: compress (gzip), -f: file
        // -C: change dir (so paths in archive are relative to content root)
        const contentPath = getContentPath();
        await execAsync(`tar -czf "${destPath}" -C "${path.dirname(contentPath)}" "${path.basename(contentPath)}"`);

        // Check rotation (keep last 52 weekly backups + manual ones, but for now let's just keep last 50 total to prevent infinite growth)
        const files = await fs.readdir(getBackupsPath());
        const backups = await Promise.all(
            files
                .filter(f => f.endsWith('.tar.gz'))
                .map(async (f) => ({
                    name: f,
                    time: (await fs.stat(path.join(getBackupsPath(), f))).mtime.getTime()
                }))
        );

        if (backups.length > 52) {
            backups.sort((a, b) => a.time - b.time); // Oldest first
            const toDelete = backups.slice(0, backups.length - 52);
            for (const backup of toDelete) {
                await fs.unlink(path.join(getBackupsPath(), backup.name));
            }
        }

        return new Response(JSON.stringify({ success: true, filename }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Backup failed:', error);
        return new Response(JSON.stringify({ error: 'Backup failed' }), {
            status: 500
        });
    }
};
