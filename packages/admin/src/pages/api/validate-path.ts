// packages/admin/src/pages/api/validate-path.ts
/**
 * Path Validation API
 *
 * POST /api/validate-path - Validate a content path
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import { loadUserDataStructureSchema, validateUserDataStructure } from '../../lib/user-data-structure';
import { getRepoPath } from '../../lib/paths';
import { resolveUserPath } from '../../lib/path-utils';

interface ValidationResult {
    valid: boolean;
    status: 'valid' | 'exists-but-incomplete' | 'not-found' | 'not-a-directory';
    message: string;
    details?: {
        hasSettings: boolean;
        hasArtworks: boolean;
        hasPages: boolean;
    };
    errors?: Array<{
        level: 'error' | 'warning';
        code: string;
        message: string;
        targetPath: string;
    }>;
    warnings?: Array<{
        level: 'error' | 'warning';
        code: string;
        message: string;
        targetPath: string;
    }>;
    summary?: {
        errorCount: number;
        warningCount: number;
    };
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { path: inputPath } = await request.json();

        if (!inputPath || typeof inputPath !== 'string') {
            return new Response(
                JSON.stringify({
                    valid: false,
                    status: 'not-found',
                    message: 'Path is required'
                } as ValidationResult),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const resolvedPath = resolveUserPath(inputPath);

        // Check if path exists
        try {
            const stats = await fs.stat(resolvedPath);

            if (!stats.isDirectory()) {
                return new Response(
                    JSON.stringify({
                        valid: false,
                        status: 'not-a-directory',
                        message: 'Path exists but is not a directory'
                    } as ValidationResult),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
        } catch {
            return new Response(
                JSON.stringify({
                    valid: false,
                    status: 'not-found',
                    message: 'Path does not exist'
                } as ValidationResult),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check for expected content structure (basic)
        const checks = await Promise.all([
            fs.access(path.join(resolvedPath, 'settings', 'settings.yaml')).then(() => true).catch(() => false),
            fs.access(path.join(resolvedPath, 'artworks')).then(() => true).catch(() => false),
            fs.access(path.join(resolvedPath, 'pages')).then(() => true).catch(() => false)
        ]);

        const [hasSettings, hasArtworks, hasPages] = checks;
        const hasAnyContent = hasSettings || hasArtworks || hasPages;

        // Run schema validation for detailed errors
        const repoRoot = getRepoPath();
        const schemaPath = path.join(repoRoot, 'schemas/user-data.structure.yaml');
        const schema = loadUserDataStructureSchema(schemaPath);
        const validation = validateUserDataStructure(resolvedPath, schema);

        const primaryError = validation.errors[0];
        const primaryMessage = primaryError
            ? `${primaryError.message} (${primaryError.targetPath})`
            : null;

        const responseBody: ValidationResult = {
            valid: validation.valid,
            status: validation.valid
                ? 'valid'
                : hasAnyContent
                    ? 'exists-but-incomplete'
                    : 'exists-but-incomplete',
            message: validation.valid
                ? 'Valid content directory'
                : primaryMessage
                    ? primaryMessage
                    : hasAnyContent
                        ? 'Directory exists but is missing some expected files or has invalid content.'
                        : 'Directory exists but appears empty. You may be setting up a new content folder.',
            details: { hasSettings, hasArtworks, hasPages },
            errors: validation.errors,
            warnings: validation.warnings,
            summary: validation.summary
        };

        return new Response(
            JSON.stringify(responseBody),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Path validation error:', error);
        return new Response(
            JSON.stringify({
                valid: false,
                status: 'not-found',
                message: 'Error validating path'
            } as ValidationResult),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
