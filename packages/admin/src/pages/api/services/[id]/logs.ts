import type { APIRoute } from 'astro';
import { processManager } from '@lib/process-manager';

export const GET: APIRoute = async ({ params, url }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Service ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const lines = parseInt(url.searchParams.get('lines') || '50', 10);
    const logs = processManager.getLogs(id, lines);

    return new Response(
      JSON.stringify({ logs }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
