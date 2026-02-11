/**
 * Git Operations Module
 * Handles git add, commit, push operations for content publishing
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitConfig {
    repoPath: string;
    remote: string;
    branch: string;
    commitPrefix: string;
}

export interface GitStatus {
    staged: string[];
    modified: string[];
    untracked: string[];
}

export class GitOperations {
    private config: GitConfig;

    constructor(config: GitConfig) {
        this.config = config;
    }

    async status(): Promise<GitStatus> {
        const { stdout } = await execAsync(
            'git status --porcelain',
            { cwd: this.config.repoPath }
        );

        const lines = stdout.trim().split('\n').filter(Boolean);
        const staged: string[] = [];
        const modified: string[] = [];
        const untracked: string[] = [];

        for (const line of lines) {
            const status = line.substring(0, 2);
            const file = line.substring(3);

            if (status.startsWith('A') || status.startsWith('M')) {
                staged.push(file);
            } else if (status === ' M') {
                modified.push(file);
            } else if (status === '??') {
                untracked.push(file);
            }
        }

        return { staged, modified, untracked };
    }

    async add(paths: string[]): Promise<void> {
        const pathsArg = paths.map(p => `"${p}"`).join(' ');
        await execAsync(
            `git add ${pathsArg}`,
            { cwd: this.config.repoPath }
        );
    }

    async commit(message: string): Promise<string> {
        const fullMessage = `${this.config.commitPrefix} ${message}`;
        const { stdout } = await execAsync(
            `git commit -m "${fullMessage}"`,
            { cwd: this.config.repoPath }
        );

        // Extract commit hash
        const match = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
        return match ? match[1] : '';
    }

    async push(): Promise<void> {
        await execAsync(
            `git push ${this.config.remote} ${this.config.branch}`,
            { cwd: this.config.repoPath }
        );
    }

    async publish(message: string = 'Update content'): Promise<{
        commit: string;
        pushed: boolean;
    }> {
        // Stage content and thumbnails
        await this.add(['content/', 'thumbnails/']);

        // Commit
        const commit = await this.commit(message);

        // Push
        await this.push();

        return { commit, pushed: true };
    }
}

export async function triggerDeploy(
    webhookUrl: string,
    webhookSecret?: string
): Promise<boolean> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (webhookSecret) {
            headers['Authorization'] = `Bearer ${webhookSecret}`;
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                trigger: 'artis-admin',
                timestamp: new Date().toISOString()
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Deploy trigger failed:', error);
        return false;
    }
}
