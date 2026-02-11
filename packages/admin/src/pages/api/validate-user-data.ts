import type { APIRoute } from 'astro';
import path from 'path';
import { loadUserDataStructureSchema, validateUserDataStructure } from '../../lib/user-data-structure';
import { getUserDataPath, getRepoPath } from '../../lib/paths';

export const GET: APIRoute = async ({ request }) => {
  try {
    const schemaPath = path.join(getRepoPath(), 'schemas/user-data.structure.yaml');
    const schema = loadUserDataStructureSchema(schemaPath);
    const resolvedPath = getUserDataPath();
    const result = validateUserDataStructure(resolvedPath, schema);
    
    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      valid: false, 
      errors: [{ 
        level: 'error', 
        code: 'system-error', 
        message: error.message, 
        targetPath: 'root' 
      }], 
      warnings: [],
      summary: { errorCount: 1, warningCount: 0 }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
