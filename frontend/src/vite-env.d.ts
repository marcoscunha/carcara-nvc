/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  readonly VITE_VLM_DEBUG_STAGES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
