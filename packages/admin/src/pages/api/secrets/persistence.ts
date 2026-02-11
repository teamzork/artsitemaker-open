// API endpoint: GET/PUT /api/secrets/persistence
// Manages session persistence settings for the secrets vault

import type { APIRoute } from 'astro';
import { 
  getSessionPersistenceEnabled,
  setSessionPersistenceEnabled,
  clearPersistedSession
} from '../../../lib/secrets';

export const GET: APIRoute = async () => {
  try {
    const enabled = await getSessionPersistenceEnabled();
    
    return new Response(JSON.stringify({ enabled }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to get persistence settings:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get persistence settings',
      enabled: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { enabled } = body;
    
    if (typeof enabled !== 'boolean') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'enabled must be a boolean' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await setSessionPersistenceEnabled(enabled);
    
    return new Response(JSON.stringify({ 
      success: true,
      enabled
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to update persistence settings:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update persistence settings' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
