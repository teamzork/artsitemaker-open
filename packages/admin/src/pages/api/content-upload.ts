
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getContentPath, getBackupsPath } from '../../lib/paths';
import { getSettingsFilePath } from '../../lib/config-paths';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        // Support multiple files
        const files = formData.getAll('file') as File[];
        const mode = formData.get('mode') as string || 'replace';

        if (!files || files.length === 0) {
            return new Response(JSON.stringify({ error: 'No files uploaded' }), { status: 400 });
        }

        const contentPath = getContentPath();
        const backupPath = getBackupsPath();

        // Ensure dirs exist
        if (!existsSync(backupPath)) await fs.mkdir(backupPath, { recursive: true });

        // Create backup once for the batch
        let backupFile = '';
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            backupFile = `content-backup-pre-upload-${timestamp}.tar.gz`;
            const destPath = path.join(backupPath, backupFile);
            await execAsync(`tar -czf "${destPath}" -C "${path.dirname(contentPath)}" "${path.basename(contentPath)}"`);
        } catch (e) {
            console.warn('Backup failed, continuing:', e);
        }

        let processedCount = 0;
        const messages: string[] = [];

        for (const file of files) {
            // Save uploaded file to temp
            const tempFilePath = path.join(backupPath, `upload-${Date.now()}-${file.name}`);
            const arrayBuffer = await file.arrayBuffer();
            await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));

            try {
                // Process file based on extension
                if (file.name.endsWith('.zip')) {
                    // ZIP: Extract and merge/replace
                    const extractPath = path.join(backupPath, `extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
                    await fs.mkdir(extractPath);

                    await execAsync(`unzip -o "${tempFilePath}" -d "${extractPath}"`);

                    // Copy extracted contents to contentPath
                    // Uses cp -R to merge directories
                    await execAsync(`cp -R "${extractPath}/"* "${contentPath}/"`);

                    // Cleanup extract dir
                    await fs.rm(extractPath, { recursive: true, force: true });
                    messages.push(`Extracted ${file.name}`);

                } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                    // YAML: Determine destination
                    if (file.name === 'settings.yaml') {
                        const settingsPath = getSettingsFilePath();
                        await fs.mkdir(path.dirname(settingsPath), { recursive: true });
                        await fs.copyFile(tempFilePath, settingsPath);
                        messages.push(`Updated settings.yaml`);
                    } else {
                        // Default to artworks folder for other YAMLs
                        const artworkPath = path.join(contentPath, 'artworks');
                        if (!existsSync(artworkPath)) await fs.mkdir(artworkPath);
                        await fs.copyFile(tempFilePath, path.join(artworkPath, file.name));
                        messages.push(`Imported artwork ${file.name}`);
                    }
                } else {
                    // Skip unsupported
                    messages.push(`Skipped ${file.name} (unsupported type)`);
                }

                processedCount++;
            } catch (e: any) {
                messages.push(`Failed ${file.name}: ${e.message}`);
            } finally {
                // Cleanup temp file
                if (existsSync(tempFilePath)) await fs.unlink(tempFilePath);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Processed ${processedCount} files. ${messages.join(', ')}`,
            backupFile,
            details: messages
        }));

    } catch (error) {
        console.error('Upload failed:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
    }
};
