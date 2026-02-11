/**
 * Deploy to Cloudflare Pages API
 *
 * POST /api/deploy-cloudflare
 * Builds the site and deploys to Cloudflare Pages using Wrangler CLI.
 *
 * Requires:
 * - Cloudflare credentials in the secrets vault (account_id, api_token)
 * - Project name in configuration/project-configuration.yaml (deploy.cloudflarePages.projectName)
 */

import type { APIRoute } from 'astro';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
    isSessionValid,
    loadEncryptedSecrets,
    decryptWithSession,
    refreshSession,
} from '../../lib/secrets';
import { buildSite } from '../../lib/build';
import { getRepoPath } from '../../lib/paths';
import {
    mergeDeployConfig,
    readLegacyDeploymentConfig,
    readProjectConfig,
} from '../../lib/deployment-config';

const execFileAsync = promisify(execFile);

async function getCloudflareConfig(): Promise<{
    projectName: string | null;
    productionBranch: string;
}> {
    const projectConfig = await readProjectConfig();
    const legacyDeployment = await readLegacyDeploymentConfig();
    const deploy = mergeDeployConfig(
        projectConfig.deploy as Record<string, unknown> | undefined,
        legacyDeployment || undefined,
    );
    const cloudflarePages = deploy.cloudflarePages as Record<string, unknown> | undefined;
    return {
        projectName: (cloudflarePages?.projectName as string) || null,
        productionBranch: (cloudflarePages?.productionBranch as string) || 'main',
    };
}

export const POST: APIRoute = async () => {
    try {
        // 1. Check secrets session
        if (!isSessionValid()) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Secrets vault is locked. Please unlock it in the Configuration page first.',
                requiresUnlock: true,
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Load Cloudflare credentials from secrets vault
        const encrypted = await loadEncryptedSecrets();
        if (!encrypted) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No secrets file found. Please set up the secrets vault in Configuration.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const secrets = decryptWithSession(encrypted);
        if (!secrets) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to decrypt secrets. Session may have expired.',
                requiresUnlock: true,
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const cfAccountId = secrets.cloudflare?.account_id;
        const cfApiToken = secrets.cloudflare?.api_token;

        if (!cfAccountId || !cfApiToken) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Cloudflare credentials not configured. Add your Account ID and API Token in the Configuration page.',
                linkToConfig: "/configuration#secrets-vault",
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Get project name from config
        const { projectName, productionBranch } = await getCloudflareConfig();
        if (!projectName) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Cloudflare Pages project name not configured. Set it in the Deployment page.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Build the site
        let distPath: string;
        try {
            const result = await buildSite();
            distPath = result.distPath;
        } catch (buildError: any) {
            let errorDetails = buildError.message;
            if (buildError.stdout) {
                errorDetails += '\n\nStdout:\n' + buildError.stdout;
            }
            if (buildError.stderr) {
                errorDetails += '\n\nStderr:\n' + buildError.stderr;
            }
            return new Response(JSON.stringify({
                success: false,
                error: 'Site build failed.',
                details: errorDetails,
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 5. Deploy using Wrangler CLI
        const repoPath = getRepoPath();
        const wranglerEnv = {
            ...process.env,
            CLOUDFLARE_ACCOUNT_ID: cfAccountId,
            CLOUDFLARE_API_TOKEN: cfApiToken,
        };

        // Ensure the Pages project exists (creates it if missing)
        const createArgs = [
            '--filter',
            '@artsitemaker/admin',
            'exec',
            'wrangler',
            'pages',
            'project',
            'create',
            projectName,
            '--production-branch',
            productionBranch,
        ];

        try {
            await execFileAsync('pnpm', createArgs, {
                cwd: repoPath,
                maxBuffer: 1024 * 1024 * 10,
                env: wranglerEnv,
            });
        } catch (createError: any) {
            const combined = `${createError.message || ''}\n${createError.stdout || ''}\n${createError.stderr || ''}`;
            if (!/already exists|already\s+created|project exists/i.test(combined)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Failed to create Cloudflare Pages project.',
                    details: combined,
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        const deployArgs = [
            '--filter',
            '@artsitemaker/admin',
            'exec',
            'wrangler',
            'pages',
            'deploy',
            distPath,
            `--project-name=${projectName}`,
        ];

        try {
            const { stdout, stderr } = await execFileAsync('pnpm', deployArgs, {
                cwd: repoPath,
                maxBuffer: 1024 * 1024 * 10,
                env: wranglerEnv,
            });

            // Parse the deployment URL from wrangler output
            // Wrangler typically outputs something like:
            //   Deploying... ✨ Deployment complete! Take a peek over at https://xxxxx.my-project.pages.dev
            let deploymentUrl = '';
            const urlMatch = (stdout + stderr).match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/);
            if (urlMatch) {
                deploymentUrl = urlMatch[0];
            }

            refreshSession();

            return new Response(JSON.stringify({
                success: true,
                url: deploymentUrl,
                message: `Deployed to Cloudflare Pages${deploymentUrl ? `: ${deploymentUrl}` : ''}`,
                projectName,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (deployError: any) {
            let errorDetails = deployError.message;
            if (deployError.stdout) {
                errorDetails += '\n\nStdout:\n' + deployError.stdout;
            }
            if (deployError.stderr) {
                errorDetails += '\n\nStderr:\n' + deployError.stderr;
            }

            return new Response(JSON.stringify({
                success: false,
                error: 'Cloudflare Pages deployment failed.',
                details: errorDetails,
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

    } catch (error: any) {
        console.error('Deploy to Cloudflare Pages failed:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Deployment failed unexpectedly.',
            details: (error as Error).message,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
