import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export type RuleType = 'dir' | 'file';
export type ParseType = 'yaml';

export interface StructureRule {
  path: string;
  type: RuleType;
  required?: boolean;
  namePattern?: string;
  parse?: ParseType;
  seed?: string;
  children?: StructureRule[];
}

export interface StructureSchema {
  version: number;
  root: string;
  strict?: boolean;
  rules: StructureRule[];
}

export interface StructureIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  targetPath: string;
}

export interface StructureValidationResult {
  valid: boolean;
  errors: StructureIssue[];
  warnings: StructureIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
  };
}

function isGlob(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?');
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function listDirEntries(dirPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function validateYamlFile(filePath: string, issues: StructureIssue[]): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    yaml.load(content);
  } catch (error) {
    issues.push({
      level: 'error',
      code: 'invalid-yaml',
      message: `Invalid YAML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      targetPath: filePath
    });
  }
}

function validateRule(rule: StructureRule, basePath: string, issues: StructureIssue[]): void {
  if (rule.type === 'dir') {
    if (isGlob(rule.path)) {
      const matcher = globToRegExp(rule.path);
      const matches = listDirEntries(basePath)
        .filter((entry) => entry.isDirectory() && matcher.test(entry.name))
        .map((entry) => path.join(basePath, entry.name));

      if (rule.required && matches.length === 0) {
        issues.push({
          level: 'error',
          code: 'missing-directory',
          message: `Missing required directory matching "${rule.path}"`,
          targetPath: basePath
        });
        return;
      }

      for (const matchPath of matches) {
        for (const child of rule.children || []) {
          validateRule(child, matchPath, issues);
        }
      }
      return;
    }

    const dirPath = path.join(basePath, rule.path);
    if (!fs.existsSync(dirPath)) {
      if (rule.required) {
        issues.push({
          level: 'error',
          code: 'missing-directory',
          message: `Missing required directory "${rule.path}"`,
          targetPath: dirPath
        });
      }
      return;
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      issues.push({
        level: 'error',
        code: 'not-a-directory',
        message: `Expected directory but found file "${rule.path}"`,
        targetPath: dirPath
      });
      return;
    }

    for (const child of rule.children || []) {
      validateRule(child, dirPath, issues);
    }
    return;
  }

  if (isGlob(rule.path)) {
    const matcher = globToRegExp(rule.path);
    const matches = listDirEntries(basePath)
      .filter((entry) => entry.isFile() && matcher.test(entry.name))
      .map((entry) => path.join(basePath, entry.name));

    if (rule.required && matches.length === 0) {
      issues.push({
        level: 'error',
        code: 'missing-file',
        message: `Missing required file matching "${rule.path}"`,
        targetPath: basePath
      });
      return;
    }

    for (const filePath of matches) {
      if (rule.namePattern) {
        const nameRegex = new RegExp(rule.namePattern);
        if (!nameRegex.test(path.basename(filePath))) {
          issues.push({
            level: 'error',
            code: 'invalid-filename',
            message: `Filename does not match pattern ${rule.namePattern}`,
            targetPath: filePath
          });
        }
      }
      if (rule.parse === 'yaml') {
        validateYamlFile(filePath, issues);
      }
    }
    return;
  }

  const filePath = path.join(basePath, rule.path);
  if (!fs.existsSync(filePath)) {
    if (rule.required) {
      issues.push({
        level: 'error',
        code: 'missing-file',
        message: `Missing required file "${rule.path}"`,
        targetPath: filePath
      });
    }
    return;
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    issues.push({
      level: 'error',
      code: 'not-a-file',
      message: `Expected file but found directory "${rule.path}"`,
      targetPath: filePath
    });
    return;
  }

  if (rule.namePattern) {
    const nameRegex = new RegExp(rule.namePattern);
    if (!nameRegex.test(path.basename(filePath))) {
      issues.push({
        level: 'error',
        code: 'invalid-filename',
        message: `Filename does not match pattern ${rule.namePattern}`,
        targetPath: filePath
      });
    }
  }

  if (rule.parse === 'yaml') {
    validateYamlFile(filePath, issues);
  }
}

export function loadUserDataStructureSchema(schemaPath: string): StructureSchema {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const schema = yaml.load(content) as StructureSchema;

  if (!schema || !schema.rules) {
    throw new Error('Invalid schema: missing rules');
  }

  return schema;
}

export function validateUserDataStructure(rootPath: string, schema: StructureSchema): StructureValidationResult {
  const issues: StructureIssue[] = [];

  if (!fs.existsSync(rootPath)) {
    issues.push({
      level: 'error',
      code: 'missing-root',
      message: 'User data root does not exist',
      targetPath: rootPath
    });
  } else if (!fs.statSync(rootPath).isDirectory()) {
    issues.push({
      level: 'error',
      code: 'root-not-directory',
      message: 'User data root is not a directory',
      targetPath: rootPath
    });
  }

  if (issues.length === 0) {
    for (const rule of schema.rules) {
      validateRule(rule, rootPath, issues);
    }
  }

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length
    }
  };
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function scaffoldRule(rule: StructureRule, basePath: string, created: string[], skipped: string[]): void {
  if (rule.type === 'dir') {
    if (isGlob(rule.path)) {
      return;
    }

    const dirPath = path.join(basePath, rule.path);
    if (!fs.existsSync(dirPath)) {
      if (rule.required) {
        ensureDir(dirPath);
        created.push(dirPath);
      } else {
        return;
      }
    }

    for (const child of rule.children || []) {
      scaffoldRule(child, dirPath, created, skipped);
    }
    return;
  }

  if (isGlob(rule.path)) {
    return;
  }

  const filePath = path.join(basePath, rule.path);
  if (fs.existsSync(filePath)) {
    skipped.push(filePath);
    return;
  }

  if (!rule.required) {
    return;
  }

  ensureDir(path.dirname(filePath));
  const seedContent = rule.seed ?? '';
  fs.writeFileSync(filePath, seedContent, 'utf-8');
  created.push(filePath);
}

export function scaffoldUserDataProject(rootPath: string, schema: StructureSchema): {
  created: string[];
  skipped: string[];
} {
  const created: string[] = [];
  const skipped: string[] = [];

  ensureDir(rootPath);

  for (const rule of schema.rules) {
    scaffoldRule(rule, rootPath, created, skipped);
  }

  return { created, skipped };
}
