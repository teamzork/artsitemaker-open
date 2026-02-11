/**
 * System Status API
 * 
 * GET /api/system/status
 * Returns the current project state and configuration details.
 */

import type { APIRoute } from 'astro';
import { getProjectStateDetails, getStateLabel, getStateBadgeColor } from '../../../lib/state-manager';
import { siteConfig, paths } from '../../../lib/paths';

export const GET: APIRoute = async () => {
    try {
        const details = getProjectStateDetails();

        return new Response(JSON.stringify({
            success: true,
            state: details.state,
            stateLabel: getStateLabel(details.state),
            stateBadgeColor: getStateBadgeColor(details.state),
            details: {
                // Content
                hasContentFolder: details.hasContentFolder,
                usingDemoContent: details.usingDemoContent,
                userDataPath: details.userDataPath,
                contentPath: details.userDataPath, // Deprecated but kept for backward compatibility

                // Configuration
                hasSettings: details.hasSettings,
                hasArtworks: details.hasArtworks,
                hasTheme: details.hasTheme,

                // Storage
                imageStorage: details.imageStorage,
                hasFilesFolder: details.hasFilesFolder,

                // Site project
                hasSiteProject: details.hasSiteProject,
                siteProjectPath: details.siteProjectPath,

                // Missing requirements
                missingRequirements: details.missingRequirements
            },
            paths: {
                userData: paths.userData,
                content: paths.content, // Deprecated but kept for backward compatibility
                themes: paths.themes,
                files: paths.files,
                backups: paths.backups,
                repo: paths.repo
            },
            config: {
                siteName: siteConfig.name,
                imageStorage: siteConfig.imageStorage,
                imageBaseUrl: siteConfig.imageBaseUrl
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
