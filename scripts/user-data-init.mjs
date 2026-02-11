#!/usr/bin/env node

/**
 * Scaffold User Data Project CLI
 * Usage: node scripts/user-data-init.mjs <project-name>
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { loadUserDataStructureSchema, scaffoldUserDataProject } from './lib/structure-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const projectName = process.argv[2];

if (!projectName) {
  console.error('❌ Please provide a project name.');
  console.error('Usage: node scripts/user-data-init.mjs <project-name>');
  process.exit(1);
}

// Sanitize name
const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '');
if (safeName !== projectName) {
  console.error('❌ Invalid project name. Use only letters, numbers, hyphens, and underscores.');
  process.exit(1);
}

const targetPath = path.join(projectRoot, 'user-data', safeName);
const schemaPath = path.join(projectRoot, 'schemas/user-data.structure.yaml');

console.log(`🚀 Scaffolding new project: ${projectName}`);
console.log(`📂 Location: ${targetPath}`);

try {
  const schema = loadUserDataStructureSchema(schemaPath);
  const { created, skipped } = scaffoldUserDataProject(targetPath, schema);

  console.log(`\n✅ Project initialized successfully!`);
  console.log(`   Created: ${created.length} files/dirs`);
  console.log(`   Skipped: ${skipped.length} existing`);
  
  console.log('\nTo use this project:');
  console.log(`  Update artis.config.yaml or set SITE_PROJECT_PATH=${path.relative(projectRoot, targetPath)}`);

} catch (e) {
  console.error('\n💥 Scaffolding failed:');
  console.error(e.message);
  process.exit(1);
}
