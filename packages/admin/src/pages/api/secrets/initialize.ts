// API endpoint: POST /api/secrets/initialize
// Sets up the master password and creates the encrypted secrets file

import type { APIRoute } from 'astro';
import { 
  initializeSecrets, 
  secretsFileExists,
  validatePasswordStrength 
} from '../../../lib/secrets';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { masterPassword, confirmPassword } = body;
    
    if (!masterPassword) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Master password is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (masterPassword !== confirmPassword) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Passwords do not match' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const validation = validatePasswordStrength(masterPassword);
    if (!validation.valid) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: validation.errors.join('; '),
        validationErrors: validation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const exists = await secretsFileExists();
    if (exists) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Secrets already initialized. Use unlock instead.' 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await initializeSecrets(masterPassword);
    
    if (!result.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Master password set successfully. Secrets are now unlocked.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Failed to initialize secrets:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to initialize secrets' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
