import type { APIRoute } from 'astro';
import { getStorageInfo } from '../../lib/storage';

export const GET: APIRoute = async () => {
    try {
        const info = getStorageInfo();
        
        return new Response(JSON.stringify(info, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to get storage info:', error);
        
        return new Response(JSON.stringify({ 
            error: 'Failed to get storage info',
            message: (error as Error).message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};