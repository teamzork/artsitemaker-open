import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// --- Shared Logic Ported from packages/admin/src/lib/user-data-structure.ts ---

function isGlob(pattern) {
  return pattern.includes('*') || pattern.includes('?');
}

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function listDirEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath, {
      withFileTypes: true
    });
  } catch {
    return [];
  }
}

function validateYamlFile(filePath, issues) {
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

function validateRule(rule, basePath, issues) {
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

export function loadUserDataStructureSchema(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const schema = yaml.load(content);

  if (!schema || !schema.rules) {
    throw new Error('Invalid schema: missing rules');
  }

  return schema;
}

function isRuleMatch(rule, entry) {
  if (rule.type === 'dir' && !entry.isDirectory()) {
    return false;
  }
  if (rule.type === 'file' && !entry.isFile()) {
    return false;
  }

  if (isGlob(rule.path)) {
    return globToRegExp(rule.path).test(entry.name);
  }

  return rule.path === entry.name;
}

function checkUnknownEntries(basePath, rules, issues) {
  const entries = listDirEntries(basePath);

  for (const entry of entries) {
    const matchingRules = rules.filter((rule) => isRuleMatch(rule, entry));

    if (matchingRules.length === 0) {
      issues.push({
        level: 'error',
        code: 'unknown-entry',
        message: `Unexpected ${entry.isDirectory() ? 'directory' : 'file'} "${entry.name}"`,
        targetPath: path.join(basePath, entry.name)
      });
      continue;
    }

    if (entry.isDirectory()) {
      for (const rule of matchingRules) {
        if (rule.type === 'dir') {
          checkUnknownEntries(path.join(basePath, entry.name), rule.children || [], issues);
        }
      }
    }
  }
}

export function validateUserDataStructure(rootPath, schema) {
  const issues = [];

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

    if (schema.strict) {
      checkUnknownEntries(rootPath, schema.rules, issues);
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {
    recursive: true
  });
}

function scaffoldRule(rule, basePath, created, skipped) {
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

export function scaffoldUserDataProject(rootPath, schema) {
  const created = [];
  const skipped = [];

  ensureDir(rootPath);

  for (const rule of schema.rules) {
    scaffoldRule(rule, rootPath, created, skipped);
  }

  return {
    created,
    skipped
  };
}
