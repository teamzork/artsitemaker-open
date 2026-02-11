// API endpoint: GET/PUT /api/secrets/data
// Get or update secrets data (requires unlocked session)

import type { APIRoute } from 'astro';
import { 
  loadEncryptedSecrets,
  saveEncryptedSecrets,
  decryptWithSession,
  encryptWithSession,
  isSessionValid,
  refreshSession,
  maskSecret,
  type SecretsData
} from '../../../lib/secrets';

export const GET: APIRoute = async ({ url }) => {
  try {
    if (!isSessionValid()) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Session expired. Please unlock secrets first.',
        requiresUnlock: true
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const encrypted = await loadEncryptedSecrets();
    if (!encrypted) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No secrets file found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = decryptWithSession(encrypted);
    if (!data) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to decrypt secrets. Session may have expired.',
        requiresUnlock: true
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    refreshSession();
    
    const masked = url.searchParams.get('masked') === 'true';
    
    if (masked) {
      const maskedData = maskSecretsData(data);
      return new Response(JSON.stringify({ 
        success: true, 
        data: maskedData 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      data 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Failed to get secrets:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to get secrets' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    if (!isSessionValid()) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Session expired. Please unlock secrets first.',
        requiresUnlock: true
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const newData = body.data as SecretsData;
    
    if (!newData || !newData.encryption_version) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid secrets data format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const encrypted = await loadEncryptedSecrets();
    if (!encrypted) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No secrets file found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const newEncrypted = encryptWithSession(newData, encrypted);
    if (!newEncrypted) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to encrypt secrets. Session may have expired.',
        requiresUnlock: true
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await saveEncryptedSecrets(newEncrypted);
    refreshSession();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Secrets saved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Failed to save secrets:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to save secrets' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function maskSecretsData(data: SecretsData): SecretsData {
  const masked: SecretsData = {
    encryption_version: data.encryption_version
  };
  
  if (data.auth) {
    masked.auth = {
      type: data.auth.type,
      github_client_id: maskSecret(data.auth.github_client_id),
      github_client_secret: maskSecret(data.auth.github_client_secret),
    };
  }
  
  if (data.r2) {
    masked.r2 = {
      account_id: maskSecret(data.r2.account_id),
      access_key_id: maskSecret(data.r2.access_key_id),
      secret_access_key: maskSecret(data.r2.secret_access_key),
    };
  }
  
  if (data.deployment) {
    masked.deployment = {
      type: data.deployment.type,
      ftp_host: data.deployment.ftp_host,
      ftp_user: maskSecret(data.deployment.ftp_user),
      ftp_password: maskSecret(data.deployment.ftp_password),
      github_token: maskSecret(data.deployment.github_token),
      deploy_repo: data.deployment.deploy_repo,
    };
  }
  
  if (data.cloudflare) {
    masked.cloudflare = {
      account_id: maskSecret(data.cloudflare.account_id),
      api_token: maskSecret(data.cloudflare.api_token),
    };
  }
  
  return masked;
}
