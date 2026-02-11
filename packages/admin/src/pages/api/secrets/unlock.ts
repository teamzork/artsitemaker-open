// API endpoint: POST /api/secrets/unlock
// Unlocks the secrets vault with master password

import type { APIRoute } from 'astro';
import { 
  unlockSecrets, 
  loadEncryptedSecrets,
  secretsFileExists,
  getSessionTimeRemaining
} from '../../../lib/secrets';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { masterPassword } = body;
    
    if (!masterPassword) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Master password is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const exists = await secretsFileExists();
    if (!exists) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Secrets not initialized. Set up master password first.' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const encrypted = await loadEncryptedSecrets();
    if (!encrypted) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to load encrypted secrets' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const unlocked = await unlockSecrets(masterPassword, encrypted);
    
    if (!unlocked) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid master password' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Secrets unlocked successfully',
      sessionTimeRemaining: getSessionTimeRemaining()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Failed to unlock secrets:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to unlock secrets' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
