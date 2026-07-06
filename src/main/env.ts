function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  throw new Error(`${names[0]} is not configured`);
}

export function getSerpApiKey(): string {
  return requireEnv('SERPAPI_API_KEY', 'VITE_SERPAPI_API_KEY');
}

export function getElevenLabsApiKey(): string {
  return requireEnv('ELEVEN_LABS_API_KEY', 'eleven_labs_api');
}

export function getAuthStoreEncryptionKey(): string | undefined {
  return process.env.AUTH_STORE_ENCRYPTION_KEY;
}
