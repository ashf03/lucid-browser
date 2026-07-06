/**
 * Main-process environment variable accessors.
 *
 * electron-vite loads `.env` at build/dev time. Main process reads
 * non-VITE_ names directly; VITE_ prefixed vars are accepted as fallbacks
 * for keys shared with the renderer.
 */

function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  throw new Error(`${names[0]} is not configured`);
}

/** SerpAPI key for Google/YouTube/shopping/maps search IPC handlers. */
export function getSerpApiKey(): string {
  return requireEnv('SERPAPI_API_KEY', 'VITE_SERPAPI_API_KEY');
}

/** ElevenLabs key for text-to-speech and speech-to-text IPC handlers. */
export function getElevenLabsApiKey(): string {
  return requireEnv('ELEVEN_LABS_API_KEY', 'eleven_labs_api');
}

/** Optional encryption key for the electron-store auth cache. */
export function getAuthStoreEncryptionKey(): string | undefined {
  return process.env.AUTH_STORE_ENCRYPTION_KEY;
}
