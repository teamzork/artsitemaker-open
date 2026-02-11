import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { getContentPath, getFilesPath, getThumbnailsPath } from '../../lib/paths';
import { getGitRepoRelativePath, resolveGitRepoRoot } from '../../lib/git-repo';

const execAsync = promisify(exec);

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const message = body.message || 'Update content';

        const repoPath = await resolveGitRepoRoot();
        if (!repoPath) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Git repository not found. Initialize a repo to publish.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const publishTargets = [getContentPath(), getFilesPath(), getThumbnailsPath()];
        const repoPaths = new Set<string>();
        const skippedPaths: string[] = [];

        for (const target of publishTargets) {
            if (!existsSync(target)) continue;
            const relative = getGitRepoRelativePath(repoPath, target);
            if (relative) {
                repoPaths.add(relative);
            } else {
                skippedPaths.push(target);
            }
        }

        if (!repoPaths.size) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No publishable paths found in the repository.',
                skippedPaths
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const pathsArg = Array.from(repoPaths).map(p => `"${p}"`).join(' ');

        // Check for changes within publish targets
        const { stdout: statusOutput } = await execAsync(`git status --porcelain -- ${pathsArg}`, { cwd: repoPath });

        if (!statusOutput.trim()) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No changes to publish',
                commit: null,
                pushed: false
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Stage content, thumbnails, and files
        await execAsync(`git add -- ${pathsArg}`, { cwd: repoPath });

        // Commit
        const commitMessage = `[ArtSiteMaker] ${message}`;
        const { stdout: commitOutput } = await execAsync(
            `git commit -m "${commitMessage}"`,
            { cwd: repoPath }
        );

        // Extract commit hash
        const hashMatch = commitOutput.match(/\[[\w-]+ ([a-f0-9]+)\]/);
        const commitHash = hashMatch ? hashMatch[1] : 'unknown';

        // Push
        let pushed = false;
        let hasRemote = false;
        let remoteName = 'origin';

        try {
            const { stdout: remotesOutput } = await execAsync('git remote', { cwd: repoPath });
            const remotes = remotesOutput.split('\n').map(r => r.trim()).filter(Boolean);
            if (remotes.length > 0) {
                hasRemote = true;
                remoteName = remotes[0];
            }
        } catch {
            hasRemote = false;
        }

        if (hasRemote) {
            try {
                const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
                const branch = branchOutput.trim();

                await execAsync(`git push ${remoteName} ${branch}`, { cwd: repoPath });
                pushed = true;
            } catch (pushError) {
                console.error('Push failed:', pushError);
                // Commit succeeded but push failed - still return success
            }
        }

        return new Response(JSON.stringify({
            success: true,
            commit: commitHash,
            pushed,
            message: pushed ? 'Changes published successfully' : 'Changes committed locally'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Publish failed:', error);
        return new Response(JSON.stringify({
            error: 'Publish failed',
            details: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
