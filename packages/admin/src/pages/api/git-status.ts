import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolveGitRepoRoot } from '../../lib/git-repo';

const execAsync = promisify(exec);

export const GET: APIRoute = async () => {
    try {
        const repoPath = await resolveGitRepoRoot();
        
        // Check if inside work tree
        let isRepo = false;
        if (repoPath) {
            try {
                await execAsync('git rev-parse --is-inside-work-tree', { cwd: repoPath });
                isRepo = true;
            } catch {
                isRepo = false;
            }
        }

        let hasRemote = false;
        let remoteUrl = null;

        if (isRepo && repoPath) {
            try {
                const { stdout } = await execAsync('git remote -v', { cwd: repoPath });
                if (stdout.trim()) {
                    hasRemote = true;
                    // Extract first remote url for display if needed
                    const match = stdout.match(/origin\s+(.+)\s+\(push\)/);
                    if (match) {
                      remoteUrl = match[1];
                    } else {
                        // Fallback to just the first line
                        remoteUrl = stdout.split('\n')[0].split(/\s+/)[1];
                    }
                }
            } catch {
                 // No remote configured
            }
        }

        return new Response(JSON.stringify({
            isRepo,
            hasRemote,
            remoteUrl
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to check git status',
            details: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
