/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string
  readonly VITE_SERPAPI_API_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_OPENAI_ORGANIZATION_ID: string
  readonly VITE_MAPBOX_ACCESS_TOKEN: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
