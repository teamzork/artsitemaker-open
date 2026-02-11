/**
 * Shared build utility for building the Astro site.
 * Used by build-zip and deploy-cloudflare endpoints.
 */

import { exec } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getRepoPath } from './paths';

const execAsync = promisify(exec);

export interface BuildResult {
    distPath: string;
    stdout: string;
    stderr: string;
}

/**
 * Build the Astro site and return the path to the dist directory.
 * Throws an error if the build fails or the dist directory is not found.
 */
export async function buildSite(): Promise<BuildResult> {
    const repoPath = getRepoPath();

    const { stdout, stderr } = await execAsync('pnpm --filter @artsitemaker/site build', {
        cwd: repoPath,
        maxBuffer: 1024 * 1024 * 10,
    });

    // Log build output for debugging
    if (stdout) console.log('Build stdout:', stdout);
    if (stderr) console.error('Build stderr:', stderr);

    const distPath = path.join(repoPath, 'packages/site/dist');
    if (!existsSync(distPath)) {
        throw new Error('Build output not found at ' + distPath);
    }

    return { distPath, stdout, stderr };
}
