
import { verifyPassword } from '../src/lib/auth';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

async function verifyReset() {
    const configPath = path.resolve('../../user-data/kazyamazya/configuration/project-configuration.yaml');
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as any;
    const storedHash = config?.auth?.basic?.passwordHash;

    if (await verifyPassword('newpassword', storedHash)) {
        console.log('SUCCESS: Password reset correctly.');
    } else {
        console.error('FAILURE: Password reset failed.');
        process.exit(1);
    }
}

verifyReset();
