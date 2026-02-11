import type { APIRoute } from 'astro';
import { processManager, registerDefaultServices } from '@lib/process-manager';

// Initialize services on first load
let initialized = false;
if (!initialized) {
  registerDefaultServices();
  initialized = true;
}

export const GET: APIRoute = async () => {
  try {
    // Probe ports to detect externally started services (e.g., site via pnpm dev)
    await processManager.probeExternalServices();
    const statuses = processManager.getAllStatuses();
    return new Response(JSON.stringify({ services: statuses }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
