// API endpoint: POST /api/secrets/lock
// Locks the secrets vault (clears the session and persisted session)

import type { APIRoute } from 'astro';
import { clearSessionAndPersisted } from '../../../lib/secrets';

export const POST: APIRoute = async () => {
  try {
    await clearSessionAndPersisted();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Secrets locked'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to lock secrets:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to lock secrets' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
