import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { POST } from '../../src/pages/api/validate-path';
import { createMockAPIContext, parseJSONResponse } from '../helpers/mock-astro';

vi.mock('../../src/lib/paths', () => ({
  getRepoPath: () => '/test',
}));

const schemaYaml = `version: 1
root: user-data/<project>
rules:
  - path: settings
    type: dir
    required: true
    children:
      - path: settings.yaml
        type: file
        required: true
        parse: yaml
  - path: configuration
    type: dir
    required: true
    children:
      - path: project-configuration.yaml
        type: file
        required: true
        parse: yaml
  - path: pages
    type: dir
    required: true
`;

describe('Validate Path API Integration Tests', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/test/schemas', { recursive: true });
    vol.writeFileSync('/test/schemas/user-data.structure.yaml', schemaYaml, 'utf8');
    vol.mkdirSync('/test/project/settings', { recursive: true });
    vol.mkdirSync('/test/project/configuration', { recursive: true });
    vol.mkdirSync('/test/project/pages', { recursive: true });
    vol.writeFileSync('/test/project/settings/settings.yaml', 'site:\n  title: Test\n', 'utf8');
    vol.writeFileSync('/test/project/configuration/project-configuration.yaml', 'auth:\n  type: github\n', 'utf8');
  });

  it('returns valid when schema checks pass', async () => {
    const context = createMockAPIContext({
      method: 'POST',
      body: { path: '/test/project' },
    });
    const response = await POST(context);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.status).toBe('valid');
    expect(data.errors.length).toBe(0);
  });

  it('returns missing-file error when required file is absent', async () => {
    vol.unlinkSync('/test/project/configuration/project-configuration.yaml');
    const context = createMockAPIContext({
      method: 'POST',
      body: { path: '/test/project' },
    });
    const response = await POST(context);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.errors.some((err: any) => err.code === 'missing-file')).toBe(true);
  });

  it('returns invalid-yaml error when YAML is malformed', async () => {
    vol.writeFileSync('/test/project/settings/settings.yaml', 'site: [', 'utf8');
    const context = createMockAPIContext({
      method: 'POST',
      body: { path: '/test/project' },
    });
    const response = await POST(context);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.errors.some((err: any) => err.code === 'invalid-yaml')).toBe(true);
  });

  it('returns missing-directory error when required directory is absent', async () => {
    vol.rmdirSync('/test/project/pages');
    const context = createMockAPIContext({
      method: 'POST',
      body: { path: '/test/project' },
    });
    const response = await POST(context);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.errors.some((err: any) => err.code === 'missing-directory')).toBe(true);
  });
});
