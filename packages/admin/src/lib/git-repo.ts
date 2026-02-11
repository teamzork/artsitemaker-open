/**
 * Git repo resolution helpers
 * Used to locate the correct repo root for content publishing.
 */

import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { getRepoPath, getSiteProjectPath } from './paths';

const execAsync = promisify(exec);

export async function resolveGitRepoRoot(): Promise<string | null> {
    const candidates = [getSiteProjectPath(), getRepoPath()].filter(Boolean) as string[];

    for (const candidate of candidates) {
        try {
            const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: candidate });
            const root = stdout.trim();
            if (root) return root;
        } catch {
            // Ignore and try the next candidate.
        }
    }

    return null;
}

export function getGitRepoRelativePath(repoRoot: string, targetPath: string): string | null {
    const relativePath = path.relative(repoRoot, targetPath);

    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return null;
    }

    return relativePath;
}
