import type { APIContext } from 'astro';

interface MockRequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  url?: string;
}

/**
 * Creates a mock Astro APIContext for testing API routes
 */
export function createMockAPIContext(options: MockRequestOptions = {}): APIContext {
  const {
    method = 'GET',
    body = null,
    headers = {},
    url = 'http://localhost:4322/api/test',
  } = options;

  const request = new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : null,
  });

  return {
    request,
    params: {},
    props: {},
    url: new URL(url),
    redirect(path: string) {
      return new Response(null, {
        status: 302,
        headers: { Location: path },
      });
    },
    cookies: {
      get: () => undefined,
      set: () => {},
      delete: () => {},
      has: () => false,
    },
    locals: {},
    site: new URL('http://localhost:4322'),
    generator: 'Astro v5.0.0',
    clientAddress: '127.0.0.1',
    routePattern: '/api/test',
    getActionResult: () => undefined,
    callAction: async () => ({ data: undefined, error: undefined }),
    rewrite: () => new Response(),
    isPrerendered: false,
    preferredLocale: undefined,
    preferredLocaleList: undefined,
    currentLocale: undefined,
  } as unknown as APIContext;
}

/**
 * Helper to parse JSON response
 */
export async function parseJSONResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
