/**
 * Image Server Health Check
 * 
 * Verifies that the image server is running and accessible before processing images.
 * This prevents silent failures where images are processed but can't be served.
 */

const IMAGE_SERVER_URL = 'http://localhost:3001';
const TIMEOUT_MS = 2000;

export interface ImageServerStatus {
  isRunning: boolean;
  error?: string;
}

/**
 * Check if the image server is running and accessible
 */
export async function checkImageServer(): Promise<ImageServerStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(IMAGE_SERVER_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status === 404) {
      // 404 is fine - it means the server is running, just no index page
      return { isRunning: true };
    }

    return {
      isRunning: false,
      error: `Image server returned status ${response.status}`,
    };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return {
        isRunning: false,
        error: 'Image server did not respond within 2 seconds',
      };
    }

    return {
      isRunning: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Check image server and throw if not running
 */
export async function requireImageServer(): Promise<void> {
  const status = await checkImageServer();
  
  if (!status.isRunning) {
    throw new Error(
      `Image server is not running on port 3001. ` +
      `Start it with: npx serve files -p 3001 --cors`
    );
  }
}
