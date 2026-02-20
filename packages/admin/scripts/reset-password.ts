
import { hashPassword } from '../src/lib/auth';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

async function resetPassword() {
    const newPassword = process.argv[2];

    if (!newPassword) {
        console.error('Usage: npm run reset-password <new_password>');
        process.exit(1);
    }

    // Resolve config path relative to project root
    // We assume this script is run from packages/admin or project root
    let rootDir = process.cwd();
    if (rootDir.endsWith('packages/admin')) {
        rootDir = path.resolve(rootDir, '../..');
    }

    const configPath = path.join(rootDir, 'user-data/kazyamazya/configuration/project-configuration.yaml');

    if (!fs.existsSync(configPath)) {
        console.error(`Config file not found at: ${configPath}`);
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = yaml.load(content) as any;

        if (!config.auth) config.auth = {};
        if (!config.auth.basic) config.auth.basic = {};

        console.log(`Resetting password for user: ${config.auth.basic.username || 'admin'}`);

        const passwordHash = await hashPassword(newPassword);
        config.auth.basic.passwordHash = passwordHash;

        // Remove hint as it might be relevant to old password
        if (config.auth.basic.passwordHint) {
            delete config.auth.basic.passwordHint;
        }

        fs.writeFileSync(
            configPath,
            yaml.dump(config, { lineWidth: -1, quotingType: '"' }),
            'utf-8'
        );

        console.log('✅ Password successfully reset.');
        console.log(`Configuration updated at: ${configPath}`);

    } catch (error) {
        console.error('Failed to reset password:', error);
        process.exit(1);
    }
}

resetPassword();
