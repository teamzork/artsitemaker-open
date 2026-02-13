import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { loadUserDataStructureSchema, scaffoldUserDataProject } from '../../../lib/user-data-structure';
import { getRepoPath } from '../../../lib/paths';
import { slugify } from '../../../lib/image-pipeline';

function resolveConfiguredUserDataRoot(repoRoot: string): { root: string; reason: 'config' | 'default' } {
  const bootstrapPath = path.join(repoRoot, 'artis.config.yaml');
  if (!fs.existsSync(bootstrapPath)) {
    return { root: path.join(repoRoot, 'user-data'), reason: 'default' };
  }

  try {
    const content = fs.readFileSync(bootstrapPath, 'utf-8');
    const config = yaml.load(content) as { userDataPath?: string; contentPath?: string };
    const pathValue = config?.userDataPath || config?.contentPath;

    if (!pathValue) {
      return { root: path.join(repoRoot, 'user-data'), reason: 'default' };
    }

    const resolved = path.isAbsolute(pathValue)
      ? pathValue
      : path.resolve(repoRoot, pathValue);
    return { root: resolved, reason: 'config' };
  } catch {
    return { root: path.join(repoRoot, 'user-data'), reason: 'default' };
  }
}

function isProjectRoot(dirPath: string): boolean {
  return fs.existsSync(path.join(dirPath, 'settings', 'settings.yaml')) ||
    fs.existsSync(path.join(dirPath, 'configuration', 'project-configuration.yaml'));
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { projectName } = body;
    
    if (!projectName || typeof projectName !== 'string') {
      return new Response(JSON.stringify({ error: 'projectName is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const repoRoot = getRepoPath();
    const schemaPath = path.join(repoRoot, 'schemas/user-data.structure.yaml');
    let { root: userDataRoot } = resolveConfiguredUserDataRoot(repoRoot);

    if (isProjectRoot(userDataRoot)) {
      userDataRoot = path.dirname(userDataRoot);
    }

    const baseProjectName = slugify(projectName);
    if (!baseProjectName) {
      return new Response(JSON.stringify({ error: 'Invalid project name' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let finalProjectName = baseProjectName;
    let projectRoot = path.join(userDataRoot, finalProjectName);
    let suffix = 1;
    while (fs.existsSync(projectRoot)) {
      finalProjectName = `${baseProjectName}-${suffix}`;
      projectRoot = path.join(userDataRoot, finalProjectName);
      suffix += 1;
    }
    
    const schema = loadUserDataStructureSchema(schemaPath);
    const result = scaffoldUserDataProject(projectRoot, schema);
    
    return new Response(JSON.stringify({ 
      success: true,
      path: projectRoot,
      root: userDataRoot,
      projectName: finalProjectName,
      ...result 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
