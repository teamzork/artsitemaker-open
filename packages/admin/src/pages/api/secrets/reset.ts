// API endpoint: POST /api/secrets/reset
// Resets the secrets vault (destructive)

import type { APIRoute } from 'astro';
import { resetSecrets } from '../../../lib/secrets';

export const POST: APIRoute = async ({ request }) => {
  try {
    let payload: { confirm?: boolean } = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    if (!payload.confirm) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Confirmation required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await resetSecrets();

    return new Response(JSON.stringify({
      success: true,
      hadSecrets: result.hadSecrets
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to reset secrets:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to reset secrets' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
