#!/usr/bin/env node

/**
 * Validate User Data Structure CLI
 * Usage: node scripts/user-data-validate.mjs [path/to/user-data]
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { loadUserDataStructureSchema, validateUserDataStructure } from './lib/structure-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Default to user-data at root if not specified
const targetPath = process.argv[2] 
  ? path.resolve(process.cwd(), process.argv[2]) 
  : path.join(projectRoot, 'user-data');

const schemaPath = path.join(projectRoot, 'schemas/user-data.structure.yaml');

console.log(`🔍 Validating structure for: ${targetPath}`);
console.log(`📄 Using schema: ${schemaPath}`);

try {
  const schema = loadUserDataStructureSchema(schemaPath);
  const result = validateUserDataStructure(targetPath, schema);

  if (result.valid) {
    console.log('\n✅ Structure is valid!');
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(w => console.log(`  ⚠️  [${w.code}] ${w.message} (${w.targetPath})`));
    }
    process.exit(0);
  } else {
    console.error('\n❌ Structure invalid!');
    console.error(`\nErrors (${result.summary.errorCount}):`);
    result.errors.forEach(e => {
      console.error(`  🔴 [${e.code}] ${e.message}`);
      console.error(`     at ${e.targetPath}`);
    });
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(w => console.log(`  ⚠️  [${w.code}] ${w.message} (${w.targetPath})`));
    }
    process.exit(1);
  }

} catch (e) {
  console.error('\n💥 Validation failed with exception:');
  console.error(e.message);
  process.exit(1);
}
