// API endpoint: GET /api/secrets/status
// Returns the current status of secrets management

import type { APIRoute } from 'astro';
import { getSecretsStatus } from '../../../lib/secrets';

export const GET: APIRoute = async () => {
  try {
    const status = await getSecretsStatus();
    
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to get secrets status:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get secrets status',
      initialized: false,
      unlocked: false,
      sessionTimeRemaining: 0
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
